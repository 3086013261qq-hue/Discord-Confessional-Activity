import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setup } from './support';
import { cards, byId, details, artUrls } from '../server/cards';
import { renderNickname } from '../server/nickname';
import { ChannelPosts } from '../server/channel';
import { Store } from '../server/db';
function judgment(
  db: Store,
  card: string,
  interaction: any = { done: true, choice: 'accept', win: false },
) {
  db.run("UPDATE sessions SET closed_at=1,user_id=NULL WHERE user_id='u'");
  const id = randomUUID();
  db.run(
    "INSERT INTO sessions(id,anonymous_id,user_id,status,created_at) VALUES(?,?,'u','REVEALED',0)",
    id,
    '匿名',
  );
  db.run(
    "INSERT INTO judgments(id,session_id,verdict,card_id,rng,created_at,selected_index,revealed_at,interaction) VALUES(?,?,?,?,'[]',0,0,0,?)",
    id,
    id,
    card.startsWith('H') ? 'heaven' : 'hell',
    card,
    JSON.stringify(interaction),
  );
  return db.get<any>('SELECT * FROM judgments WHERE id=?', id)!;
}
test('nickname template: complete sentence, all positions, prefix compatibility, graphemes, fixed meaning and injection', () => {
  assert.equal(renderNickname('{name}的屁股被龙卷踢了', 'zero'), 'zero的屁股被龙卷踢了');
  assert.equal(renderNickname('龙卷命令{name}不许顶嘴', 'zero'), '龙卷命令zero不许顶嘴');
  assert.equal(renderNickname('龙卷今天偏心{name}', 'zero'), '龙卷今天偏心zero');
  assert.equal(renderNickname('前缀', 'zero'), '前缀zero');
  for (const name of [
    '很长的中文'.repeat(30),
    '🐈‍⬛'.repeat(30),
    'e\u0301'.repeat(40),
    '👩🏽‍🚀'.repeat(20),
  ]) {
    const out = renderNickname('前{name}后', name);
    assert.ok(out.length <= 32);
    assert.ok(out.startsWith('前') && out.endsWith('…后'));
    const kept = out.slice(1, -2);
    assert.ok(name.startsWith(kept));
    const segments = [...new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(name)].map(
      (x) => x.segment,
    );
    let prefix = '';
    let matched = kept === '';
    for (const s of segments) {
      prefix += s;
      if (prefix === kept) matched = true;
    }
    assert.ok(matched);
  }
  assert.throws(() => renderNickname('字'.repeat(33) + '{name}', 'x'), /TEMPLATE_TOO_LONG/);
  assert.throws(() => renderNickname('{name}{name}', 'x'), /MULTIPLE/);
  for (const bad of [
    '@everyone{name}',
    '@here{name}',
    '<@123>{name}',
    '<@&123>{name}',
    '<#123>{name}',
  ])
    assert.throws(() => renderNickname(bad, 'zero'), /MENTION/);
  assert.ok(!/@everyone|@here|<[@#]/.test(renderNickname('{name}今天好运', '@everyone <@123>')));
  for (const d of Object.values(details))
    for (const a of d.actions) if (a.kind === 'nickname') renderNickname(a.value, 'zero');
});
test('all 60 execute without role/state; >=10 genuine nickname paths per character, both alignments, assets stable', async () => {
  const counts: Record<string, number> = {};
  for (const c of cards) {
    const f = setup();
    const j = judgment(f.db, c.id, { done: true, choice: 'coward', win: false });
    const plan = f.effects.build(c, j);
    assert.ok(plan.actions.every((a) => ['nickname', 'token'].includes(a.kind)));
    await f.effects.execute('u', j);
    const rows = f.db.all("SELECT * FROM active_effects WHERE kind='nickname'");
    if (rows.length) counts[c.character] = (counts[c.character] || 0) + 1;
    assert.equal(f.db.all("SELECT * FROM active_effects WHERE kind IN ('role','state')").length, 0);
    assert.ok(f.discord.calls.every((x) => x.startsWith('nickname:')));
    assert.ok(artUrls(c).length);
    f.db.db.close();
  }
  assert.deepEqual(counts, { tatsumaki: 16, ren_yamashiro: 16, yuzuha_lee: 16 });
  for (const ch of Object.keys(counts))
    for (const alignment of ['upright', 'reversed'])
      assert.ok(
        cards.some(
          (c) =>
            c.character === ch &&
            c.alignment === alignment &&
            details[c.id].actions.some((a) => a.kind === 'nickname'),
        ),
      );
});
test('unfinished legacy role/state plans remap by card ID, settled history remains intact and hidden', async () => {
  for (const kind of ['state', 'role']) {
    const f = setup();
    const j = judgment(f.db, 'P-TAT-01');
    j.plan = JSON.stringify({ actions: [{ kind, value: '装饰称号', hours: 2 }], notes: [] });
    f.db.run('UPDATE judgments SET plan=? WHERE id=?', j.plan, j.id);
    f.db.run('INSERT INTO metadata VALUES(?,?)', 'prepared:' + j.id, '1');
    await f.effects.execute('u', j);
    assert.equal((await f.discord.member('u')).nickname, '原昵称正在被龙卷罚站');
    assert.ok(
      !/"kind":"(state|role)"/.test(
        f.db.get<any>('SELECT plan FROM judgments WHERE id=?', j.id).plan,
      ),
    );
    const settled = f.db.get<any>('SELECT * FROM judgments WHERE id=?', j.id);
    settled.plan = j.plan;
    const calls = f.discord.calls.length;
    await f.effects.execute('u', settled);
    assert.equal(f.discord.calls.length, calls);
  }
  const folder = mkdtempSync(join(tmpdir(), 'nickname-legacy-'));
  const path = join(folder, 'old.sqlite');
  try {
    const db = new Store(path);
    for (const kind of ['state', 'role'])
      db.run(
        "INSERT INTO active_effects(id,user_id,judgment_id,card_id,effect_key,kind,applied_value,expires_at,status,created_at) VALUES(?,'u','j','P-TAT-01','old',?,'legacy',9999999999999,'active',0)",
        kind,
        kind,
      );
    db.db.close();
    for (let i = 0; i < 2; i++) {
      const f = setup(path);
      await f.effects.tick();
      assert.equal(f.effects.active('u').length, 0);
      assert.equal(f.discord.calls.length, 0);
      assert.equal(
        f.db.get<any>("SELECT status FROM active_effects WHERE id='state'").status,
        'ignored',
      );
      f.db.db.close();
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
test('gamble branches, absolute order and fallback mechanics give exactly the intended nickname paths', async () => {
  for (const id of ['P-LYB-05', 'P-LYB-06'])
    for (const win of [true, false]) {
      const f = setup();
      await f.effects.execute(
        'u',
        judgment(f.db, id, { done: true, choice: id.endsWith('05') ? 'gamble' : 'double', win }),
      );
      assert.equal(f.discord.calls.length, win ? 0 : 1);
    }
  for (const choice of ['apology', 'repeat', 'nickname']) {
    const f = setup();
    const j = judgment(f.db, 'P-REN-06', { done: true, choice });
    await f.effects.execute('u', j);
    assert.equal(f.db.all('SELECT * FROM active_effects').length, 1);
    assert.equal(f.discord.calls.length, 1);
  }
  for (const id of ['P-LYB-04', 'P-LYB-07']) {
    const f = setup();
    if (id.endsWith('04')) f.effects.grant('u', 'free_reroll', 24, 'x');
    else await f.effects.execute('u', judgment(f.db, 'H-LYB-02'));
    const calls = f.discord.calls.length;
    await f.effects.execute('u', judgment(f.db, id));
    assert.equal(f.discord.calls.length, calls);
    if (id.endsWith('04')) assert.ok(!f.effects.tokens('u').includes('free_reroll'));
    else assert.equal(f.effects.active('u')[0].expires_at - f.time.now, 1.5 * 3600000);
  }
});
test('double reward extends existing nickname up to 12h, empty reward grants reroll; expiry and manual edits stay safe', async () => {
  const f = setup();
  await f.effects.execute('u', judgment(f.db, 'H-TAT-01'));
  await f.effects.execute('u', judgment(f.db, 'H-LYB-06'));
  assert.equal(f.effects.active('u')[0].expires_at - f.time.now, 12 * 3600000);
  f.discord.members.get('u')!.nickname = '我自己改的';
  await f.effects.execute('u', judgment(f.db, 'P-REN-07'));
  assert.equal((await f.discord.member('u')).nickname, '我自己改的');
  f.time.advance(13 * 3600000);
  await f.effects.tick();
  assert.equal((await f.discord.member('u')).nickname, '我自己改的');
  const g = setup();
  await g.effects.execute('u', judgment(g.db, 'H-LYB-06'));
  assert.ok(g.effects.tokens('u').includes('free_reroll'));
  const h = setup();
  await h.discord.member('u');
  h.discord.members.get('u')!.nickname = 'zero';
  const j = judgment(h.db, 'P-TAT-02');
  await h.effects.execute('u', j);
  assert.equal((await h.discord.member('u')).nickname, 'zero的屁股被龙卷踢了');
  await new ChannelPosts(h.db, h.discord, 'https://test.invalid').result(
    h.db.get('SELECT * FROM sessions WHERE id=?', j.session_id),
    h.db.get('SELECT * FROM judgments WHERE id=?', j.id),
  );
  const embed = JSON.stringify(h.discord.posts);
  assert.ok(embed.includes('zero的屁股被龙卷踢了'));
  assert.ok(!embed.includes('{name}'));
  assert.ok(!embed.includes('内部状态'));
  h.time.advance(3 * 3600000);
  await h.effects.tick();
  assert.equal((await h.discord.member('u')).nickname, 'zero');
  assert.ok(!/内部状态|状态栏|状态徽章/.test(readFileSync('client/main.tsx', 'utf8')));
});

test('ack rituals gate Discord writes until final confirmation; legacy prefix plans execute and restore', async () => {
  for (const [card, total] of [
    ['P-TAT-07', 3],
    ['P-REN-03', 1],
  ] as const) {
    const f = setup();
    const j = judgment(f.db, card, {});
    const actor = { user: 'u', nun: false, identity: 'confessor' };
    await assert.rejects(
      () => f.service.command(actor, randomUUID(), 'execute', { judgment: j.id }),
      /仪式/,
    );
    for (let n = 1; n <= total; n++) {
      await f.service.command(actor, randomUUID(), 'interact', { judgment: j.id, choice: 'ack' });
      assert.equal(f.discord.calls.length, 0);
      if (n < total)
        await assert.rejects(
          () => f.service.command(actor, randomUUID(), 'execute', { judgment: j.id }),
          /仪式/,
        );
    }
    await f.service.command(actor, randomUUID(), 'execute', { judgment: j.id });
    assert.equal(f.discord.calls.length, 1);
  }
  const f = setup();
  const j = judgment(f.db, 'P-TAT-02');
  j.plan = JSON.stringify({
    actions: [{ kind: 'nickname', value: '旧前缀', hours: 2 }],
    notes: [],
  });
  f.db.run('UPDATE judgments SET plan=? WHERE id=?', j.plan, j.id);
  await f.effects.execute('u', j);
  assert.equal((await f.discord.member('u')).nickname, '旧前缀原昵称');
  f.time.advance(3 * 3600000);
  await f.effects.tick();
  assert.equal((await f.discord.member('u')).nickname, '原昵称');
});
