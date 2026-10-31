import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { setup } from './support';
import { attachRealtime } from '../server/realtime';
test('production WebSocket: auth, isolation, text/sticker delivery, reconnect frozen judgment, closed subscription reset', async () => {
  const { db, service } = setup(),
    server = createServer();
  let revoked = false;
  const soul = { user: 'private-user', nun: false },
    nun = { user: 'private-nun', nun: true };
  const origins = new Set(['http://allowed']);
  const realtime = attachRealtime(server, {
    origins,
    authorize: async (token) => {
      if (revoked || !['soul', 'nun'].includes(token || '')) throw Error('unauthorized');
      return token === 'nun' ? nun : soul;
    },
    snapshot: (actor, id) => service.snapshot(actor, id),
    rate: () => {},
    closed: (id) => !!db.get<any>('SELECT closed_at FROM sessions WHERE id=?', id)?.closed_at,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;
  const clients: WebSocket[] = [];
  const client = async (token: string) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: 'http://allowed' });
    clients.push(ws);
    await once(ws, 'open');
    const data = once(ws, 'message');
    ws.send(JSON.stringify({ type: 'auth', token }));
    await data;
    return ws;
  };
  try {
    const bad = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: 'http://denied' });
    bad.on('error', () => {});
    await new Promise<void>((resolve) => bad.on('close', () => resolve()));
    const user = await client('soul'),
      admin = await client('nun');
    const { id } = await service.command(soul, randomUUID(), 'start', {});
    await service.command(nun, randomUUID(), 'claim', { id });
    const subscribed = once(admin, 'message');
    admin.send(JSON.stringify({ type: 'subscribe', session: id }));
    await subscribed;
    for (const [type, content] of [
      ['text', 'a private thought'],
      ['sticker', 'nun_16'],
    ]) {
      await service.command(soul, randomUUID(), 'message', { id, type, content });
      const update = once(admin, 'message');
      await realtime.publish();
      const [bytes] = await update;
      const json = bytes.toString();
      assert.ok(json.includes(content));
      assert.ok(!json.includes('private-user'));
    }
    await service.command(nun, randomUUID(), 'verdict', { id, verdict: 'hell' });
    const jid = service.snapshot(soul).judgment!.id;
    user.close();
    await once(user, 'close');
    const recovered = await client('soul');
    const response = once(recovered, 'message');
    await realtime.publish();
    const [bytes] = await response;
    assert.equal(JSON.parse(bytes.toString()).data.judgment.id, jid);
    await service.command(soul, randomUUID(), 'animation_done', { judgment: jid });
    await service.command(soul, randomUUID(), 'choose', { judgment: jid, index: 2 });
    await service.command(soul, randomUUID(), 'execute', { judgment: jid });
    await service.command(soul, randomUUID(), 'close', { id });
    const closed = new Promise<any[]>((resolve) => {
      const listener = (bytes: any) => {
        if (!JSON.parse(bytes.toString()).data.session) {
          admin.off('message', listener);
          resolve([bytes]);
        }
      };
      admin.on('message', listener);
    });
    await realtime.publish();
    const [body] = await closed;
    assert.equal(JSON.parse(body.toString()).data.session, undefined);
    assert.equal(admin.readyState, WebSocket.OPEN);
    revoked = true;
    const denied = once(admin, 'close');
    await realtime.publish();
    const [code] = await denied;
    assert.equal(code, 1008);
  } finally {
    for (const ws of clients) ws.terminate();
    realtime.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.db.close();
  }
});
