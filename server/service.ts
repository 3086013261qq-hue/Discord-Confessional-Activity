import { randomUUID, randomInt, createHash } from 'node:crypto';
import { Store } from './db.js';
import { Effects, locks } from './effects.js';
import { byId, draw, details, manifest, artUrls, roll } from './cards.js';
import type { AIPort } from './ai.js';
import type { ChannelPosts } from './channel.js';
import type { PublicJudgment, Snapshot, Verdict } from '../shared/types.js';
export interface Actor {
  user: string;
  nun: boolean;
  identity?: string;
  scope?: string;
  instance?: string;
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
    private channel?: Pick<ChannelPosts, 'poll' | 'result' | 'pollUrl'>,
    private ai?: AIPort,
  ) {}
  private connections = new Map<string, number>();
  identity(actor: Actor): string {
    return (
      this.db.get<any>(
        'SELECT value FROM metadata WHERE key=?',
        'identity:' + (actor.scope || actor.user),
      )?.value ||
      actor.identity ||
      'identity_select'
    );
  }
  asActor(actor: Actor): Actor {
    let identity = this.identity(actor);
    if (identity === 'nun' && !actor.nun) identity = 'identity_select';
    return {
      ...actor,
      identity,
      nun: actor.nun && identity === 'nun',
      instance: actor.instance || 'default',
    };
  }
  connected(actor: Actor) {
    this.connections.set(actor.user, (this.connections.get(actor.user) || 0) + 1);
    this.db.run('UPDATE sessions SET confessor_disconnected_at=NULL WHERE user_id=?', actor.user);
    this.db.run('UPDATE sessions SET nun_disconnected_at=NULL WHERE nun_id=?', actor.user);
  }
  disconnected(actor: Actor) {
    const count = Math.max(0, (this.connections.get(actor.user) || 0) - 1);
    this.connections.set(actor.user, count);
    if (count) return;
    this.db.run(
      'UPDATE sessions SET confessor_disconnected_at=? WHERE user_id=? AND closed_at IS NULL',
      this.now(),
      actor.user,
    );
    this.db.run(
      'UPDATE sessions SET nun_disconnected_at=? WHERE nun_id=? AND closed_at IS NULL',
      this.now(),
      actor.user,
    );
  }
  recoverPresence() {
    this.db.run(
      'UPDATE sessions SET confessor_disconnected_at=?,nun_disconnected_at=? WHERE closed_at IS NULL',
      this.now(),
      this.now(),
    );
  }
  closeSession(s: any) {
    this.db.tx(() => {
      this.db.run(
        "UPDATE sessions SET status='CLOSED',closed_at=?,user_id=NULL,nun_id=NULL WHERE id=?",
        this.now(),
        s.id,
      );
      this.db.run('DELETE FROM messages WHERE session_id=?', s.id);
      this.db.run('DELETE FROM metadata WHERE key LIKE ?', 'message:' + s.id + ':%');
      for (const user of [s.user_id, s.nun_id].filter(Boolean))
        this.db.run('DELETE FROM requests WHERE user_id=?', user);
    });
  }
  async maintain() {
    this.db.run(
      "UPDATE sessions SET mode='text',status='CONFESSING' WHERE status='MODE_SELECT' AND mode_deadline<=? AND closed_at IS NULL",
      this.now(),
    );
    for (const s of this.db.all<any>('SELECT * FROM sessions WHERE closed_at IS NULL')) {
      await locks.use(s.user_id || s.id, async () => {
        const current = this.db.get<any>('SELECT * FROM sessions WHERE id=?', s.id)!;
        if (current.closed_at) return;
        if (
          current.confessor_disconnected_at !== null &&
          current.confessor_disconnected_at + 20000 <= this.now()
        ) {
          if (current.status !== 'EXECUTING') this.closeSession(current);
        } else if (
          current.nun_disconnected_at !== null &&
          current.nun_disconnected_at + 20000 <= this.now()
        ) {
          if (['MODE_SELECT', 'CONFESSING', 'COMMUNITY_VOTE'].includes(current.status))
            this.db.run(
              "UPDATE sessions SET nun_id=NULL,nun_disconnected_at=NULL,status='QUEUED',mode=NULL,mode_deadline=NULL WHERE id=?",
              s.id,
            );
          else
            this.db.run(
              'UPDATE sessions SET nun_id=NULL,nun_disconnected_at=NULL WHERE id=?',
              s.id,
            );
        }
      });
    }
    if (this.channel)
      for (const j of this.db.all<any>(
        "SELECT j.* FROM judgments j WHERE report IS NOT NULL AND execution_status IN ('executed','degraded') AND NOT EXISTS (SELECT 1 FROM metadata WHERE key='channel_posted:'||j.id)",
      )) {
        const s = this.db.get<any>('SELECT * FROM sessions WHERE id=?', j.session_id);
        try {
          await this.channel.result(s, j);
        } catch {
          /* Persisted ambiguous delivery; never duplicate. */
        }
      }
  }
  createJudgment(s: any, verdict: Verdict) {
    const old = this.db.get<any>(
      "SELECT id FROM judgments WHERE session_id=? AND execution_status!='superseded'",
      s.id,
    );
    if (old) return { id: old.id };
    const { card, audit } = draw(verdict, this.rng),
      id = randomUUID();
    this.db.tx(() => {
      this.db.run(
        'INSERT INTO judgments(id,session_id,verdict,card_id,rng,created_at) VALUES(?,?,?,?,?,?)',
        id,
        s.id,
        verdict,
        card.id,
        JSON.stringify(audit),
        this.now(),
      );
      this.db.run("UPDATE sessions SET status='ANIMATION' WHERE id=?", s.id);
    });
    return { id };
  }
  async aiResponse(s: any, verdict = false) {
    requireThat(this.ai?.enabled, '大肥鱼暂未启用', 503);
    const messages = this.db.all<any>(
      "SELECT sender_type,content FROM messages WHERE session_id=? AND type='text' ORDER BY created_at,rowid",
      s.id,
    );
    try {
      if (verdict) {
        const result = await this.ai.verdict(messages);
        requireThat(
          result &&
            Object.keys(result).sort().join(',') === 'reason,verdict' &&
            ['heaven', 'hell'].includes(result.verdict) &&
            typeof result.reason === 'string' &&
            result.reason.length <= 300,
          'AI 裁决无效',
        );
        this.message(s.id, 'nun', 'text', result.reason);
        return this.createJudgment(s, result.verdict);
      }
      const text = await this.ai.reply(messages);
      requireThat(typeof text === 'string' && text.trim() && text.length <= 1000, 'AI 回复无效');
      this.message(s.id, 'nun', 'text', text);
      return { ok: true };
    } catch {
      throw new AppError(503, '大肥鱼暂时没回应，请重试或退出；会话已保留');
    }
  }
  async startSession(actor: Actor, ai: boolean) {
    if (ai) requireThat(this.ai?.enabled, '大肥鱼暂未启用', 503);
    requireThat(
      !this.db.get('SELECT 1 FROM sessions WHERE nun_id=? AND closed_at IS NULL', actor.user),
      '请先结束接待',
    );
    const old = this.db.get<any>(
      'SELECT id FROM sessions WHERE user_id=? AND closed_at IS NULL',
      actor.user,
    );
    if (old) {
      const previous = this.db.get<any>('SELECT * FROM sessions WHERE id=?', old.id);
      if (previous.instance_id !== (actor.instance || 'default')) {
        requireThat(previous.status !== 'EXECUTING', '上一房间正在执行判决，请稍候');
        this.closeSession(previous);
      } else if (ai && previous.kind !== 'ai') {
        requireThat(previous.status === 'QUEUED', '请先结束当前会话');
        this.closeSession(previous);
      } else return { id: old.id };
    }
    const used = new Set(
      this.db
        .all('SELECT anonymous_id FROM sessions WHERE closed_at IS NULL')
        .map((s) => s.anonymous_id),
    );
    let n = randomInt(1, 1000),
      tries = 0;
    while (used.has('迷途灵魂 #' + String(n).padStart(3, '0')) && tries++ < 999) n = (n % 999) + 1;
    requireThat(tries < 999, '忏悔室已满');
    const id = randomUUID(),
      anon = '迷途灵魂 #' + String(n).padStart(3, '0');
    this.db.tx(() => {
      const priority = ai ? 0 : Number(this.effects.consume(actor.user, 'priority_confession'));
      this.db.run(
        'INSERT INTO sessions(id,anonymous_id,user_id,status,priority,created_at,instance_id,kind,mode) VALUES(?,?,?,?,?,?,?,?,?)',
        id,
        anon,
        actor.user,
        ai ? 'TEXT_CONFESSING' : 'QUEUED',
        priority,
        this.now(),
        actor.instance || 'default',
        ai ? 'ai' : 'human',
        ai ? 'text' : null,
      );
    });
    return { id };
  }
  session(actor: Actor, id: string) {
    actor = this.asActor(actor);
    const s = this.db.get<any>('SELECT * FROM sessions WHERE id=?', id);
    requireThat(s && !s.closed_at && s.instance_id === actor.instance, '会话不存在', 404);
    requireThat(
      actor.nun
        ? s.nun_id === actor.user
        : actor.identity === 'confessor' && s.user_id === actor.user,
      '没有此会话权限',
      403,
    );
    return s;
  }
  owned(actor: Actor, id: string) {
    actor = this.asActor(actor);
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
    const canNun = actor.nun;
    actor = this.asActor(actor);
    const sessions =
      actor.identity === 'spectator'
        ? this.db.all(
            "SELECT id,anonymous_id,status FROM sessions WHERE instance_id=? AND closed_at IS NULL AND status!='QUEUED' ORDER BY created_at DESC",
            actor.instance,
          )
        : actor.nun
          ? this.db.all(
              "SELECT id,anonymous_id,status FROM sessions WHERE closed_at IS NULL AND instance_id=? AND kind='human' AND (status='QUEUED' OR nun_id=?) ORDER BY priority DESC,created_at",
              actor.instance,
              actor.user,
            )
          : [];
    let s;
    if (actor.identity === 'spectator') {
      s = id
        ? this.db.get<any>(
            'SELECT * FROM sessions WHERE id=? AND instance_id=? AND closed_at IS NULL',
            id,
            actor.instance,
          )
        : this.db.get<any>(
            "SELECT * FROM sessions WHERE instance_id=? AND closed_at IS NULL AND status!='QUEUED' ORDER BY created_at DESC LIMIT 1",
            actor.instance,
          );
    } else if (id && !this.db.get<any>('SELECT closed_at FROM sessions WHERE id=?', id)?.closed_at)
      s = this.session(actor, id);
    else if (actor.nun)
      s = this.db.get<any>(
        'SELECT * FROM sessions WHERE nun_id=? AND instance_id=? AND closed_at IS NULL',
        actor.user,
        actor.instance,
      );
    else if (actor.identity === 'confessor')
      s = this.db.get<any>(
        'SELECT * FROM sessions WHERE user_id=? AND instance_id=? AND closed_at IS NULL',
        actor.user,
        actor.instance,
      );
    const session = s
      ? {
          id: s.id,
          anonymous_id: s.anonymous_id,
          status: s.status,
          kind: s.kind,
          mode: s.mode,
          reply_mode: s.reply_mode,
          mode_deadline: s.mode_deadline,
          poll_id: s.poll_id,
          poll_url: s.poll_id ? this.channel?.pollUrl(s.poll_id) : undefined,
          disconnected: s.confessor_disconnected_at !== null || s.nun_disconnected_at !== null,
        }
      : undefined;
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
      role: actor.identity as Snapshot['role'],
      can_nun: canNun,
      ai_enabled: !!this.ai?.enabled,
      sessions,
      session,
      messages,
      judgment: j ? this.publicJudgment(j) : undefined,
      tokens: actor.identity !== 'confessor' ? [] : this.effects.tokens(actor.user),
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
    const eligible = actor.nun;
    actor = this.asActor(actor);
    requireThat(/^[a-zA-Z0-9-]{8,100}$/.test(requestId), '需要有效 request id', 400);
    const lockUser =
      data.id && op !== 'claim' && op !== 'start'
        ? this.db.get<any>('SELECT user_id FROM sessions WHERE id=?', data.id)?.user_id
        : undefined;
    // Serialize all user-affecting actions with effect expiry and execution, including nun verdicts.
    return locks.use(op === 'claim' ? 'claim-queue' : lockUser || actor.user, async () => {
      const fingerprint = createHash('sha256')
        .update(op + JSON.stringify(data))
        .digest('hex');
      requireThat(
        op === 'identity' || ['confessor', 'nun'].includes(actor.identity!),
        '围观者只读，请先选择身份',
        403,
      );
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
        case 'identity': {
          requireThat(
            ['nun', 'confessor', 'spectator'].includes(data.role) &&
              (data.role !== 'nun' || eligible),
            '身份不可用',
            403,
          );
          const open = this.db.get<any>(
            'SELECT * FROM sessions WHERE (user_id=? OR nun_id=?) AND closed_at IS NULL',
            actor.user,
            actor.user,
          );
          requireThat(
            !open ||
              (data.role === 'confessor' && open.user_id === actor.user) ||
              (data.role === 'nun' && open.nun_id === actor.user),
            '请先结束当前会话',
          );
          if (data.target === 'ai') requireThat(this.ai?.enabled, '大肥鱼暂未启用', 503);
          this.db.run(
            'INSERT INTO metadata VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
            'identity:' + (actor.scope || actor.user),
            data.role,
          );
          if (data.role === 'confessor')
            result = await this.startSession(actor, data.target === 'ai');
          break;
        }
        case 'ai_start':
        case 'start': {
          requireThat(actor.identity === 'confessor', '请先选择忏悔者身份', 403);
          result = await this.startSession(actor, op === 'ai_start');
          break;
        }
        case 'claim': {
          requireThat(actor.nun, '只限修女', 403);
          const s = this.db.get<any>('SELECT * FROM sessions WHERE id=?', data.id);
          requireThat(
            s &&
              !s.closed_at &&
              s.kind === 'human' &&
              s.instance_id === actor.instance &&
              s.user_id !== actor.user,
            '会话已关闭或无法接待',
          );
          requireThat(
            !this.db.get(
              'SELECT 1 FROM sessions WHERE user_id=? AND closed_at IS NULL',
              actor.user,
            ),
            '请先结束自己的忏悔',
          );
          requireThat(s.status === 'QUEUED' || s.nun_id === actor.user, '会话已由其他修女接待');
          requireThat(
            !this.db.get(
              'SELECT 1 FROM sessions WHERE nun_id=? AND closed_at IS NULL AND id!=?',
              actor.user,
              data.id,
            ),
            '请先结束当前会话',
          );
          if (s.nun_id === actor.user) {
            result = { id: s.id };
            break;
          }
          this.db.run(
            "UPDATE sessions SET nun_id=?,status='MODE_SELECT',mode_deadline=? WHERE id=? AND nun_id IS NULL",
            actor.user,
            this.now() + 30000,
            s.id,
          );
          result = { id: s.id };
          break;
        }
        case 'mode': {
          const s = this.session(actor, data.id);
          requireThat(
            !actor.nun && s.kind === 'human' && s.status === 'MODE_SELECT',
            '当前不能选择模式',
          );
          requireThat(['text', 'brave'].includes(data.mode), '模式无效', 400);
          this.db.run(
            "UPDATE sessions SET mode=?,status='CONFESSING' WHERE id=?",
            this.now() >= s.mode_deadline ? 'text' : data.mode,
            s.id,
          );
          break;
        }
        case 'reply_mode': {
          const s = this.session(actor, data.id);
          requireThat(
            actor.nun && s.kind === 'human' && ['MODE_SELECT', 'CONFESSING'].includes(s.status),
            '只限当值真人修女',
            403,
          );
          requireThat(['text', 'voice'].includes(data.mode), '模式无效', 400);
          this.db.run('UPDATE sessions SET reply_mode=? WHERE id=?', data.mode, s.id);
          break;
        }
        case 'end_confession': {
          const s = this.session(actor, data.id);
          requireThat(actor.nun && s.kind === 'human', '只限当值修女', 403);
          requireThat(['CONFESSING', 'COMMUNITY_VOTE'].includes(s.status), '会话状态无效');
          requireThat(this.channel, '频道服务暂不可用', 503);
          let poll = s.poll_id;
          if (!poll) {
            try {
              poll = await this.channel.poll(s);
            } catch (e) {
              throw new AppError(
                503,
                (e as Error).message === 'CHANNEL_SEND_REJECTED'
                  ? '投票发送被 Discord 拒绝，请检查 Send Polls 与频道权限后重试'
                  : '投票发送状态未确认，请管理员检查频道；为避免重复不会自动重发',
              );
            }
          }
          this.db.run(
            "UPDATE sessions SET status='COMMUNITY_VOTE',poll_id=? WHERE id=?",
            poll,
            s.id,
          );
          break;
        }
        case 'ai_retry':
        case 'ai_verdict': {
          const s = this.session(actor, data.id);
          requireThat(
            !actor.nun && s.kind === 'ai' && s.status === 'TEXT_CONFESSING',
            '当前不是 AI 文字会话',
          );
          result = await this.aiResponse(s, op === 'ai_verdict');
          break;
        }
        case 'message': {
          const s = this.session(actor, data.id);
          requireThat(['CONFESSING', 'TEXT_CONFESSING'].includes(s.status), '当前无法发送消息');
          requireThat(s.kind !== 'ai' || data.type !== 'sticker', '大肥鱼只接收文字');
          const type = data.type === 'sticker' ? 'sticker' : 'text';
          const content = String(data.content || '').trim();
          requireThat(
            type === 'sticker'
              ? /^nun_(0[1-9]|1[0-6])$/.test(content)
              : content.length > 0 && content.length <= 2000,
            '消息格式无效',
            400,
          );
          const messageKey = 'message:' + s.id + ':' + actor.user + ':' + requestId;
          if (!this.db.get('SELECT 1 FROM metadata WHERE key=?', messageKey))
            this.db.tx(() => {
              this.message(s.id, actor.nun ? 'nun' : 'confessor', type, content);
              this.db.run('INSERT INTO metadata VALUES(?,?)', messageKey, '1');
            });
          if (s.kind === 'ai') result = await this.aiResponse(s);
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
          requireThat(s.status === 'COMMUNITY_VOTE' && s.poll_id, '请先结束忏悔并发送投票');
          requireThat(['heaven', 'hell'].includes(data.verdict), '裁决无效', 400);
          result = this.createJudgment(s, data.verdict);
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
          requireThat(!['superseded', 'expired'].includes(j.execution_status), '该判决已失效');
          requireThat(j.selected_index !== null, '请先亲手选牌');
          if (!j.report) {
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
          }
          if (this.channel) {
            try {
              await this.channel.result(
                s,
                this.db.get<any>('SELECT * FROM judgments WHERE id=?', j.id),
              );
            } catch {
              this.message(
                s.id,
                'system',
                'text',
                '频道结果发送未获确认，请联系管理员检查；判决已结算，不会重复发布。',
              );
            }
          }
          break;
        }
        case 'close': {
          const s = this.session(actor, data.id);
          requireThat(s.status !== 'EXECUTING', '请先完成本次判决');
          this.closeSession(s);
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
