import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { attachRealtime } from './realtime.js';
import { Store } from './db.js';
import { DiscordBot } from './discord.js';
import { Effects } from './effects.js';
import { Service, AppError, requireThat, type Actor } from './service.js';
import { validateManifest, manifest, assetManifest } from './cards.js';
validateManifest();
const env = process.env;
const required = [
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_BOT_TOKEN',
  'DISCORD_GUILD_ID',
  'CONFESSIONAL_CHANNEL_ID',
  'SESSION_SECRET',
  'PUBLIC_ORIGIN',
];
for (const key of required) if (!env[key]) throw Error('Missing required configuration: ' + key);
if (env.SESSION_SECRET!.length < 32) throw Error('SESSION_SECRET must have at least 32 characters');
const db = new Store(env.DATABASE_URL?.replace(/^sqlite:/, '') || 'data/confessional.sqlite');
const bot = new DiscordBot(env.DISCORD_GUILD_ID!, (name, id) =>
  db.run(
    'INSERT INTO managed_roles VALUES(?,?) ON CONFLICT(name) DO UPDATE SET role_id=excluded.role_id',
    name,
    id,
  ),
);
await bot.start(env.DISCORD_BOT_TOKEN!);
const effects = new Effects(db, bot),
  service = new Service(db, effects);
const app = express(),
  server = createServer(app);
app.disable('x-powered-by');
app.use(express.json({ limit: '12kb' }));
const origins = new Set([
  env.PUBLIC_ORIGIN!,
  `https://${env.DISCORD_CLIENT_ID}.discordsays.com`,
  `https://${env.DISCORD_CLIENT_ID}.discordsez.com`,
  ...(env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
]);
const buckets = new Map<string, { n: number; until: number }>();
function rate(key: string, max: number) {
  const now = Date.now();
  if (buckets.size > 10000) for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
  let b = buckets.get(key);
  if (!b || b.until < now) {
    b = { n: 0, until: now + 60000 };
    buckets.set(key, b);
  }
  requireThat(++b.n <= max, '请求过于频繁，请稍后再试', 429);
}
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && !origins.has(req.headers.origin || ''))
    return res.status(403).json({ error: 'ORIGIN_DENIED' });
  next();
});
const ids = (value?: string) =>
  new Set(
    (value || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
async function isNun(user: string) {
  if (ids(env.NUN_USER_IDS).has(user)) return true;
  const roles = ids(env.NUN_ROLE_IDS);
  if (!roles.size) return false;
  return (await bot.member(user)).roles.some((r) => roles.has(r));
}
const digest = (token: string) =>
  createHash('sha256')
    .update(env.SESSION_SECRET! + token)
    .digest('hex');
async function auth(token?: string): Promise<Actor> {
  requireThat(token && token.length < 200, '请重新打开 Activity 登录', 401);
  const row = db.get<any>(
    'SELECT * FROM auth_tokens WHERE hash=? AND expires_at>?',
    digest(token),
    Date.now(),
  );
  requireThat(row, '登录已到期，请重新打开 Activity', 401);
  const nun = await isNun(row.user_id);
  return { user: row.user_id, nun };
}
app.get('/api/config', (_req, res) =>
  res.json({
    client_id: env.DISCORD_CLIENT_ID,
    characters: manifest.characters,
    ssr_animations: manifest.ssr_animations,
  }),
);
app.get('/api/health', (_req, res) =>
  res.json({ ok: bot.client.isReady(), version: '0.1.0-candidate1' }),
);
app.post('/api/auth', async (req, res) => {
  rate('auth:' + req.ip, 30);
  requireThat(
    typeof req.body.code === 'string' && req.body.code.length <= 200,
    'OAuth code 无效',
    400,
  );
  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID!,
      client_secret: env.DISCORD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code: req.body.code,
    }),
    signal: AbortSignal.timeout(15000),
  });
  requireThat(response.ok, 'Discord OAuth 交换失败', 401);
  const data = (await response.json()) as any;
  requireThat(typeof data.access_token === 'string', 'Discord token 无效', 401);
  const identity = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: 'Bearer ' + data.access_token },
    signal: AbortSignal.timeout(15000),
  });
  requireThat(identity.ok, 'Discord 身份校验失败', 401);
  const user = (await identity.json()) as any;
  await bot.member(user.id);
  requireThat(
    req.body.guild_id === env.DISCORD_GUILD_ID &&
      req.body.channel_id === env.CONFESSIONAL_CHANNEL_ID,
    '请从指定服务器的忏悔室语音频道进入',
    403,
  );
  requireThat(
    await bot.inChannel(user.id, env.CONFESSIONAL_CHANNEL_ID!),
    '请先加入忏悔室语音频道',
    403,
  );
  const nun = await isNun(user.id),
    token = randomBytes(32).toString('base64url');
  db.run(
    'INSERT INTO auth_tokens VALUES(?,?,?,?)',
    digest(token),
    user.id,
    Number(nun),
    Date.now() + 2 * 3600000,
  );
  res.json({ access_token: data.access_token, token, role: nun ? 'nun' : 'confessor' });
});
app.get('/api/snapshot', async (req, res) => {
  const actor = await auth(req.headers.authorization?.replace(/^Bearer /, ''));
  rate(actor.user, 180);
  res.json(
    service.snapshot(actor, typeof req.query.session === 'string' ? req.query.session : undefined),
  );
});
const realtime = attachRealtime(server, {
  origins,
  authorize: auth,
  snapshot: (actor, id) => service.snapshot(actor, id),
  rate,
  closed: (id) => !!db.get<any>('SELECT closed_at FROM sessions WHERE id=?', id)?.closed_at,
});
const publish = () => realtime.publish();
app.post('/api/command', async (req, res) => {
  const actor = await auth(req.headers.authorization?.replace(/^Bearer /, ''));
  rate(actor.user, 90);
  const { request_id, operation, data } = req.body;
  requireThat(
    typeof operation === 'string' &&
      typeof request_id === 'string' &&
      data &&
      typeof data === 'object',
    '请求格式无效',
    400,
  );
  const result = await service.command(actor, request_id, operation, data);
  res.json(result);
  await publish();
});
// Same-origin cloud relay follows frozen raw_base. No client-supplied host or directory scanning.
const assets = new Map<string, { body: Buffer; type: string }>();
app.get('/cloud/assets/tarot/*path', async (req, res) => {
  const decoded = decodeURIComponent(req.path).replace('/cloud/', '');
  requireThat(!decoded.includes('..') && !decoded.includes('\\'), 'Invalid asset', 400);
  let target: string | undefined;
  const card = decoded.match(
    /^assets\/tarot\/cards\/([HP]-(?:TAT|REN|LYB)-\d{2})\.(webp|png|jpg|jpeg)$/,
  );
  if (card && manifest.cards.some((c: any) => c.id === card[1])) target = 'public/' + decoded;
  else
    for (const ch of Object.values(manifest.characters) as any[])
      for (const name of ch.art_pool)
        if ('public/' + decoded === ch.asset_dir + name) target = 'public/' + decoded;
  requireThat(target, '素材不存在', 404);
  const catalog = assetManifest.assets.find((a: any) => a.path === target);
  requireThat(catalog && catalog.enabled && !catalog.adult_only, '素材尚未启用或仅限成人模式', 404);
  const cache = assets.get(target);
  if (cache) {
    res.setHeader('Cache-Control', 'public,max-age=3600');
    return res.type(cache.type).send(cache.body);
  }
  const r = await fetch(
    manifest.asset_policy.raw_base + target.split('/').map(encodeURIComponent).join('/'),
    { signal: AbortSignal.timeout(12000) },
  );
  if (!r.ok) return res.sendStatus(404);
  const type = r.headers.get('content-type') || 'image/webp';
  requireThat(type.startsWith('image/'), 'Invalid image', 502);
  const body = Buffer.from(await r.arrayBuffer());
  requireThat(body.length <= 20 * 1024 * 1024, 'Image too large', 502);
  if (assets.size >= 80) assets.delete(assets.keys().next().value!);
  assets.set(target, { body, type });
  res.setHeader('Cache-Control', 'public,max-age=3600');
  res.type(type).send(body);
});
app.use(express.static(resolve('dist'), { maxAge: '1h' }));
app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(err instanceof AppError ? err.status : 500).json({
    error: err instanceof AppError ? err.message : '服务暂时不可用，请重试；当前判决已保留',
  });
});
let ticking = false;
const timer = setInterval(async () => {
  if (ticking) return;
  ticking = true;
  try {
    await effects.tick();
    const stale = db.all(
      "SELECT id,session_id FROM judgments WHERE execution_status='pending' AND created_at<?",
      Date.now() - 600000,
    );
    for (const j of stale) {
      db.run(
        "UPDATE judgments SET execution_status='expired',report=? WHERE id=?",
        JSON.stringify(['判决待结算窗口已过期；服务器效果未执行。']),
        j.id,
      );
      db.run("UPDATE sessions SET status='SETTLED' WHERE id=?", j.session_id);
    }
    await publish();
    const abandoned = db.all(
      "SELECT * FROM sessions WHERE closed_at IS NULL AND created_at<? AND status IN ('QUEUED','CONFESSING','SETTLED')",
      Date.now() - 24 * 3600000,
    );
    for (const s of abandoned) {
      db.run(
        "UPDATE sessions SET user_id=NULL,nun_id=NULL,closed_at=?,status='CLOSED' WHERE id=?",
        Date.now(),
        s.id,
      );
      db.run('DELETE FROM messages WHERE session_id=?', s.id);
      db.run('DELETE FROM requests WHERE user_id=?', s.user_id);
    }
    db.run(
      "UPDATE active_effects SET user_id='',original_value='null',applied_value='' WHERE status IN ('restored','manual_changed','superseded') AND created_at<?",
      Date.now() - 48 * 3600000,
    );
    db.run(
      'DELETE FROM requests WHERE rowid NOT IN (SELECT rowid FROM requests ORDER BY rowid DESC LIMIT 10000)',
    );
  } catch {
    console.error('Maintenance interrupted; durable tasks will retry.');
  } finally {
    ticking = false;
  }
}, 15000);
await effects.tick();
server.listen(Number(env.PORT || 3001), '0.0.0.0', () => console.log('Confessional backend ready'));
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    clearInterval(timer);
    realtime.close();
    server.close(() => {
      bot.client.destroy();
      db.db.close();
      process.exit(0);
    });
  });
