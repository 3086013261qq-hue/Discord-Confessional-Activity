import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setup, FakeDiscord } from './support';
import { Service, type Actor } from '../server/service';
import { ChannelPosts } from '../server/channel';
import { DeepSeek, type AIPort } from '../server/ai';
import { Store } from '../server/db';
import { cards, details } from '../server/cards';
const soul: Actor = { user: 'secret-soul-id', nun: false };
const nun: Actor = { user: 'secret-nun-id', nun: true };
const watcher: Actor = { user: 'secret-watcher-id', nun: false };
const req = () => randomUUID();
async function human() {
  const f = setup();
  const { id } = await f.service.command(soul, req(), 'identity', { role: 'confessor' });
  await f.service.command(nun, req(), 'identity', { role: 'nun' });
  await f.service.command(nun, req(), 'claim', { id });
  return { ...f, id };
}
test('C2 identity: eligible nuns may confess; normal users cannot select nun; confessor auto queues; claim is explicit', async () => {
  const { service } = setup();
  assert.equal(service.snapshot(soul).role, 'identity_select');
  await assert.rejects(() => service.command(soul, req(), 'identity', { role: 'nun' }), /身份/);
  const { id } = await service.command(nun, req(), 'identity', { role: 'confessor' });
  assert.equal(service.snapshot(nun).session?.status, 'QUEUED');
  assert.equal(service.snapshot(nun).role, 'confessor');
  const other = { user: 'other-nun', nun: true };
  await service.command(other, req(), 'identity', { role: 'nun' });
  assert.equal(service.snapshot(other).session, undefined);
  await service.command(other, req(), 'claim', { id });
  assert.equal(service.snapshot(nun).session?.status, 'MODE_SELECT');
});
test('C2 mode: only text/brave accepted, default text at 30 seconds; nun reply independently voice/text', async () => {
  for (const mode of ['text', 'brave', 'timeout']) {
    const { service, time, id } = await human();
    await assert.rejects(
      () => service.command(soul, req(), 'mode', { id, mode: 'invalid' }),
      /模式/,
    );
    await service.command(nun, req(), 'reply_mode', { id, mode: 'voice' });
    if (mode === 'timeout') {
      time.advance(29999);
      await service.maintain();
      assert.equal(service.snapshot(soul).session?.status, 'MODE_SELECT');
      time.advance(1);
      await service.maintain();
    } else await service.command(soul, req(), 'mode', { id, mode });
    assert.equal(service.snapshot(soul).session?.mode, mode === 'timeout' ? 'text' : mode);
    assert.equal(service.snapshot(soul).session?.reply_mode, 'voice');
    await service.command(nun, req(), 'reply_mode', { id, mode: 'text' });
    await service.command(soul, req(), 'message', { id, content: 'public text' });
  }
});
test('C2 spectators receive anonymous current-instance messages and cannot mutate, claim, verdict, choose, execute or close', async () => {
  const { service, id } = await human();
  await service.command(soul, req(), 'mode', { id, mode: 'text' });
  await service.command(watcher, req(), 'identity', { role: 'spectator' });
  await service.command(soul, req(), 'message', { id, content: '公开告解' });
  await service.command(nun, req(), 'message', { id, content: '公开回复' });
  const view = service.snapshot(watcher);
  assert.equal(view.messages.length, 2);
  const json = JSON.stringify(view);
  for (const sensitive of [soul.user, nun.user, 'user_id', 'nun_id', 'original_value'])
    assert.ok(!json.includes(sensitive));
  for (const op of [
    'claim',
    'message',
    'end_confession',
    'verdict',
    'choose',
    'execute',
    'close',
    'ai_verdict',
    'mode',
    'reply_mode',
    'start',
  ])
    await assert.rejects(
      () =>
        service.command(watcher, req(), op, { id, verdict: 'heaven', index: 0, content: 'bad' }),
      /只读/,
    );
  const elsewhere = { ...watcher, instance: 'other-room' };
  assert.equal(service.snapshot(elsewhere).session, undefined);
  assert.equal(service.snapshot(elsewhere, id).session, undefined);
});
test('C2 disconnect: final socket only, 20 second grace, reconnect preserves state; timeout clears messages, bindings and request cache', async () => {
  const { service, db, time, id } = await human();
  await service.command(soul, req(), 'mode', { id, mode: 'text' });
  await service.command(soul, req(), 'message', { id, content: 'temporary text' });
  service.connected(soul);
  service.connected(soul);
  service.disconnected(soul);
  time.advance(21000);
  await service.maintain();
  assert.ok(service.snapshot(nun).session);
  service.disconnected(soul);
  time.advance(19999);
  await service.maintain();
  assert.equal(service.snapshot(nun).session?.disconnected, true);
  service.connected(soul);
  time.advance(10);
  await service.maintain();
  assert.equal(service.snapshot(soul).session?.id, id);
  service.disconnected(soul);
  time.advance(20000);
  await service.maintain();
  assert.equal(service.snapshot(nun).session, undefined);
  assert.equal(db.get<any>('SELECT user_id,nun_id FROM sessions WHERE id=?', id)?.user_id, null);
  assert.equal(db.all('SELECT * FROM messages').length, 0);
  assert.equal(db.all('SELECT * FROM requests').length, 0);
});
test('C2 nun disconnect: grace then requeue without destroying confession; another nun can claim', async () => {
  const { service, db, time, id } = await human();
  service.connected(nun);
  service.disconnected(nun);
  time.advance(20000);
  await service.maintain();
  assert.equal(service.snapshot(soul).session?.status, 'QUEUED');
  assert.equal(db.get<any>('SELECT nun_id FROM sessions WHERE id=?', id)?.nun_id, null);
  const second = { user: 'second-nun', nun: true };
  await service.command(second, req(), 'identity', { role: 'nun' });
  await service.command(second, req(), 'claim', { id });
  assert.equal(service.snapshot(second).session?.id, id);
});
test('C2 executing disconnect waits for durable effect; restart starts reconnect grace', async () => {
  const { service, db, time, id } = await human();
  service.recoverPresence();
  service.connected(nun);
  db.run("UPDATE sessions SET status='EXECUTING' WHERE id=?", id);
  time.advance(20000);
  await service.maintain();
  assert.equal(db.get<any>('SELECT closed_at FROM sessions WHERE id=?', id)?.closed_at, null);
  db.run("UPDATE sessions SET status='SETTLED' WHERE id=?", id);
  await service.maintain();
  assert.ok(db.get<any>('SELECT closed_at FROM sessions WHERE id=?', id)?.closed_at);
});
test('C2 poll is native and once; no automatic verdict; only assigned nun decides; completed result Embed once across restart', async () => {
  const { service, db, discord, effects, time, id } = await human();
  await service.command(soul, req(), 'mode', { id, mode: 'text' });
  await assert.rejects(
    () => service.command(nun, req(), 'verdict', { id, verdict: 'heaven' }),
    /先结束/,
  );
  await Promise.all(
    Array.from({ length: 10 }, () => service.command(nun, req(), 'end_confession', { id })),
  );
  assert.equal(discord.posts.length, 1);
  assert.deepEqual(discord.posts[0].poll.answers, [{ text: '😇 上天堂' }, { text: '🔥 下地狱' }]);
  assert.equal(service.snapshot(soul).judgment, undefined);
  await assert.rejects(
    () =>
      service.command({ user: 'intruder', nun: true, identity: 'nun' }, req(), 'verdict', {
        id,
        verdict: 'hell',
      }),
    /权限/,
  );
  await service.command(nun, req(), 'verdict', { id, verdict: 'hell' });
  const j = service.snapshot(soul).judgment!;
  await service.command(soul, req(), 'animation_done', { judgment: j.id });
  await service.command(soul, req(), 'choose', { judgment: j.id, index: 2 });
  await Promise.all(
    Array.from({ length: 10 }, () => service.command(soul, req(), 'execute', { judgment: j.id })),
  );
  assert.equal(discord.posts.length, 2);
  const post = JSON.stringify(discord.posts[1]);
  assert.ok(post.includes('最终裁决由当值修女决定'));
  assert.ok(post.includes('龙卷'));
  assert.ok(!post.includes(soul.user));
  const after = new Service(
    db,
    effects,
    () => 0.25,
    () => time.now,
    new ChannelPosts(db, discord, 'https://test.invalid'),
  );
  await after.maintain();
  assert.equal(discord.posts.length, 2);
});
test('C2 channel delivery: definite rejection is retryable; ambiguous failure/restart never duplicate', async () => {
  const { db, discord } = setup();
  const channel = new ChannelPosts(db, discord, 'https://test.invalid');
  let calls = 0;
  discord.send = async () => {
    calls++;
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  };
  await assert.rejects(() => channel.poll({ id: 'a', anonymous_id: '匿名' }));
  assert.equal(db.get('SELECT value FROM metadata WHERE key=?', 'community_poll:a'), undefined);
  discord.send = async () => {
    calls++;
    return 'poll-a';
  };
  assert.equal(await channel.poll({ id: 'a', anonymous_id: '匿名' }), 'poll-a');
  discord.send = async () => {
    calls++;
    throw Error('network timeout');
  };
  await assert.rejects(() => channel.poll({ id: 'b', anonymous_id: '匿名' }));
  await assert.rejects(() =>
    new ChannelPosts(db, discord, 'https://test.invalid').poll({ id: 'b' }),
  );
  assert.equal(calls, 3);
});
test('C2 all former role cards have nickname or meaningful mechanism; Discord port without Role methods executes all 60 cards', async () => {
  for (const c of cards) {
    const { db, effects, discord } = setup();
    for (const key of ['ensureRole', 'addRole', 'removeRole'])
      (discord as any)[key] = () => {
        throw Error('ROLE_API_FORBIDDEN');
      };
    assert.ok(details[c.id].actions.every((a) => ['nickname', 'token'].includes(a.kind)));
    db.run(
      "INSERT INTO sessions(id,anonymous_id,user_id,status,created_at) VALUES('s','匿名','u','REVEALED',0)",
    );
    db.run(
      "INSERT INTO judgments(id,session_id,verdict,card_id,rng,created_at,selected_index,interaction) VALUES('j','s',?,?,'[]',0,0,?)",
      c.alignment === 'upright' ? 'heaven' : 'hell',
      c.id,
      JSON.stringify({ done: true, choice: 'accept', win: false }),
    );
    const j = db.get<any>('SELECT * FROM judgments WHERE id=?', 'j');
    const report = await effects.execute('u', j);
    assert.equal(
      db.get<any>('SELECT execution_status FROM judgments WHERE id=?', 'j')?.execution_status,
      'executed',
    );
    assert.ok(report.length > 0);
    assert.equal(db.all("SELECT * FROM active_effects WHERE kind='role'").length, 0);
    assert.ok(discord.calls.every((c) => c.startsWith('nickname:')));
    db.db.close();
  }
});
test('C2 legacy database role effects are retired without writes; migration idempotent', () => {
  const folder = mkdtempSync(join(tmpdir(), 'c2-'));
  try {
    const path = join(folder, 'c2.sqlite');
    const db = new Store(path);
    db.run(
      "INSERT INTO active_effects(id,user_id,judgment_id,card_id,effect_key,kind,applied_value,expires_at,status,created_at) VALUES('e','u','j','P-TAT-01','old','role','role-id',1,'active',0)",
    );
    db.db.close();
    for (let n = 0; n < 2; n++) {
      const reopened = new Store(path);
      assert.equal(
        reopened.get<any>('SELECT status FROM active_effects WHERE id=?', 'e')?.status,
        'legacy_retired',
      );
      reopened.db.close();
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
function aiFixture() {
  const f = setup();
  let fail = false;
  const calls: any[] = [];
  const ai: AIPort = {
    enabled: true,
    reply: async (messages) => {
      calls.push(messages);
      if (fail) throw Error('private provider message');
      return '哼，说来听听。';
    },
    verdict: async (messages) => {
      calls.push(messages);
      if (fail) throw Error('provider failure');
      return { verdict: 'heaven', reason: '我认真听完了。' };
    },
  };
  const service = new Service(
    f.db,
    f.effects,
    () => 0.25,
    () => f.time.now,
    new ChannelPosts(f.db, f.discord, 'https://test.invalid'),
    ai,
  );
  return {
    ...f,
    service,
    calls,
    fail: (value: boolean) => {
      fail = value;
    },
  };
}
test('C2 AI is opt in, eligible nun may confess to it; AI never claims queue, mode is text, original card pipeline reused', async () => {
  const { service, db, calls } = aiFixture();
  const queued = await service.command(soul, req(), 'identity', { role: 'confessor' });
  await service.command(nun, req(), 'identity', { role: 'confessor' });
  const { id } = await service.command(nun, req(), 'ai_start', {});
  assert.equal(service.snapshot(nun).session?.kind, 'ai');
  assert.equal(service.snapshot(nun).session?.mode, 'text');
  assert.equal(db.get<any>('SELECT status FROM sessions WHERE id=?', queued.id)?.status, 'QUEUED');
  for (const op of ['claim', 'mode', 'reply_mode', 'end_confession', 'verdict'])
    await assert.rejects(() =>
      service.command(nun, req(), op, { id, mode: 'brave', verdict: 'hell' }),
    );
  await service.command(nun, req(), 'message', { id, content: '我今天很难受' });
  assert.equal(calls[0].length, 1);
  assert.equal(calls[0][0].content, '我今天很难受');
  await service.command(nun, req(), 'ai_verdict', { id });
  const j = service.snapshot(nun).judgment!;
  assert.equal(j.verdict, 'heaven');
  assert.equal(j.card, undefined);
  await service.command(nun, req(), 'animation_done', { judgment: j.id });
  await service.command(nun, req(), 'choose', { judgment: j.id, index: 4 });
  await service.command(nun, req(), 'execute', { judgment: j.id });
  assert.ok(service.snapshot(nun).judgment?.report);
});
test('C2 AI failure leaves session recoverable, replay does not duplicate user text; retry and exit work; no random verdict fallback', async () => {
  const { service, fail, db } = aiFixture();
  await service.command(nun, req(), 'identity', { role: 'confessor' });
  const { id } = await service.command(nun, req(), 'ai_start', {});
  const request = req();
  fail(true);
  for (let n = 0; n < 2; n++)
    await assert.rejects(
      () => service.command(nun, request, 'message', { id, content: '难受' }),
      /重试或退出/,
    );
  assert.equal(service.snapshot(nun).messages.length, 1);
  await assert.rejects(() => service.command(nun, req(), 'ai_verdict', { id }), /重试或退出/);
  assert.equal(db.all('SELECT * FROM judgments').length, 0);
  fail(false);
  await service.command(nun, req(), 'ai_retry', { id });
  assert.equal(service.snapshot(nun).messages.length, 2);
  await service.command(nun, req(), 'close', { id });
  assert.equal(service.snapshot(nun).session, undefined);
});
test('C2 DeepSeek official endpoint, model alias, scoped text history, strict schema, provider errors/key never escape', async () => {
  const env = { AI_NUN_ENABLED: 'true', DEEPSEEK_API_KEY: 'test-secret-not-real' };
  let payload: any;
  const provider = new DeepSeek(env, async (url, init) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-secret-not-real');
    payload = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: '{"verdict":"hell","reason":"别再熬夜啦"}' } }],
      }),
    );
  });
  assert.equal(
    (await provider.verdict([{ sender_type: 'confessor', content: '告解' }])).verdict,
    'hell',
  );
  assert.equal(payload.model, 'deepseek-flash');
  assert.deepEqual(payload.response_format, { type: 'json_object' });
  assert.equal(payload.messages.length, 3);
  for (const invalid of [
    'not json',
    '{"verdict":"hell","reason":"ok","card_id":"P-TAT-10"}',
    '{"verdict":"other","reason":"ok"}',
    '{"verdict":"hell","reason":3}',
  ]) {
    const bad = new DeepSeek(
      env,
      async () => new Response(JSON.stringify({ choices: [{ message: { content: invalid } }] })),
    );
    await assert.rejects(() => bad.verdict([]));
  }
  const leaked = new DeepSeek(
    env,
    async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: env.DEEPSEEK_API_KEY } }] })),
  );
  await assert.rejects(() => leaked.reply([]), /AI_INVALID/);
  for (const status of [401, 402, 429, 500]) {
    const bad = new DeepSeek(env, async () => new Response('test-secret-not-real', { status }));
    await assert.rejects(
      () => bad.reply([]),
      (error) => !(error as Error).message.includes(env.DEEPSEEK_API_KEY),
    );
  }
});
test('C2 production boundaries: no Role writes, no audio capture or obsolete voice product mode; key server only', () => {
  const discord = readFileSync('server/discord.ts', 'utf8');
  assert.ok(
    !/ensureRole|addRole|removeRole|roles\.create|roles\.add|roles\.remove|ManageRoles/.test(
      discord,
    ),
  );
  const frontend = readFileSync('client/main.tsx', 'utf8') + readFileSync('client/api.ts', 'utf8');
  assert.ok(!/getUserMedia|MediaRecorder|变声|DEEPSEEK_API_KEY/.test(frontend));
  assert.ok(frontend.includes('readOnly={role'));
});

test('C2 fresh OAuth scope still starts at identity selection and resumes the existing session after choosing the same identity', async () => {
  const { service, id } = await human();
  const freshSoul = { ...soul, scope: 'new-soul-login' };
  assert.equal(service.snapshot(freshSoul).role, 'identity_select');
  const result = await service.command(freshSoul, req(), 'identity', { role: 'confessor' });
  assert.equal(result.id, id);
  assert.equal(service.snapshot(freshSoul).session?.id, id);
  const freshNun = { ...nun, scope: 'new-nun-login' };
  await service.command(freshNun, req(), 'identity', { role: 'nun' });
  assert.equal(service.snapshot(freshNun).session?.id, id);
});
test('C2 direct AI entry never joins human queue or consumes priority token', async () => {
  const { service, effects } = aiFixture();
  effects.grant(nun.user, 'priority_confession', 24, 'prior');
  await service.command(nun, req(), 'identity', { role: 'confessor', target: 'ai' });
  assert.equal(service.snapshot(nun).session?.kind, 'ai');
  assert.ok(effects.tokens(nun.user).includes('priority_confession'));
});
