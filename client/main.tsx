import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Snapshot, PublicJudgment } from '../shared/types';
import { boot, command, snapshot, connect } from './api';
import './style.css';
const names: Record<string, string> = {
  tatsumaki: '龙卷',
  ren_yamashiro: '山城恋',
  yuzuha_lee: '李柚巴',
};
const arcana: Record<string, string> = {
  tatsumaki: 'THE TEMPEST',
  ren_yamashiro: 'THE DOMINION',
  yuzuha_lee: 'THE WAGER',
};
const labels: Record<string, string> = {
  freeze_800ms: '万籁静止',
  emerald_shards_reverse: '碎片倒流',
  tatsumaki_silhouette: '风暴降临',
  giant_emerald_eye_of_storm: '暴风眼的庇护',
  double_bell: '双重钟鸣',
  low_frequency_psychic_boom: '念动力共振',
  card_reveal: '命运已定',
  blackout_600ms: '烛火熄灭',
  green_eye_glow: '她正看着你',
  stained_glass_shatter_float: '彩窗碎裂',
  five_cards_blast_away: '风暴席卷',
  single_reversed_card_hold: '逆位之眼',
  heavy_bell: '审判钟鸣',
  candles_out_500ms: '全场寂静',
  throne_gold_lines_light: '王座金纹',
  ren_raise_eyes: '修女长抬眼',
  five_cards_split: '列阵退开',
  center_upright_card: '王座之侧',
  triple_bell: '三响钟声',
  low_choir: '圣堂低吟',
  near_blackout: '伏首之前',
  throne_and_eye_glow: '王座凝视',
  five_cards_stand: '命令列阵',
  all_cards_turn_back: '命运倒扣',
  center_reversed_card_descend: '逆位降临',
  silent_flip: '无声翻牌',
  silence_800ms: '静默',
  choice_accept_or_plead: '接受，或请求宽恕',
  darken: '灯光压暗',
  three_gold_slots_roll: '命运开始转动',
  slot1_heaven: 'HEAVEN ◇ ◇',
  slot2_heaven: 'HEAVEN HEAVEN ◇',
  slot3_pass_hell_then_heaven: 'HEAVEN HEAVEN HEAVEN',
  gold_stained_glass_burst: 'JACKPOT',
  bell_plus_chip_drop: '幸运落定',
  casino_tarot_shuffle: '庄家的牌局',
  fake_jackpot_build: 'JACKPOT ?',
  symbols_flip_to_house_wins: 'HOUSE WINS',
  wine_red_black_flash: '庄家通吃',
  chips_fall_backward: '筹码逆落',
  dealer_smile_silhouette: '这局，都归我。',
};
function bell(count = 1) {
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < count; i++) {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 174 + i * 42;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.35);
      g.gain.exponentialRampToValueAtTime(0.11, ctx.currentTime + i * 0.35 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.35 + 0.85);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.35);
      o.stop(ctx.currentTime + i * 0.35 + 0.9);
    }
    setTimeout(() => void ctx.close(), 2500);
  } catch {}
}
function CardArt({ j }: { j: PublicJudgment }) {
  const [index, setIndex] = useState(0);
  return (
    <div className={'art-frame ' + j.card?.rarity}>
      {index < (j.art_urls?.length || 0) ? (
        <img
          className={j.verdict === 'hell' ? 'reversed' : ''}
          src={j.art_urls![index]}
          onError={() => setIndex((i) => i + 1)}
          alt={j.card?.name}
        />
      ) : (
        <div className="fallback-art">
          ✦<br />
          {names[j.character]}
        </div>
      )}
      <div className="art-cross">✝</div>
    </div>
  );
}
function Ritual({
  j,
  run,
}: {
  j: PublicJudgment;
  run: (op: string, data: Record<string, unknown>) => Promise<void>;
}) {
  const type = j.detail?.interaction,
    i = j.interaction;
  const [text, setText] = useState('');
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    if (type !== 'double' || i.done) return;
    const t = setInterval(() => setTick(Date.now()), 500);
    return () => clearInterval(t);
  }, [type, i.done]);
  if (!type || i.done) return null;
  const act = (choice: string, extra = {}) =>
    void run('interact', { judgment: j.id, choice, ...extra });
  const remain = Math.max(0, Math.ceil(((j.revealed_at || 0) + 15000 - tick) / 1000));
  return (
    <div className="ritual">
      {(i.count || i.pleaded || i.praise) && (
        <img
          className="ritual-sticker"
          src={`/assets/stickers/nun/nun_${String(i.count ? i.count + 3 : i.pleaded ? 12 : 8).padStart(2, '0')}.png`}
          alt="修女的回应贴纸"
        />
      )}
      {(type === 'ack3' || type === 'accept3' || type === 'ack1') && (
        <button onClick={() => act('ack')}>
          {type === 'accept3' ? '接受审判' : '我知道错了'} · {(i.count || 0) + 1}/
          {type === 'ack1' ? 1 : 3}
        </button>
      )}
      {type === 'command' && (
        <>
          <label>
            认真道歉（30 字以内）
            <input
              maxLength={30}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="修女长，我……"
            />
          </label>
          <button disabled={!text.trim()} onClick={() => act('apology', { text })}>
            提交道歉
          </button>
          <button onClick={() => act('praise')} disabled={!!i.praise}>
            称赞修女长
          </button>
          {i.praise && <button onClick={() => act('repeat')}>照着说：{i.praise}</button>}
          <button onClick={() => act('nickname')}>接受随机昵称</button>
        </>
      )}
      {type === 'bow' && (
        <>
          <button onClick={() => act('accept')}>接受审判</button>
          {!i.pleaded ? (
            <button onClick={() => act('plead')}>请求宽恕（仅一次）</button>
          ) : (
            <>
              <p>真的要求饶吗？确认后改为「乖狗狗认证」8h。</p>
              <button onClick={() => act('plead_confirm')}>确认求饶</button>
              <button onClick={() => act('accept')}>取消，接受审判</button>
            </>
          )}
        </>
      )}
      {type === 'round' && (
        <>
          <p>50% 赢：本牌实体刑罚取消；50% 输：昵称 2h + 赌债内部状态 3h。只进行一次。</p>
          <button onClick={() => act('gamble')}>再赌一次 · 50/50</button>
          <button onClick={() => act('coward')}>我怂了 · 内部状态 2h</button>
        </>
      )}
      {type === 'double' && (
        <>
          <p>{remain}s · 50% 赢：实体刑罚归零；50% 输：双倍赌债和昵称 6h。超时维持内部状态 4h。</p>
          <button disabled={!remain} onClick={() => act('double')}>
            翻倍 · 50/50
          </button>
          <button onClick={() => act('keep')}>算了 · 维持基础刑罚</button>
          {!remain && (
            <button onClick={() => void run('execute', { judgment: j.id })}>按超时结果结算</button>
          )}
        </>
      )}
      {type === 'house' && (
        <>
          <button onClick={() => act('plead')}>庄家，我认输 · 缩短至 8h</button>
          <button onClick={() => act('accept')}>接受审判 · 12h</button>
        </>
      )}
    </div>
  );
}
function Ceremony({
  readOnly = false,
  j,
  status,
  run,
  reduced,
  muted,
}: {
  readOnly?: boolean;
  j: PublicJudgment;
  status: string;
  run: (op: string, data: Record<string, unknown>) => Promise<void>;
  reduced: boolean;
  muted: boolean;
}) {
  const [step, setStep] = useState(-1),
    [flipping, setFlipping] = useState(false),
    [watched, setWatched] = useState(localStorage.getItem('ceremony-watched') === '1');
  const sent = useRef(false);
  const [peek, setPeek] = useState(false);
  const sequence = j.sequence.length
    ? j.sequence
    : [
        'darken',
        j.character === 'tatsumaki'
          ? 'emerald_shards_reverse'
          : j.character === 'ren_yamashiro'
            ? 'throne_gold_lines_light'
            : 'casino_tarot_shuffle',
        'card_reveal',
      ];
  useEffect(() => {
    sent.current = false;
    setStep(-1);
    setPeek(false);
  }, [j.id]);
  useEffect(() => {
    if (status !== 'ANIMATION') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let n = 0;
    const advance = () => {
      if (cancelled) return;
      if (document.hidden) {
        timer = setTimeout(advance, 500);
        return;
      }
      if (n >= sequence.length) {
        localStorage.setItem('ceremony-watched', '1');
        setWatched(true);
        if (!readOnly && !sent.current) {
          sent.current = true;
          void run('animation_done', { judgment: j.id }).catch(() => {
            sent.current = false;
          });
        }
        return;
      }
      setStep(n);
      const key = sequence[n++];
      if (!muted && /bell|choir|boom/.test(key))
        bell(key === 'triple_bell' ? 3 : key === 'double_bell' ? 2 : 1);
      const ms = reduced
        ? 80
        : key.includes('800ms')
          ? 800
          : key.includes('600ms')
            ? 600
            : key.includes('500ms')
              ? 500
              : j.character === 'ren_yamashiro'
                ? 800
                : 550;
      timer = setTimeout(advance, ms);
    };
    advance();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [j.id, status, reduced, muted]);
  const choose = async (index: number) => {
    if (flipping) return;
    setFlipping(true);
    if (!muted) bell();
    await new Promise((r) =>
      setTimeout(
        r,
        reduced ? 0 : j.character === 'ren_yamashiro' ? 1500 : j.rarity === 'SR' ? 600 : 400,
      ),
    );
    await run('choose', { judgment: j.id, index });
    setFlipping(false);
  };
  const revealed = !!j.card;
  const canReroll = !j.rerolled && j.execution_status === 'pending';
  return (
    <section
      className={`ceremony ${j.verdict} ${j.character} ${j.rarity} ${reduced ? 'reduced' : ''} stage-${step} ${revealed ? 'revealed' : ''}`}
      data-animation={j.animation_key}
      data-sequence={sequence[step] || 'ready'}
      aria-label="塔罗审判"
    >
      <div className="stained-window" />
      <div className="throne" />
      <div className="meteor" />
      <div className="eye" />
      <div className="shards">
        {Array.from({ length: reduced ? 3 : 14 }, (_, n) => (
          <i key={n} style={{ '--n': n } as React.CSSProperties}>
            ◇
          </i>
        ))}
      </div>
      <img
        className="summon-portrait"
        src={`/assets/nuns/${j.character}.webp`}
        alt={names[j.character]}
      />
      <header className="ceremony-heading">
        <small>
          {j.verdict === 'heaven' ? '☁ HEAVEN · 正位' : '♰ HELL · 逆位'} / {j.rarity}
        </small>
        <h1>{revealed ? j.card?.name : arcana[j.character]}</h1>
        <p>
          {names[j.character]} · {labels[sequence[step]] || '命运正在靠近'}
        </p>
      </header>
      {status === 'ANIMATION' && (
        <div className="sequence-stage">
          <span className="sigil">
            {j.character === 'tatsumaki' ? '◉' : j.character === 'ren_yamashiro' ? '♛' : '♠'}
          </span>
          <p aria-live="polite">{labels[sequence[step]] || '钟声将起'}</p>
          {watched && !readOnly && (
            <button onClick={() => void run('animation_done', { judgment: j.id })}>
              跳过已看过的演出
            </button>
          )}
        </div>
      )}
      {status === 'CARD_CHOICE' && (
        <div className={'five-cards ' + (flipping ? 'flipping' : '')}>
          <p>命运已锁定。亲手选择一张塔罗牌。</p>
          <div className="card-fan">
            {[0, 1, 2, 3, 4].map((n) => (
              <button
                key={n}
                aria-label={`选择第 ${n + 1} 张塔罗牌`}
                disabled={flipping || readOnly}
                style={{ '--index': n } as React.CSSProperties}
                onClick={() => void choose(n)}
              >
                <span>✝</span>
                <small>{['I', 'II', 'III', 'IV', 'V'][n]}</small>
              </button>
            ))}
          </div>
        </div>
      )}
      {!revealed && j.report && (
        <div className="execution-report">
          <p>{j.report.join(' ')}</p>
          {!readOnly && <button onClick={() => void run('close', {})}>离开忏悔席</button>}
        </div>
      )}
      {revealed && (
        <div className={`reveal-content ${j.card?.effect_key}`}>
          <CardArt key={j.id} j={j} />
          <div className="result-text">
            <span className="rarity">
              {j.rarity} · {arcana[j.character]}
            </span>
            <h2>{j.card?.name}</h2>
            <blockquote>“{j.detail?.quote}”</blockquote>
            <details>
              <summary>判决效果与时长</summary>
              <pre>{j.detail?.description}</pre>
            </details>
            {!readOnly && <Ritual j={j} run={run} />}
            {!readOnly && j.execution_status === 'pending' && (
              <>
                {canReroll && (
                  <button className="subtle" onClick={() => setPeek(!peek)}>
                    查看重抽选项
                  </button>
                )}
                {peek && (
                  <button onClick={() => void run('reroll', { judgment: j.id })}>
                    使用已有重抽状态 · 新牌必须接受
                  </button>
                )}
                <button className="primary" onClick={() => void run('execute', { judgment: j.id })}>
                  {j.detail?.interaction && !j.interaction.done
                    ? '完成仪式后结算'
                    : '接受判决并执行'}
                </button>
              </>
            )}
            {j.report && (
              <div className={'execution-report ' + j.execution_status}>
                <strong>
                  {j.execution_status === 'executed'
                    ? '判决已结算'
                    : '服务器效果部分未执行，已降级'}
                </strong>
                {j.report.map((line, n) => (
                  <p key={n}>{line}</p>
                ))}
                {!readOnly && <button onClick={() => void run('close', {})}>离开忏悔席</button>}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
function App() {
  const [state, setState] = useState<Snapshot>();
  const [error, setError] = useState(''),
    [network, setNetwork] = useState('等待 Discord'),
    [busy, setBusy] = useState(false);
  const [text, setText] = useState(''),
    [picker, setPicker] = useState(false),
    [now, setNow] = useState(Date.now());
  const [reduced, setReduced] = useState(
    localStorage.getItem('reduced') === 'true' ||
      matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [muted, setMuted] = useState(localStorage.getItem('muted') !== 'false');
  const connection = useRef<ReturnType<typeof connect> | null>(null),
    pending = useRef(false),
    selected = useRef<string | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    boot()
      .then(() => {
        if (alive)
          connection.current = connect((s) => {
            if (alive)
              setState((previous) => {
                if (previous?.session && !s.session) setError('对方已离开，忏悔已结束。');
                return s;
              });
          }, setNetwork);
      })
      .catch((e) => setError(e.message));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(timer);
      connection.current?.close();
    };
  }, []);
  const run = async (op: string, data: Record<string, unknown> = {}) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await command(op, { id: state?.session?.id, ...data });
      if (op === 'claim') {
        selected.current = result.id;
        connection.current?.subscribe(result.id);
      }
      if (op === 'close' || op === 'identity' || op === 'ai_start') {
        selected.current = undefined;
        connection.current?.subscribe();
      }
      setState(await snapshot(selected.current));
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络异常，请重试');
      try {
        setState(await snapshot(selected.current));
      } catch {}
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const session = state?.session,
    role = state?.role,
    readOnly = role === 'spectator';
  const send = async (content: string, type = 'text') => {
    setText('');
    setPicker(false);
    await run('message', { content, type });
  };
  const identity = (
    <div className="identity-actions">
      {state?.can_nun && (
        <button disabled={busy} onClick={() => void run('identity', { role: 'nun' })}>
          以修女身份进入
        </button>
      )}
      <button disabled={busy} onClick={() => void run('identity', { role: 'confessor' })}>
        以忏悔者身份进入 · 自动排队
      </button>
      <button disabled={busy} onClick={() => void run('identity', { role: 'spectator' })}>
        只围观
      </button>
      {state?.ai_enabled && (
        <button
          disabled={busy}
          onClick={() => void run('identity', { role: 'confessor', target: 'ai' })}
        >
          🐋 向大肥鱼忏悔 · 仅文字
        </button>
      )}
    </div>
  );
  return (
    <main aria-busy={busy} className={reduced ? 'reduce-motion' : ''}>
      <nav>
        <a className="brand" href="#">
          <img src="/assets/icon-128.png" alt="" />
          CONFESSIONAL <span>忏悔室</span>
        </a>
        <div className="settings">
          <button
            aria-pressed={reduced}
            onClick={() =>
              setReduced((v) => {
                localStorage.setItem('reduced', String(!v));
                return !v;
              })
            }
          >
            {reduced ? '动态：少' : '动态：完整'}
          </button>
          <button
            onClick={() =>
              setMuted((v) => {
                localStorage.setItem('muted', String(!v));
                return !v;
              })
            }
          >
            {muted ? '静音' : '声音'}
          </button>
        </div>
      </nav>
      <div className="connection" role="status">
        {network} ·{' '}
        {role === 'nun'
          ? '修女席'
          : role === 'spectator'
            ? '围观席'
            : role === 'confessor'
              ? '忏悔席'
              : '选择身份'}
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      {(!state || role === 'identity_select') && (
        <section className="entrance">
          <div className="arch">
            <img src="/assets/icon-512.png" alt="祈祷修女" />
          </div>
          <h1>今夜，你想忏悔什么？</h1>
          <p>匿名文字会公开给同一房间的围观者。</p>
          {state && identity}
          <div className="nun-lineup">
            {Object.keys(names).map((key) => (
              <figure key={key}>
                <img src={`/assets/nuns/${key}.webp`} alt={names[key]} />
                <figcaption>{names[key]}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
      {state && role !== 'identity_select' && !session && (
        <section className="nun-queue">
          <h1>{role === 'nun' ? '修女席' : role === 'spectator' ? '围观席' : '忏悔席'}</h1>
          {role === 'nun' &&
            (state.sessions.length ? (
              state.sessions.map((s) => (
                <button disabled={busy} key={s.id} onClick={() => void run('claim', { id: s.id })}>
                  {s.anonymous_id} · 上钟接待
                </button>
              ))
            ) : (
              <p>暂时没有等待的灵魂。</p>
            ))}
          {role === 'spectator' && <p>暂无公开忏悔。语音现场请通过 Discord 原生语音频道收听。</p>}
          {identity}
        </section>
      )}
      {state?.role === 'spectator' && state.sessions.length > 1 && (
        <div className="identity-actions">
          {state.sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                selected.current = s.id;
                connection.current?.subscribe(s.id);
              }}
            >
              {s.anonymous_id} · {s.status}
            </button>
          ))}
        </div>
      )}
      {session && !state.judgment && (
        <section className="booth">
          <header>
            <small>THE PUBLIC CONFESSIONAL · 同房间公开</small>
            <h1>{session.anonymous_id}</h1>
            <p>{session.status}</p>
            {session.disconnected && <p role="status">对方连接中断，等待重连…（20 秒宽限）</p>}
            {session.kind === 'ai' ? (
              <p>🐋 大肥鱼 · 仅文字</p>
            ) : (
              <p>
                {session.mode === 'brave'
                  ? '勇者模式 · Discord 原生开麦、本音'
                  : session.mode === 'text'
                    ? '文字模式'
                    : ''}{' '}
                {session.reply_mode === 'voice' ? ' / 修女语音回复' : ''}
              </p>
            )}
            {session.status === 'QUEUED' && <p>已进入忏悔队列，等待修女上钟。</p>}
          </header>
          {session.status === 'MODE_SELECT' && (
            <div className="mode-choice">
              <p>
                {Math.max(0, Math.ceil(((session.mode_deadline || now) - now) / 1000))}{' '}
                秒内选择；超时自动文字模式。
              </p>
              {role === 'confessor' && (
                <>
                  <button disabled={busy} onClick={() => void run('mode', { mode: 'text' })}>
                    文字模式
                  </button>
                  <button disabled={busy} onClick={() => void run('mode', { mode: 'brave' })}>
                    勇者模式 · 本音
                  </button>
                </>
              )}
            </div>
          )}
          {role === 'nun' &&
            session.kind === 'human' &&
            ['MODE_SELECT', 'CONFESSING'].includes(session.status) && (
              <div>
                <p>修女回复方式（独立选择）</p>
                <button disabled={busy} onClick={() => void run('reply_mode', { mode: 'text' })}>
                  文字
                </button>
                <button disabled={busy} onClick={() => void run('reply_mode', { mode: 'voice' })}>
                  语音 · Discord 原生开麦
                </button>
              </div>
            )}
          {(session.mode === 'brave' || session.reply_mode === 'voice') && (
            <p className="notice">
              请在 Discord 语音频道使用原生麦克风控件；Activity 不处理或录制音频。
            </p>
          )}
          <div className="messages" aria-live="polite">
            {state.messages.map((m) => (
              <article key={m.id} className={'message ' + m.sender_type}>
                <small>
                  {m.sender_type === 'confessor'
                    ? session.anonymous_id
                    : m.sender_type === 'nun'
                      ? session.kind === 'ai'
                        ? '大肥鱼'
                        : '修女'
                      : '命运回声'}
                </small>
                {m.type === 'sticker' ? (
                  <img src={`/assets/stickers/nun/${m.content}.png`} alt="修女表情贴纸" />
                ) : (
                  <p>{m.content}</p>
                )}
              </article>
            ))}
          </div>
          {!readOnly && ['CONFESSING', 'TEXT_CONFESSING'].includes(session.status) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(text);
              }}
            >
              <input
                aria-label="匿名消息"
                maxLength={2000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="文字将向同房间围观者公开…"
              />
              <button disabled={busy || !text.trim()}>发送</button>
              {session.kind !== 'ai' && (
                <button type="button" aria-label="打开修女贴纸" onClick={() => setPicker(!picker)}>
                  ☺
                </button>
              )}
              {picker && session.kind !== 'ai' && (
                <div className="sticker-picker">
                  {Array.from(
                    { length: 16 },
                    (_, n) => 'nun_' + String(n + 1).padStart(2, '0'),
                  ).map((key) => (
                    <button
                      type="button"
                      key={key}
                      aria-label={`发送贴纸 ${key}`}
                      disabled={busy}
                      onClick={() => void send(key, 'sticker')}
                    >
                      <img src={`/assets/stickers/nun/${key}.png`} alt={key} />
                    </button>
                  ))}
                </div>
              )}
            </form>
          )}
          {role === 'confessor' && session.status === 'QUEUED' && state.ai_enabled && (
            <button disabled={busy} onClick={() => void run('ai_start')}>
              🐋 向大肥鱼忏悔 · 离开人工队列
            </button>
          )}
          {role === 'confessor' &&
            session.kind === 'ai' &&
            session.status === 'TEXT_CONFESSING' && (
              <div>
                <button disabled={busy} onClick={() => void run('ai_retry')}>
                  请大肥鱼回应 / 重试
                </button>
                <button
                  disabled={busy || !state.messages.length}
                  onClick={() => void run('ai_verdict')}
                >
                  请大肥鱼判决
                </button>
              </div>
            )}
          {role === 'nun' && session.status === 'CONFESSING' && (
            <button className="primary" disabled={busy} onClick={() => void run('end_confession')}>
              忏悔结束
            </button>
          )}
          {session.status === 'COMMUNITY_VOTE' && (
            <div className="verdict-actions">
              <p>Discord 原生投票已发布。群众意见仅供参考，最终裁决权属于当值修女。</p>
              {role === 'nun' && (
                <>
                  <button
                    className="heaven-button"
                    disabled={busy}
                    onClick={() => void run('verdict', { verdict: 'heaven' })}
                  >
                    ☁ 天堂
                  </button>
                  <button
                    className="hell-button"
                    disabled={busy}
                    onClick={() => void run('verdict', { verdict: 'hell' })}
                  >
                    🔥 地狱
                  </button>
                </>
              )}
            </div>
          )}
          {session.poll_id && (
            <p className="notice">
              社区投票在 Discord 忏悔室频道内进行，仅供参考。
              {session.poll_url && (
                <a href={session.poll_url} target="_blank" rel="noreferrer">
                  打开天堂 / 地狱原生投票 ↗
                </a>
              )}
            </p>
          )}
          {!readOnly && session.status !== 'EXECUTING' && (
            <button className="subtle" disabled={busy} onClick={() => void run('close')}>
              {state.judgment ? '离开忏悔席' : '退出当前会话'}
            </button>
          )}
        </section>
      )}
      {state?.judgment && session && (
        <p className="connection">
          {session.anonymous_id} · {session.kind === 'ai' ? '大肥鱼' : '真人修女'} ·{' '}
          {session.status}
        </p>
      )}
      {state?.judgment && session && role === 'nun' && session.status === 'SETTLED' && (
        <button disabled={busy} onClick={() => void run('close')}>
          结束当前会话
        </button>
      )}
      {state?.judgment && session && (
        <Ceremony
          key={state.judgment.id}
          j={state.judgment}
          status={session.status}
          run={run}
          reduced={reduced}
          muted={muted}
          readOnly={role !== 'confessor'}
        />
      )}
      <footer>⛪ Discord 忏悔室 · 匿名文字公开 · 昵称与内部状态判决</footer>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
