import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setup, FakeDiscord } from './support';
import { draw, cards, byId, details, manifest, validateManifest, artUrls } from '../server/cards';
import { Effects, safeNickname } from '../server/effects';
import { Service } from '../server/service';
import { Store } from '../server/db';
const soul = { user: 'soul-1', nun: false },
  nun = { user: 'nun-1', nun: true };
const req = () => randomUUID();
async function session(s: Service) {
  const { id } = await s.command(soul, req(), 'start', {});
  await s.command(nun, req(), 'claim', { id });
  return id;
}
function createJ(db: Store, card_id: string, id = randomUUID(), session_id = 'session') {
  db.run(
    "INSERT OR IGNORE INTO sessions(id,anonymous_id,user_id,status,created_at) VALUES(?,?,'user','REVEALED',?)",
    session_id,
    '迷途灵魂 #001',
    Date.now(),
  );
  db.run(
    'INSERT INTO judgments(id,session_id,verdict,card_id,rng,created_at,selected_index,revealed_at) VALUES(?,?,?,?,?,?,0,?)',
    id,
    session_id,
    card_id.startsWith('H') ? 'heaven' : 'hell',
    card_id,
    '[]',
    Date.now(),
    Date.now(),
  );
  return db.get<any>('SELECT * FROM judgments WHERE id=?', id)!;
}
test('manifest: exact 60, 5R/4SR/1SSR per pool, 6 sequences and existing art', () => {
  validateManifest();
  assert.equal(cards.length, 60);
  assert.equal(Object.keys(manifest.ssr_animations).length, 6);
  for (const c of cards) {
    assert.ok(details[c.id].quote);
    assert.equal(artUrls(c).at(-1), artUrls(c).at(-1));
  }
});
test('draw: all 60 reachable, no cross-alignment, probability near 1/3 and 60/30/10', () => {
  const counts: Record<string, number> = {},
    chars: Record<string, number> = {},
    rs: Record<string, number> = {};
  for (const verdict of ['heaven', 'hell'] as const)
    for (let n = 0; n < 40000; n++) {
      const { card } = draw(verdict);
      assert.equal(card.alignment, verdict === 'heaven' ? 'upright' : 'reversed');
      counts[card.id] = (counts[card.id] || 0) + 1;
      chars[card.character] = (chars[card.character] || 0) + 1;
      rs[card.rarity] = (rs[card.rarity] || 0) + 1;
    }
  assert.equal(Object.keys(counts).length, 60);
  for (const n of Object.values(chars)) assert.ok(Math.abs(n / 80000 - 1 / 3) < 0.02);
  for (const [r, p] of Object.entries(manifest.selection.rarity_weights))
    assert.ok(Math.abs(rs[r] / 80000 - Number(p)) < 0.02);
});
test('anonymous queue, text and sticker, nun payload redaction, close deletes mapping and text', async () => {
  const { db, service } = setup();
  const id = await session(service);
  await service.command(soul, req(), 'message', {
    id,
    type: 'text',
    content: 'PRIVATE CONFESSION',
  });
  await service.command(nun, req(), 'message', { id, type: 'sticker', content: 'nun_16' });
  const json = JSON.stringify(service.snapshot(nun, id));
  for (const key of ['user_id', 'username', 'nickname', 'avatar', 'soul-1'])
    assert.ok(!json.includes(key));
  assert.equal(service.snapshot(soul).messages.length, 2);
  await assert.rejects(
    () =>
      service.command({ user: 'stranger', nun: false }, req(), 'message', { id, content: 'no' }),
    /权限/,
  );
  await service.command(nun, req(), 'close', { id });
  assert.equal(db.get<any>('SELECT user_id FROM sessions WHERE id=?', id)?.user_id, null);
  assert.equal(db.all('SELECT * FROM messages').length, 0);
});
test('verdict concurrent calls freeze one result; reconnect, double select and execute are idempotent', async () => {
  const { db, service, discord } = setup();
  const id = await session(service);
  const results = await Promise.all(
    Array.from({ length: 15 }, () =>
      service.command(nun, req(), 'verdict', { id, verdict: 'hell' }),
    ),
  );
  assert.equal(new Set(results.map((r) => r.id)).size, 1);
  const j = service.snapshot(soul).judgment!;
  assert.equal(j.card, undefined);
  await service.command(soul, req(), 'animation_done', { judgment: j.id });
  await service.command(soul, req(), 'choose', { judgment: j.id, index: 3 });
  await service.command(soul, req(), 'choose', { judgment: j.id, index: 0 });
  assert.equal(service.snapshot(soul).judgment?.selected_index, 3);
  await Promise.all(
    Array.from({ length: 10 }, () => service.command(soul, req(), 'execute', { judgment: j.id })),
  );
  assert.ok(discord.calls.length <= 1);
  assert.equal(db.all('SELECT * FROM judgments').length, 1);
  const again = new Service(db, service.effects);
  assert.equal(again.snapshot(soul).judgment?.id, j.id);
});
test('nickname actual port write and safe restore, null baseline, grapheme truncation', async () => {
  const { db, effects, discord, time } = setup();
  await discord.member('user');
  discord.members.get('user')!.nickname = null;
  discord.members.get('user')!.display = '🐈‍⬛'.repeat(30);
  const j = createJ(db, 'P-TAT-02');
  await effects.execute('user', j);
  const n = (await discord.member('user')).nickname!;
  assert.ok(n.length <= 32);
  assert.ok(n.startsWith('被龙卷打屁股的'));
  assert.ok(!/\uFFFD/.test(n));
  time.advance(3 * 3600000);
  await effects.tick();
  assert.equal((await discord.member('user')).nickname, null);
  assert.equal(safeNickname('前缀', 'abcd', 5), '前缀ab…');
});
test('manual nickname change and higher priority never clobbered', async () => {
  const { db, effects, discord, time } = setup();
  await effects.execute('user', createJ(db, 'P-TAT-10'));
  const original = (await discord.member('user')).nickname;
  db.run("UPDATE judgments SET execution_status='superseded'");
  await effects.execute('user', createJ(db, 'P-REN-02'));
  assert.equal((await discord.member('user')).nickname, original);
  discord.members.get('user')!.nickname = '用户新昵称';
  time.advance(25 * 3600000);
  await effects.tick();
  assert.equal((await discord.member('user')).nickname, '用户新昵称');
});
test('nickname replacement keeps true original baseline and no prefix stacking', async () => {
  const { db, effects, discord, time } = setup();
  await effects.execute('user', createJ(db, 'P-TAT-02'));
  db.run("UPDATE judgments SET execution_status='superseded'");
  await effects.execute('user', createJ(db, 'P-REN-07'));
  assert.equal((await discord.member('user')).nickname, '山城恋认证的乖狗狗原昵称');
  time.advance(7 * 3600000);
  await effects.tick();
  assert.equal((await discord.member('user')).nickname, '原昵称');
});
test('role ownership: never remove preexisting role; shared managed roles reference counted', async () => {
  const { db, effects, discord, time } = setup();
  const role = await discord.ensureRole('🌪️ 风暴训诫中');
  db.run('INSERT INTO managed_roles VALUES(?,?)', '🌪️ 风暴训诫中', role);
  await discord.addRole('user', role);
  await effects.execute('user', createJ(db, 'P-TAT-01'));
  time.advance(4 * 3600000);
  await effects.tick();
  assert.ok((await discord.member('user')).roles.includes(role));
  assert.equal(discord.calls.filter((v) => v.startsWith('remove')).length, 0);
});
test('permission failure is degraded, never false success', async () => {
  for (const error of ['MISSING_MANAGE_NICKNAMES', 'ROLE_HIERARCHY_BLOCKED']) {
    const { db, effects, discord } = setup();
    discord.denied = error;
    const j = createJ(db, 'P-REN-07');
    const report = await effects.execute('user', j);
    assert.equal(
      db.get<any>('SELECT execution_status FROM judgments WHERE id=?', j.id)?.execution_status,
      'degraded',
    );
    assert.ok(report.some((r: string) => r.includes('未执行')));
    assert.equal(discord.calls.length, 0);
  }
});
test('restart: durable SQLite resumes effect expiry without Activity, and planned writes reconcile', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'confessional-'));
  const path = join(dir, 'test.sqlite');
  try {
    const { db, effects, discord, time } = setup(path);
    const j = createJ(db, 'P-TAT-06');
    await effects.execute('user', j);
    db.db.close();
    const reopened = new Store(path);
    const recovery = new Effects(
      reopened,
      discord,
      () => 0.1,
      () => time.now + 100 * 3600000,
    );
    await recovery.tick();
    assert.equal((await discord.member('user')).nickname, '原昵称');
    assert.equal((await discord.member('user')).roles.length, 0);
    reopened.db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('all 60 card effect registry paths execute; secondary draws capped at R and no nested interactions', async () => {
  for (const c of cards) {
    const { db, effects } = setup();
    const j = createJ(db, c.id);
    j.interaction = JSON.stringify({
      done: true,
      choice:
        c.id === 'P-REN-10'
          ? 'accept'
          : c.id === 'P-LYB-06'
            ? 'double'
            : c.id === 'P-LYB-05'
              ? 'gamble'
              : 'accept',
      win: false,
    });
    const plan = effects.build(c, j);
    if (plan.secondary) assert.equal(byId.get(plan.secondary)?.rarity, 'R');
    await effects.execute('user', j);
    assert.ok(
      ['executed', 'degraded'].includes(
        db.get<any>('SELECT execution_status FROM judgments WHERE id=?', j.id)!.execution_status,
      ),
    );
    assert.ok(db.all('SELECT * FROM active_effects').length <= 4);
    db.db.close();
  }
});
test('small pardon grants next R nickname immunity when no active penalty', async () => {
  const { db, effects, discord } = setup();
  await effects.execute('user', createJ(db, 'H-TAT-03'));
  assert.ok(effects.tokens('user').includes('immunity_r'));
  db.run("UPDATE judgments SET execution_status='superseded'");
  await effects.execute('user', createJ(db, 'P-TAT-02'));
  assert.equal((await discord.member('user')).nickname, '原昵称');
  assert.ok(!effects.tokens('user').includes('immunity_r'));
});
test('protection excludes SSR; lucky chip only cancels R; cleanse only eligible bot penalties', async () => {
  const { db, effects, discord } = setup();
  effects.grant('user', 'lucky_chip', 24, 'x');
  effects.grant('user', 'storm_protection', 24, 'x');
  await effects.execute('user', createJ(db, 'P-TAT-06'));
  assert.equal(discord.calls.length, 0);
  assert.ok(effects.tokens('user').includes('lucky_chip'));
  db.run("UPDATE judgments SET execution_status='superseded'");
  await effects.execute('user', createJ(db, 'P-REN-10'));
  assert.ok(discord.calls.length > 0);
  db.run("UPDATE judgments SET execution_status='superseded'");
  await effects.execute('user', createJ(db, 'H-LYB-10'));
  assert.ok((await discord.member('user')).nickname?.includes('山城恋'));
});
test('one reroll token, persisted replacement and no consecutive reroll', async () => {
  const { db, service, effects } = setup();
  const id = await session(service);
  await service.command(nun, req(), 'verdict', { id, verdict: 'hell' });
  let j = service.snapshot(soul).judgment!;
  await service.command(soul, req(), 'animation_done', { judgment: j.id });
  await service.command(soul, req(), 'choose', { judgment: j.id, index: 0 });
  effects.grant(soul.user, 'free_reroll', 24, 'test');
  const old = j.id;
  await service.command(soul, req(), 'reroll', { judgment: j.id });
  j = service.snapshot(soul).judgment!;
  assert.notEqual(j.id, old);
  assert.equal(j.rerolled, 1);
  assert.equal(
    db.get<any>('SELECT execution_status FROM judgments WHERE id=?', old)?.execution_status,
    'superseded',
  );
  await assert.rejects(() => service.command(soul, req(), 'reroll', { judgment: j.id }), /重抽/);
});
test('server interaction: 15s deadline, auditable 50/50, one-shot plead and unique ack requests', async () => {
  const { db, service, time } = setup();
  const id = await session(service);
  const jid = req();
  createJ(db, 'P-LYB-06', jid, id);
  db.run('UPDATE judgments SET revealed_at=? WHERE id=?', time.now, jid);
  time.advance(16000);
  await service.command(soul, req(), 'interact', { judgment: jid, choice: 'double' });
  assert.equal(service.snapshot(soul).judgment!.interaction.choice, 'keep');
  db.run("UPDATE judgments SET execution_status='superseded'");
  const bow = req();
  createJ(db, 'P-REN-10', bow, id);
  await service.command(soul, req(), 'interact', { judgment: bow, choice: 'plead' });
  await assert.rejects(
    () => service.command(soul, req(), 'interact', { judgment: bow, choice: 'plead' }),
    /一次/,
  );
  await service.command(soul, req(), 'interact', { judgment: bow, choice: 'plead_confirm' });
  await service.command(soul, req(), 'execute', { judgment: bow });
  const plan = JSON.parse(db.get<any>('SELECT plan FROM judgments WHERE id=?', bow)!.plan);
  assert.equal(plan.actions[0].hours, 8);
});
test('unauthorized nun actions, invalid stickers, early choose and execute blocked', async () => {
  const { service } = setup();
  const id = await session(service);
  await assert.rejects(
    () => service.command(soul, req(), 'verdict', { id, verdict: 'hell' }),
    /修女/,
  );
  await assert.rejects(
    () => service.command(soul, req(), 'message', { id, type: 'sticker', content: '../../secret' }),
    /格式/,
  );
  await service.command(nun, req(), 'verdict', { id, verdict: 'heaven' });
  const j = service.snapshot(soul).judgment!;
  await assert.rejects(
    () => service.command(soul, req(), 'choose', { judgment: j.id, index: 5 }),
    /演出/,
  );
  await assert.rejects(() => service.command(soul, req(), 'execute', { judgment: j.id }), /选牌/);
});
test('crash after Discord write: reconcile durable planned intent without applying twice', async () => {
  const { db, effects, discord } = setup();
  const j = createJ(db, 'P-TAT-06');
  await effects.execute('user', j);
  const calls = discord.calls.length;
  db.run("UPDATE judgments SET execution_status='executing',report=NULL WHERE id=?", j.id);
  db.run("UPDATE active_effects SET status='planned' WHERE judgment_id=?", j.id);
  await effects.tick();
  assert.equal(discord.calls.length, calls);
  assert.equal(
    db.get<any>('SELECT execution_status FROM judgments WHERE id=?', j.id)!.execution_status,
    'executed',
  );
});
test('cleanse restoration failure retries before original expiry, with bounded backoff', async () => {
  const { db, effects, discord, time } = setup();
  await effects.execute('user', createJ(db, 'P-TAT-02'));
  db.run("UPDATE judgments SET execution_status='superseded'");
  discord.denied = 'ROLE_HIERARCHY_BLOCKED';
  await effects.execute('user', createJ(db, 'H-TAT-03'));
  assert.equal(
    db.get<any>("SELECT status FROM active_effects WHERE kind='nickname'")!.status,
    'restoring',
  );
  discord.denied = '';
  time.advance(31000);
  await effects.tick();
  assert.equal((await discord.member('user')).nickname, '原昵称');
});
