import { randomUUID, randomInt, createHash } from 'node:crypto';
import { Store } from './db.js';
import { Effects, locks } from './effects.js';
import { byId, draw, details, manifest, artUrls, roll } from './cards.js';
import type { PublicJudgment, Snapshot, Verdict } from '../shared/types.js';
export interface Actor {
  user: string;
  nun: boolean;
}
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireThat(ok: unknown, message: string, status = 409): asserts ok {
  if (!ok) throw new AppError(status, message);
}
export class Service {
  constructor(
    public db: Store,
    public effects: Effects,
    private rng = roll,
    private now = Date.now,
  ) {}
  session(actor: Actor, id: string) {
    const s = this.db.get<any>('SELECT * FROM sessions WHERE id=?', id);
    requireThat(s, '会话不存在', 404);
    requireThat(
      actor.nun ? s.nun_id === actor.user : s.user_id === actor.user,
      '没有此会话权限',
      403,
    );
    return s;
  }
  owned(actor: Actor, id: string) {
    const j = this.db.get<any>('SELECT * FROM judgments WHERE id=?', id);
    requireThat(j, '判决不存在', 404);
    const s = this.session(actor, j.session_id);
    requireThat(!actor.nun && s.user_id === actor.user, '只有忏悔者可以操作判决', 403);
    return { j, s };
  }
  publicJudgment(j: any): PublicJudgment {
    const c = byId.get(j.card_id)!;
    const reveal = j.selected_index !== null;
    const ssr = manifest.ssr_animations[c.id];
    return {
      id: j.id,
      verdict: j.verdict,
      character: c.character,
      rarity: c.rarity,
      animation_key: ssr?.key || manifest.characters[c.character].summon_animation,
      sequence: ssr?.sequence || [],
      selected_index: j.selected_index,
      revealed_at: j.revealed_at,
      created_at: j.created_at,
      execution_status: j.execution_status,
      interaction: JSON.parse(j.interaction),
      rerolled: j.rerolled,
      ...(reveal ? { card: c, detail: details[c.id], art_urls: artUrls(c) } : {}),
      ...(j.report ? { report: JSON.parse(j.report) } : {}),
    };
  }
  snapshot(actor: Actor, id?: string): Snapshot {
    const sessions = actor.nun
      ? this.db.all(
          "SELECT id,anonymous_id,status FROM sessions WHERE closed_at IS NULL AND (status='QUEUED' OR nun_id=?) ORDER BY priority DESC,created_at",
          actor.user,
        )
      : [];
    let s;
    if (id && !this.db.get<any>('SELECT closed_at FROM sessions WHERE id=?', id)?.closed_at)
      s = this.session(actor, id);
    else if (!actor.nun)
      s = this.db.get<any>(
        'SELECT * FROM sessions WHERE user_id=? AND closed_at IS NULL',
        actor.user,
      );
    const session = s ? { id: s.id, anonymous_id: s.anonymous_id, status: s.status } : undefined;
    const messages = s
      ? this.db.all(
          'SELECT id,sender_type,type,content,created_at FROM messages WHERE session_id=? ORDER BY created_at,rowid',
          s.id,
        )
      : [];
    const j =
      s &&
      this.db.get<any>(
        "SELECT * FROM judgments WHERE session_id=? AND execution_status!='superseded'",
        s.id,
      );
    const notices: string[] = [];
    if (!actor.nun) {
      const ids = this.effects
        .active(actor.user)
        .filter((e) => e.expires_at > this.now())
        .map((e) => e.card_id);
      if (ids.includes('P-TAT-08')) notices.push('龙卷还记得你。');
      if (ids.includes('P-REN-08')) notices.push('修女长还记得上一次。');
      if (ids.includes('P-LYB-02')) notices.push('李柚巴还记得这笔账。');
    }
    return {
      role: actor.nun ? 'nun' : 'confessor',
      sessions,
      session,
      messages,
      judgment: j ? this.publicJudgment(j) : undefined,
      tokens: actor.nun ? [] : this.effects.tokens(actor.user),
      notices,
    };
  }
  message(id: string, sender: string, type: string, content: string) {
    this.db.run(
      'INSERT INTO messages VALUES(?,?,?,?,?,?)',
      randomUUID(),
      id,
      sender,
      type,
      content,
      this.now(),
    );
  }
  async command(actor: Actor, requestId: string, op: string, data: any) {
    requireThat(/^[a-zA-Z0-9-]{8,100}$/.test(requestId), '需要有效 request id', 400);
    const lockUser =
      data.id && op !== 'claim' && op !== 'start'
        ? this.db.get<any>('SELECT user_id FROM sessions WHERE id=?', data.id)?.user_id
        : undefined;
    // Serialize all user-affecting actions with effect expiry and execution, including nun verdicts.
    return locks.use(lockUser || actor.user, async () => {
      const fingerprint = createHash('sha256')
        .update(op + JSON.stringify(data))
        .digest('hex');
      const cached = this.db.get<any>(
        'SELECT * FROM requests WHERE user_id=? AND request_id=?',
        actor.user,
        requestId,
      );
      if (cached) {
        requireThat(cached.operation === fingerprint, 'request id 已用于其他操作', 409);
        return JSON.parse(cached.response);
      }
      let result: any = { ok: true };
      switch (op) {
        case 'start': {
          requireThat(!actor.nun, '修女请使用修女席', 403);
          const old = this.db.get<any>(
            'SELECT id FROM sessions WHERE user_id=? AND closed_at IS NULL',
            actor.user,
          );
          if (old) {
            result = { id: old.id };
            break;
          }
          const used = new Set(
            this.db
              .all('SELECT anonymous_id FROM sessions WHERE closed_at IS NULL')
              .map((s) => s.anonymous_id),
          );
          let n = randomInt(1, 1000),
            tries = 0;
          while (used.has('迷途灵魂 #' + String(n).padStart(3, '0')) && tries++ < 999)
            n = (n % 999) + 1;
          requireThat(tries < 999, '忏悔室已满');
          const id = randomUUID(),
            anon = '迷途灵魂 #' + String(n).padStart(3, '0');
          this.db.tx(() => {
            const priority = Number(this.effects.consume(actor.user, 'priority_confession'));
            this.db.run(
              'INSERT INTO sessions(id,anonymous_id,user_id,status,priority,created_at) VALUES(?,?,?,?,?,?)',
              id,
              anon,
              actor.user,
              'QUEUED',
              priority,
              this.now(),
            );
          });
          result = { id };
          break;
        }
        case 'claim': {
          requireThat(actor.nun, '只限修女', 403);
          const s = this.db.get<any>('SELECT * FROM sessions WHERE id=?', data.id);
          requireThat(s && !s.closed_at, '会话已关闭');
          requireThat(s.status === 'QUEUED' || s.nun_id === actor.user, '会话已由其他修女接待');
          requireThat(
            !this.db.get(
              'SELECT 1 FROM sessions WHERE nun_id=? AND closed_at IS NULL AND id!=?',
              actor.user,
              data.id,
            ),
            '请先结束当前会话',
          );
          this.db.run(
            "UPDATE sessions SET nun_id=?,status='CONFESSING' WHERE id=? AND (nun_id IS NULL OR nun_id=?)",
            actor.user,
            s.id,
            actor.user,
          );
          result = { id: s.id };
          break;
        }
        case 'message': {
          const s = this.session(actor, data.id);
          requireThat(s.status === 'CONFESSING', '当前无法发送消息');
          const type = data.type === 'sticker' ? 'sticker' : 'text';
          const content = String(data.content || '').trim();
          requireThat(
            type === 'sticker'
              ? /^nun_(0[1-9]|1[0-6])$/.test(content)
              : content.length > 0 && content.length <= 2000,
            '消息格式无效',
            400,
          );
          this.message(s.id, actor.nun ? 'nun' : 'confessor', type, content);
          break;
        }
        case 'verdict': {
          requireThat(actor.nun, '只限修女', 403);
          const s = this.session(actor, data.id);
          const old = this.db.get<any>(
            "SELECT id FROM judgments WHERE session_id=? AND execution_status!='superseded'",
            s.id,
          );
          if (old) {
            result = { id: old.id };
            break;
          }
          requireThat(s.status === 'CONFESSING', '会话状态无效');
          requireThat(['heaven', 'hell'].includes(data.verdict), '裁决无效', 400);
          const { card, audit } = draw(data.verdict, this.rng);
          const id = randomUUID();
          this.db.tx(() => {
            this.db.run(
              'INSERT INTO judgments(id,session_id,verdict,card_id,rng,created_at) VALUES(?,?,?,?,?,?)',
              id,
              s.id,
              data.verdict,
              card.id,
              JSON.stringify(audit),
              this.now(),
            );
            this.db.run("UPDATE sessions SET status='ANIMATION' WHERE id=?", s.id);
          });
          result = { id };
          break;
        }
        case 'animation_done': {
          const { j, s } = this.owned(actor, data.judgment);
          if (s.status === 'ANIMATION')
            this.db.run("UPDATE sessions SET status='CARD_CHOICE' WHERE id=?", s.id);
          result = { id: j.id };
          break;
        }
        case 'choose': {
          const { j, s } = this.owned(actor, data.judgment);
          if (j.selected_index !== null) break;
          requireThat(s.status === 'CARD_CHOICE', '演出尚未结束');
          requireThat(
            Number.isInteger(data.index) && data.index >= 0 && data.index < 5,
            '请选择一张牌',
            400,
          );
          this.db.tx(() => {
            this.db.run(
              'UPDATE judgments SET selected_index=?,revealed_at=? WHERE id=?',
              data.index,
              this.now(),
              j.id,
            );
            this.db.run("UPDATE sessions SET status='REVEALED' WHERE id=?", s.id);
          });
          break;
        }
        case 'interact': {
          const { j } = this.owned(actor, data.judgment);
          requireThat(
            j.selected_index !== null && j.execution_status === 'pending',
            '当前无法进行仪式',
          );
          const card = byId.get(j.card_id)!,
            type = details[card.id].interaction;
          requireThat(type, '该牌无需仪式');
          const i = JSON.parse(j.interaction);
          if (i.done) break;
          const choice = String(data.choice || '');
          if (type === 'ack3' || type === 'accept3' || type === 'ack1') {
            requireThat(choice === 'ack', '选项无效');
            i.count = (i.count || 0) + 1;
            i.done = i.count >= (type === 'ack1' ? 1 : 3);
            this.message(
              j.session_id,
              'system',
              'sticker',
              'nun_' + String(i.count + 3).padStart(2, '0'),
            );
          } else if (type === 'command') {
            requireThat(['apology', 'praise', 'nickname', 'repeat'].includes(choice), '选项无效');
            if (choice === 'apology')
              requireThat(
                typeof data.text === 'string' &&
                  [...data.text.trim()].length > 0 &&
                  [...data.text.trim()].length <= 30,
                '请输入 1～30 字的道歉',
                400,
              );
            if (choice === 'praise') {
              requireThat(!i.praise, '赞美已生成');
              const praise = [
                '修女长的判断总是那么从容。',
                '今天也想得到修女长的认可。',
                '您的目光让人不敢敷衍。',
                '我会认真记住您的教诲。',
                '修女长今天也很耀眼。',
              ];
              i.praise = praise[Math.floor(this.rng() * 5)];
            } else {
              requireThat(choice !== 'repeat' || i.praise, '请先取得赞美');
              i.choice = choice;
              i.done = true;
              this.message(j.session_id, 'system', 'sticker', 'nun_08');
            }
          } else if (type === 'bow') {
            if (choice === 'plead') {
              requireThat(!i.pleaded, '宽恕只能请求一次');
              i.pleaded = true;
              this.message(j.session_id, 'system', 'sticker', 'nun_12');
            } else {
              requireThat(['accept', 'plead_confirm'].includes(choice), '选项无效');
              requireThat(choice !== 'plead_confirm' || i.pleaded, '先请求宽恕');
              i.choice = choice;
              i.done = true;
            }
          } else if (type === 'round' || type === 'double') {
            requireThat(
              (type === 'round' ? ['gamble', 'coward'] : ['double', 'keep']).includes(choice),
              '选项无效',
            );
            i.choice = type === 'double' && this.now() > j.revealed_at + 15000 ? 'keep' : choice;
            if (i.choice === 'gamble' || i.choice === 'double') {
              i.rng = this.rng();
              i.win = i.rng < 0.5;
            }
            i.done = true;
            this.message(j.session_id, 'system', 'sticker', i.win ? 'nun_09' : 'nun_12');
          } else if (type === 'house') {
            requireThat(['plead', 'accept'].includes(choice), '选项无效');
            i.choice = choice;
            i.done = true;
            if (choice === 'plead') this.message(j.session_id, 'system', 'sticker', 'nun_12');
          }
          this.db.run('UPDATE judgments SET interaction=? WHERE id=?', JSON.stringify(i), j.id);
          break;
        }
        case 'reroll': {
          const { j, s } = this.owned(actor, data.judgment);
          requireThat(
            j.execution_status === 'pending' && !j.rerolled && j.selected_index !== null,
            '本判决无法重抽',
          );
          const c = byId.get(j.card_id)!;
          const available = this.effects.tokens(actor.user);
          const key = available.find(
            (k) =>
              k === 'free_reroll' ||
              (j.verdict === 'hell' &&
                (k === 'hell_reroll_token' ||
                  (k === 'judgment_redraw_token' && c.rarity !== 'SSR'))),
          );
          requireThat(key, '没有可用重抽状态');
          const { card, audit } = draw(j.verdict, this.rng, c.id);
          const id = randomUUID();
          this.db.tx(() => {
            requireThat(this.effects.consume(actor.user, key), '状态已消耗');
            this.db.run("UPDATE judgments SET execution_status='superseded' WHERE id=?", j.id);
            this.db.run(
              'INSERT INTO judgments(id,session_id,verdict,card_id,rng,created_at,rerolled) VALUES(?,?,?,?,?,?,1)',
              id,
              s.id,
              j.verdict,
              card.id,
              JSON.stringify(audit),
              this.now(),
            );
            this.db.run("UPDATE sessions SET status='ANIMATION' WHERE id=?", s.id);
          });
          break;
        }
        case 'execute': {
          const { j, s } = this.owned(actor, data.judgment);
          requireThat(j.selected_index !== null, '请先亲手选牌');
          if (j.report) break;
          const c = byId.get(j.card_id)!,
            type = details[c.id].interaction;
          let i = JSON.parse(j.interaction);
          if (type && !i.done) {
            if (type === 'double' && this.now() >= j.revealed_at + 15000) {
              i = { choice: 'keep', done: true };
            } else if (
              c.rarity === 'R' &&
              c.character === 'ren_yamashiro' &&
              this.effects.consume(actor.user, 'command_skip_token')
            )
              i = { done: true, skipped: true };
            else throw new AppError(409, '请先完成牌面仪式');
            this.db.run('UPDATE judgments SET interaction=? WHERE id=?', JSON.stringify(i), j.id);
            j.interaction = JSON.stringify(i);
          }
          this.db.run("UPDATE sessions SET status='EXECUTING' WHERE id=?", s.id);
          await this.effects.execute(actor.user, j);
          break;
        }
        case 'close': {
          const s = this.session(actor, data.id);
          requireThat(
            !['EXECUTING', 'ANIMATION', 'CARD_CHOICE', 'REVEALED'].includes(s.status),
            '请先完成本次判决',
          );
          this.db.tx(() => {
            this.db.run(
              "UPDATE sessions SET status='CLOSED',closed_at=?,user_id=NULL,nun_id=NULL WHERE id=?",
              this.now(),
              s.id,
            );
            this.db.run('DELETE FROM messages WHERE session_id=?', s.id);
            this.db.run('DELETE FROM requests WHERE user_id=?', s.user_id);
          });
          break;
        }
        default:
          throw new AppError(404, '未知操作');
      }
      this.db.run(
        'INSERT INTO requests VALUES(?,?,?,?)',
        actor.user,
        requestId,
        fingerprint,
        JSON.stringify(result),
      );
      return result;
    });
  }
}
