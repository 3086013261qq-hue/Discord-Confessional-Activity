import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { Actor } from './service';
import type { Snapshot } from '../shared/types';
interface Dependencies {
  origins: Set<string>;
  authorize: (token?: string) => Promise<Actor>;
  snapshot: (actor: Actor, session?: string) => Snapshot;
  rate: (key: string, max: number) => void;
  closed: (id: string) => boolean;
  connected?: (actor: Actor) => void;
  disconnected?: (actor: Actor) => void;
}
export function attachRealtime(server: Server, deps: Dependencies) {
  let stopping = false;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 12 * 1024 });
  const sockets = new Map<
    WebSocket,
    { actor: Actor; session?: string; token: string; alive: boolean }
  >();
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/ws' || !deps.origins.has(req.headers.origin || '')) {
      socket.destroy();
      return;
    }
    try {
      deps.rate('ws:' + req.socket.remoteAddress, 30);
    } catch {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
  wss.on('connection', (ws) => {
    let authenticating = false;
    const deadline = setTimeout(() => ws.close(1008, 'Authentication required'), 5000);
    ws.on('pong', () => {
      const ctx = sockets.get(ws);
      if (ctx) ctx.alive = true;
    });
    ws.on('message', async (bytes) => {
      try {
        const m = JSON.parse(bytes.toString());
        if (m.type === 'auth') {
          if (authenticating || sockets.has(ws)) throw Error('Already authenticated');
          authenticating = true;
          const actor = await deps.authorize(m.token);
          if (ws.readyState !== WebSocket.OPEN) return;
          clearTimeout(deadline);
          sockets.set(ws, { actor, token: m.token, alive: true });
          deps.connected?.(actor);
          ws.send(JSON.stringify({ type: 'snapshot', data: deps.snapshot(actor) }));
        } else if (m.type === 'subscribe') {
          const ctx = sockets.get(ws);
          if (!ctx) throw Error('Authentication required');
          deps.rate(ctx.actor.user, 180);
          if (m.session && typeof m.session !== 'string') throw Error('Invalid subscription');
          deps.snapshot(ctx.actor, m.session);
          ctx.session = m.session;
          ws.send(
            JSON.stringify({ type: 'snapshot', data: deps.snapshot(ctx.actor, ctx.session) }),
          );
        } else throw Error('Unknown message');
      } catch {
        ws.close(1008, 'Invalid subscription');
      }
    });
    ws.on('error', () => {});
    ws.on('close', () => {
      clearTimeout(deadline);
      const ctx = sockets.get(ws);
      sockets.delete(ws);
      if (ctx) {
        deps.disconnected?.(ctx.actor);
        void publish();
      }
    });
  });
  async function publish() {
    if (stopping) return;
    for (const [ws, ctx] of sockets) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ctx.actor = await deps.authorize(ctx.token);
          if (stopping) return;
          if (ctx.session && deps.closed(ctx.session)) ctx.session = undefined;
          let data;
          try {
            data = deps.snapshot(ctx.actor, ctx.session);
          } catch {
            ctx.session = undefined;
            data = deps.snapshot(ctx.actor);
          }
          ws.send(JSON.stringify({ type: 'snapshot', data }));
        }
      } catch {
        ws.close(1008, 'Session expired or access revoked');
      }
    }
  }
  const heartbeat = setInterval(() => {
    for (const [ws, ctx] of sockets) {
      if (!ctx.alive) {
        ws.terminate();
        continue;
      }
      ctx.alive = false;
      ws.ping();
    }
  }, 30000);
  heartbeat.unref();
  return {
    publish,
    close() {
      stopping = true;
      clearInterval(heartbeat);
      for (const ws of sockets.keys()) ws.close(1001, 'Restart');
      sockets.clear();
      wss.close();
    },
  };
}
