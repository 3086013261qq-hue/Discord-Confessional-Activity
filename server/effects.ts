import { randomUUID } from 'node:crypto';
import type { Action, Card } from '../shared/types.js';
import { Store, Locks } from './db.js';
import type { DiscordPort } from './discord.js';
import { byId, details, rank, roll } from './cards.js';
export const locks = new Locks();
export function safeNickname(prefix: string, original: string, max = 32) {
  const size = (s: string) => s.length;
  let out = '';
  const seg = new Intl.Segmenter('zh', { granularity: 'grapheme' });
  if (size(prefix) > max) throw Error('PREFIX_TOO_LONG');
  if (size(prefix + original) <= max) return prefix + original;
  for (const { segment } of seg.segment(original)) {
    if (size(prefix + out + segment + '…') > max) break;
    out += segment;
  }
  return prefix + out + (size(prefix) < max ? '…' : '');
}
export interface Plan {
  actions: Action[];
  cleanse?: { max: number; character?: string; kind?: string; limit?: number; roleLimit?: number };
  special?: string;
  secondary?: string;
  notes: string[];
  cleanseIds?: string[];
  immunityGrant?: boolean;
  failureTitle?: string;
  secondarySpecial?: string;
  specialTarget?: string;
  specialNewExpiry?: number;
}
export class Effects {
  constructor(
    public db: Store,
    private discord: DiscordPort,
    private rng = roll,
    private now = Date.now,
  ) {}
  tokens(user: string) {
    return this.db
      .all('SELECT key FROM tokens WHERE user_id=? AND expires_at>?', user, this.now())
      .map((r) => r.key as string);
  }
  grant(user: string, key: string, hours: number, judgment: string) {
    this.db.run(
      'INSERT INTO tokens VALUES(?,?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET expires_at=excluded.expires_at,judgment_id=excluded.judgment_id',
      user,
      key,
      this.now() + hours * 3600000,
      judgment,
    );
  }
  consume(user: string, key: string) {
    return (
      this.db.run(
        'DELETE FROM tokens WHERE user_id=? AND key=? AND expires_at>?',
        user,
        key,
        this.now(),
      ).changes > 0
    );
  }
  active(user: string) {
    return this.db.all(
      "SELECT * FROM active_effects WHERE user_id=? AND status IN ('planned','active','restoring','restore_blocked') ORDER BY created_at",
      user,
    );
  }
  build(card: Card, j: any): Plan {
    const p: Plan = { actions: structuredClone(details[card.id].actions), notes: [] };
    const i = JSON.parse(j.interaction || '{}');
    const registry: Record<string, () => void> = {
      cleanse_or_immunity_r: () => {
        p.cleanse = { max: 3, kind: 'nickname', limit: 1 };
        p.special = 'immunity_if_none';
      },
      cleanse_tatsumaki_r: () => {
        p.cleanse = { max: 1 };
      },
      cleanse_ren_r_sr: () => {
        p.cleanse = { max: 2, character: 'ren_yamashiro', roleLimit: 1 };
      },
      cleanse_one_r_sr_punishment: () => {
        p.special = 'cleanse_one_nickname_first';
      },
      compound_tatsumaki_ssr_blessing: () => {
        p.cleanse = { max: 3 };
      },
      compound_ren_ssr_blessing: () => {
        p.cleanse = { max: 2, character: 'ren_yamashiro' };
      },
      compound_yuzuha_ssr_jackpot: () => {
        p.cleanse = { max: 2 };
      },
      compound_tatsumaki_ssr_punishment: () => {
        p.secondary = this.secondary('tatsumaki', 'reversed');
        p.failureTitle = '龙卷今天真的很生气';
      },
      compound_extra_yuzuha_r_heaven: () => {
        p.secondary = this.secondary('yuzuha_lee', 'upright');
      },
      compound_yuzuha_ssr_house_wins: () => {
        p.secondary = this.secondary('yuzuha_lee', 'reversed');
        if (i.choice === 'plead') p.actions.forEach((a) => (a.hours = 8));
      },
      compound_ren_ssr_bow_or_plead: () => {
        if (i.choice === 'plead_confirm')
          p.actions = details['P-REN-07'].actions.map((a) => ({ ...a, hours: 8 }));
      },
      interaction_absolute_order_three_choices: () => {
        if (i.choice === 'nickname') {
          const id = this.pick(['P-REN-02', 'P-REN-04']);
          p.actions.push(...structuredClone(details[id].actions));
        }
      },
      interaction_one_more_round_50_50: () => {
        p.actions = [];
        if (i.choice === 'coward')
          p.actions.push({ kind: 'state', value: '😼 李柚巴认证·怂了', hours: 2 });
        else if (!i.win)
          p.actions.push(
            { kind: 'nickname', value: '刚输给李柚巴的', hours: 2 },
            { kind: 'state', value: '🎲 赌债未清', hours: 3 },
          );
        p.notes.push(
          i.choice === 'coward'
            ? '已选择我怂了'
            : i.win
              ? '50/50：赢，本牌实体刑罚归零'
              : '50/50：输，执行一次基础刑罚',
        );
      },
      interaction_double_or_nothing_server_rng: () => {
        p.actions = [];
        if (i.choice !== 'double')
          p.actions.push({ kind: 'state', value: '🎲 赌债未清', hours: 4 });
        else if (!i.win)
          p.actions.push(
            { kind: 'nickname', value: '输给李柚巴两次的', hours: 6 },
            { kind: 'state', value: '🎲 双倍赌债', hours: 6 },
          );
        p.notes.push(
          i.choice !== 'double'
            ? '维持基础刑罚'
            : i.win
              ? '50/50：赢，实体刑罚归零'
              : '50/50：输，执行双倍赌债',
        );
      },
      state_remove_luck_or_bad_hand_role: () => {
        p.special = 'remove_luck';
      },
      state_dealer_cut: () => {
        p.special = 'dealer_cut';
      },
      state_double_reward_duration: () => {
        p.special = 'double_reward';
      },
    };
    registry[card.effect_key]?.();
    if (p.secondary) {
      const secondary = byId.get(p.secondary)!;
      let acts = structuredClone(details[secondary.id].actions);
      if (card.alignment === 'reversed')
        acts = acts
          .filter((a) => a.kind !== 'nickname')
          .map((a) => ({ ...a, hours: card.character === 'tatsumaki' ? 2 : a.hours }));
      if (secondary.effect_key === 'state_remove_luck_or_bad_hand_role')
        p.secondarySpecial = 'remove_luck';
      p.actions.push(...acts);
      p.notes.push('副牌：' + secondary.name + '（不再追加副抽或二次赌局）');
    }
    return p;
  }
  pick<T>(values: T[]) {
    return values[Math.floor(this.rng() * values.length)];
  }
  secondary(character: string, alignment: string) {
    return this.pick(
      [...byId.values()].filter(
        (c) => c.character === character && c.alignment === alignment && c.rarity === 'R',
      ),
    ).id;
  }
  async execute(user: string, j: any) {
    const card = byId.get(j.card_id)!;
    if (j.plan) {
      const legacy = JSON.parse(j.plan);
      for (const a of legacy.actions) if (a.kind === 'role') a.kind = 'state';
      this.db.run('UPDATE judgments SET plan=? WHERE id=?', JSON.stringify(legacy), j.id);
      j.plan = JSON.stringify(legacy);
    }
    if (j.report) return JSON.parse(j.report) as string[];
    let plan: Plan;
    if (j.plan) plan = JSON.parse(j.plan);
    else {
      plan = this.build(card, j); // Persist all random branches before any Discord write.
      this.db.run(
        "UPDATE judgments SET plan=?,execution_status='executing' WHERE id=?",
        JSON.stringify(plan),
        j.id,
      );
    }
    const notes = [...plan.notes];
    // Durable gate and special mutations occur once, in one local transaction. External writes have separate durable intents.
    if (!this.db.get('SELECT value FROM metadata WHERE key=?', 'prepared:' + j.id)) {
      const active = this.active(user);
      let blocked = false;
      this.db.tx(() => {
        if (card.alignment === 'reversed') {
          const tokens = this.tokens(user);
          const protection =
            card.rarity !== 'SSR' &&
            [
              'storm_protection',
              'jackpot_protection',
              ...(card.character === 'ren_yamashiro' ? ['ren_protection'] : []),
            ].find((k) => tokens.includes(k));
          if (protection) {
            this.consume(user, protection);
            blocked = true;
          } else if (card.rarity === 'R' && tokens.includes('lucky_chip')) {
            this.consume(user, 'lucky_chip');
            blocked = true;
          }
          if (
            !blocked &&
            card.rarity === 'R' &&
            plan.actions.some((a) => a.kind === 'nickname') &&
            this.consume(user, 'immunity_r')
          ) {
            plan.actions = plan.actions.filter((a) => a.kind !== 'nickname');
            notes.push('免罚印记抵消 R 级昵称刑罚');
          }
        }
        if (blocked) {
          plan.actions = plan.actions.filter((a) => a.kind === 'token');
          plan.special = undefined;
          plan.secondarySpecial = undefined;
          notes.push('保护已消耗：仅保留判词与演出，不执行实体刑罚');
        }
        if (plan.special === 'remove_luck' || plan.secondarySpecial === 'remove_luck') {
          const available = this.tokens(user).filter((k) =>
            ['lucky_chip', 'free_reroll', 'hell_reroll_token'].includes(k),
          );
          if (available.length) this.consume(user, this.pick(available));
          else plan.actions.push({ kind: 'state', value: '🪙 今日手气欠佳', hours: 3 });
        }
        if (plan.cleanse) {
          const f = plan.cleanse;
          let roleCount = 0;
          plan.cleanseIds = active
            .filter((e) => {
              const c = byId.get(e.card_id)!;
              return (
                c.alignment === 'reversed' &&
                rank[c.rarity] <= f.max &&
                (!f.character || c.character === f.character) &&
                (!f.kind || e.kind === f.kind) &&
                (!f.roleLimit || e.kind !== 'state' || roleCount++ < f.roleLimit)
              );
            })
            .slice(0, f.limit ?? Infinity)
            .map((e) => e.id);
        }
        if (plan.special === 'immunity_if_none') plan.immunityGrant = !plan.cleanseIds?.length;
        if (plan.special === 'cleanse_one_nickname_first') {
          const all = active.filter((e) => {
            const c = byId.get(e.card_id)!;
            return c.alignment === 'reversed' && rank[c.rarity] <= 2;
          });
          const e = all.find((e) => e.kind === 'nickname') || all.find((e) => e.kind === 'state');
          plan.cleanseIds = e ? [e.id] : [];
        }
        if (card.alignment === 'upright' && card.rarity !== 'R')
          plan.cleanseIds = [
            ...new Set([
              ...(plan.cleanseIds || []),
              ...active
                .filter(
                  (e) =>
                    e.card_id === 'P-TAT-08' ||
                    (e.card_id === 'P-REN-08' && card.character === 'ren_yamashiro'),
                )
                .map((e) => e.id),
            ]),
          ];
        if (plan.special === 'dealer_cut') {
          const positive = active.filter((e) => byId.get(e.card_id)!.alignment === 'upright');
          const target =
            positive.find((e) => e.kind === 'state' && byId.get(e.card_id)!.rarity === 'R') ||
            positive.find(
              (e) => rank[byId.get(e.card_id)!.rarity] <= 2 && e.expires_at - this.now() > 1800000,
            );
          if (target) {
            plan.specialTarget = target.id;
            if (!(target.kind === 'state' && byId.get(target.card_id)!.rarity === 'R'))
              plan.specialNewExpiry =
                this.now() + Math.max(1800000, (target.expires_at - this.now()) / 2);
          }
        }
        this.db.run('INSERT INTO metadata VALUES(?,?)', 'prepared:' + j.id, '1');
        plan.notes = notes;
        this.db.run('UPDATE judgments SET plan=? WHERE id=?', JSON.stringify(plan), j.id);
      });
    }
    plan = JSON.parse(this.db.get<any>('SELECT plan FROM judgments WHERE id=?', j.id)!.plan);
    notes.splice(0, notes.length, ...plan.notes);
    let degraded = false;
    try {
      for (const id of plan.cleanseIds || []) {
        const e = this.db.get<any>('SELECT * FROM active_effects WHERE id=?', id);
        if (e) await this.restore(e);
      }
      if (!this.db.get('SELECT 1 FROM metadata WHERE key=?', 'special:' + j.id)) {
        if (
          plan.special === 'dealer_cut' &&
          plan.specialTarget &&
          plan.specialNewExpiry === undefined
        ) {
          const e = this.db.get<any>('SELECT * FROM active_effects WHERE id=?', plan.specialTarget);
          if (e) await this.restore(e);
        }
        this.db.tx(() => {
          if (plan.special === 'immunity_if_none' && plan.immunityGrant)
            this.grant(user, 'immunity_r', 24, j.id);
          if (
            plan.special === 'dealer_cut' &&
            plan.specialTarget &&
            plan.specialNewExpiry !== undefined
          )
            this.db.run(
              'UPDATE active_effects SET expires_at=? WHERE id=?',
              plan.specialNewExpiry,
              plan.specialTarget,
            );
          if (plan.special === 'double_reward') {
            const eligible = plan.actions.filter(
              (a) => a.kind === 'nickname' || a.kind === 'state',
            );
            if (!eligible.length) this.grant(user, 'free_reroll', 24, j.id);
            else {
              for (const a of eligible)
                a.hours = Math.min(a.hours * 2, a.kind === 'nickname' ? 12 : 24);
              this.db.run('UPDATE judgments SET plan=? WHERE id=?', JSON.stringify(plan), j.id);
            }
          }
          this.db.run('INSERT INTO metadata VALUES(?,?)', 'special:' + j.id, '1');
        });
      }
    } catch (e) {
      degraded = true;
      notes.push('恢复/特殊效果失败，后台将重试：' + this.error(e));
    }
    for (let index = 0; index < plan.actions.length; index++) {
      const action = plan.actions[index];
      const key = card.effect_key + ':' + index;
      try {
        const result = await this.apply(user, j, card, key, action);
        notes.push(result);
        if (result.includes('未执行')) degraded = true;
      } catch (e) {
        degraded = true;
        notes.push(
          '服务器效果未执行，已转为忏悔室内部称号：' + action.value + '（' + this.error(e) + '）',
        );
      }
    }
    if (degraded && plan.failureTitle) notes.push('忏悔室内部称号：' + plan.failureTitle);
    const status = degraded ? 'degraded' : 'executed';
    this.db.run(
      'UPDATE judgments SET execution_status=?,report=? WHERE id=?',
      status,
      JSON.stringify(notes.length ? notes : ['Activity 状态已结算']),
      j.id,
    );
    this.db.run("UPDATE sessions SET status='SETTLED' WHERE id=?", j.session_id);
    return notes.length ? notes : ['Activity 状态已结算'];
  }
  error(e: unknown) {
    return e instanceof Error ? e.message.slice(0, 100) : 'UNKNOWN_ERROR';
  }
  async apply(user: string, j: any, card: Card, key: string, a: Action) {
    if (a.kind === 'token') {
      this.db.tx(() => {
        if (!this.db.get('SELECT 1 FROM metadata WHERE key=?', 'token:' + j.id + ':' + key)) {
          this.grant(user, a.value, a.hours, j.id);
          this.db.run('INSERT INTO metadata VALUES(?,?)', 'token:' + j.id + ':' + key, '1');
        }
      });
      return '已获得状态：' + a.value;
    }
    let e = this.db.get<any>(
      'SELECT * FROM active_effects WHERE judgment_id=? AND effect_key=? AND kind=?',
      j.id,
      key,
      a.kind,
    );
    if (
      e &&
      ['active', 'restored', 'superseded', 'manual_changed', 'preexisting'].includes(e.status)
    )
      return `已结算：${e.applied_value} · ${a.hours}h`;
    if (!e) {
      let original: any = null,
        applied: any = a.value;
      if (a.kind === 'nickname') {
        const old = this.active(user).find((v) => v.kind === 'nickname');
        if (old) {
          const oc = byId.get(old.card_id)!;
          if (old.expires_at > this.now() && rank[oc.rarity] > rank[card.rarity])
            return '已保留更高优先级昵称；内部称号：' + a.value;
          await this.restore(old);
          this.db.run("UPDATE active_effects SET status='superseded' WHERE id=?", old.id);
        }
        const fresh = await this.discord.member(user);
        original = fresh.nickname;
        applied = safeNickname(a.value, fresh.nickname ?? fresh.display);
      }

      e = {
        id: randomUUID(),
        user_id: user,
        judgment_id: j.id,
        card_id: card.id,
        effect_key: key,
        kind: a.kind,
        original_value: JSON.stringify(original),
        applied_value: applied,
        expires_at: this.now() + a.hours * 3600000,
        status: 'planned',
        created_at: this.now(),
      };
      this.db.run(
        'INSERT INTO active_effects(id,user_id,judgment_id,card_id,effect_key,kind,original_value,applied_value,expires_at,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        e.id,
        user,
        j.id,
        card.id,
        key,
        a.kind,
        e.original_value,
        applied,
        e.expires_at,
        'planned',
        e.created_at,
      );
    }
    if (e.expires_at <= this.now()) {
      await this.restore(e);
      return '效果已到期，服务器效果未执行：' + a.value;
    }
    try {
      if (e.kind === 'nickname') {
        const m = await this.discord.member(user);
        if (m.nickname !== e.applied_value) {
          if (m.nickname !== JSON.parse(e.original_value)) {
            this.db.run("UPDATE active_effects SET status='manual_changed' WHERE id=?", e.id);
            return '昵称未执行：用户已自行改名，保留新昵称';
          }
          await this.discord.nickname(user, e.applied_value);
        }
      }
      this.db.run("UPDATE active_effects SET status='active',last_error=NULL WHERE id=?", e.id);
      return `${a.kind === 'nickname' ? '服务器昵称' : '内部状态'}已执行：${e.applied_value} · ${a.hours}h`;
    } catch (err) {
      this.db.run('UPDATE active_effects SET last_error=? WHERE id=?', this.error(err), e.id);
      throw err;
    }
  }
  async restore(e: any) {
    if (e.kind === 'role') {
      this.db.run("UPDATE active_effects SET status='legacy_retired' WHERE id=?", e.id);
      return;
    }
    if (['restored', 'manual_changed', 'superseded', 'legacy_retired'].includes(e.status)) return;
    this.db.run("UPDATE active_effects SET status='restoring' WHERE id=?", e.id);
    try {
      let status = 'restored';
      if (e.kind === 'nickname') {
        const m = await this.discord.member(e.user_id);
        if (m.nickname === e.applied_value)
          await this.discord.nickname(e.user_id, JSON.parse(e.original_value));
        else status = 'manual_changed';
      }
      this.db.run('UPDATE active_effects SET status=?,last_error=NULL WHERE id=?', status, e.id);
    } catch (err) {
      const error = this.error(err);
      if (/Unknown Member|10007/.test(error))
        this.db.run(
          "UPDATE active_effects SET status='restored',last_error=? WHERE id=?",
          error,
          e.id,
        );
      else {
        const attempts = (e.retry_count || 0) + 1;
        this.db.run(
          'UPDATE active_effects SET last_error=?,retry_count=?,next_retry_at=?,status=? WHERE id=?',
          error,
          attempts,
          this.now() + Math.min(6 * 3600000, 15000 * 2 ** attempts),
          attempts >= 8 ? 'restore_blocked' : 'restoring',
          e.id,
        );
      }
      throw err;
    }
  }
  async tick() {
    for (const row of this.db.all<{ user_id: string }>(
      "SELECT DISTINCT user_id FROM active_effects WHERE (expires_at<=? OR status='restoring') AND next_retry_at<=? AND status IN ('active','planned','restoring')",
      this.now(),
      this.now(),
    ))
      await locks.use(row.user_id, async () => {
        for (const e of this.active(row.user_id).filter(
          (e) =>
            (e.expires_at <= this.now() || e.status === 'restoring') &&
            e.status !== 'restore_blocked' &&
            e.next_retry_at <= this.now(),
        ))
          try {
            await this.restore(e);
          } catch {
            /* persisted error; next bounded tick retries */
          }
      });
    for (const j of this.db.all(
      "SELECT j.*,s.user_id FROM judgments j JOIN sessions s ON s.id=j.session_id WHERE j.execution_status='executing' AND s.user_id IS NOT NULL",
    ))
      await locks.use(j.user_id, async () => {
        await this.execute(j.user_id, j);
      });
    this.db.run('DELETE FROM tokens WHERE expires_at<=?', this.now());
    this.db.run('DELETE FROM auth_tokens WHERE expires_at<=?', this.now());
  }
}
