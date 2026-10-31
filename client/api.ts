import { DiscordSDK } from '@discord/embedded-app-sdk';
import type { Snapshot } from '../shared/types';
let token = '';
let sdk: DiscordSDK;
export async function boot() {
  const config = await fetch('/api/config').then((r) => r.json());
  sdk = new DiscordSDK(config.client_id);
  await sdk.ready();
  const { code } = await sdk.commands.authorize({
    client_id: config.client_id,
    response_type: 'code',
    state: crypto.randomUUID(),
    prompt: 'none',
    scope: ['identify'],
  });
  const r = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, guild_id: sdk.guildId, channel_id: sdk.channelId }),
  });
  const auth = await r.json();
  if (!r.ok) throw Error(auth.error);
  await sdk.commands.authenticate({ access_token: auth.access_token });
  token = auth.token;
  return { role: auth.role, config };
}
export async function command(
  operation: string,
  data: Record<string, unknown>,
  request_id = crypto.randomUUID(),
) {
  const response = await fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ operation, data, request_id }),
  });
  const body = await response.json();
  if (!response.ok) throw Error(body.error);
  return body;
}
export async function snapshot(session?: string): Promise<Snapshot> {
  const response = await fetch(
    '/api/snapshot' + (session ? '?session=' + encodeURIComponent(session) : ''),
    { headers: { Authorization: 'Bearer ' + token } },
  );
  if (!response.ok) throw Error('会话连接中断，请重试');
  return response.json();
}
export function connect(onData: (s: Snapshot) => void, onStatus: (s: string) => void) {
  let ws: WebSocket,
    closed = false,
    retry = 0,
    timer: ReturnType<typeof setTimeout>;
  let session: string | undefined;
  const open = () => {
    onStatus('连接中');
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    ws.onopen = () => {
      retry = 0;
      ws.send(JSON.stringify({ type: 'auth', token }));
    };
    let first = true;
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === 'snapshot') {
        onStatus('已连接');
        onData(m.data);
        if (first && session) {
          ws.send(JSON.stringify({ type: 'subscribe', session }));
        }
        first = false;
      }
    };
    ws.onclose = () => {
      onStatus('重连中，判决已保留');
      if (!closed) timer = setTimeout(open, Math.min(15000, 1000 * 2 ** Math.min(retry++, 4)));
    };
  };
  open();
  return {
    subscribe(id?: string) {
      session = id;
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: 'subscribe', session: id }));
    },
    close() {
      closed = true;
      clearTimeout(timer);
      ws.close();
    },
  };
}
