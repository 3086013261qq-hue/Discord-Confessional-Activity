/** Isolated UI harness. Never imported by production; fake Discord port is test-only. */
import assert from 'node:assert/strict';
import { createServer as createViteServer } from 'vite';
import { chromium } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { setup } from './support';
import { cards, manifest } from '../server/cards';
const { db, service, discord } = setup(':memory:', {
  enabled: true,
  reply: async () => '先说说发生了什么，我听着。',
  verdict: async () => ({ verdict: 'heaven', reason: '愿你今晚好好休息。' }),
});
const vite = await createViteServer({
  configFile: 'vite.config.ts',
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
  plugins: [
    {
      name: 'isolated-ui-harness',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          try {
            const url = new URL(req.url || '', 'http://localhost');
            if (process.env.TEST_FONT_DIR && url.pathname.startsWith('/__font/')) {
              const rel = url.pathname.slice('/__font/'.length);
              if (rel.includes('..')) throw Error('Invalid font');
              res.setHeader('Content-Type', rel.endsWith('.css') ? 'text/css' : 'font/woff2');
              res.end(readFileSync(process.env.TEST_FONT_DIR + '/' + rel));
              return;
            }
            if (url.pathname.startsWith('/cloud/')) {
              res.statusCode = 404;
              res.end();
              return;
            }
            if (url.pathname === '/client/api.ts') {
              res.setHeader('Content-Type', 'application/javascript');
              res.end(`
let role=new URLSearchParams(location.search).get('role')||'confessor';
const headers={'Content-Type':'application/json','x-test-role':role};let current;
export async function boot(){return {role};}
export async function snapshot(session){const r=await fetch('/__test/snapshot'+(session?'?session='+session:''),{headers});return r.json();}
export async function command(operation,data,request_id=crypto.randomUUID()){const r=await fetch('/__test/command',{method:'POST',headers,body:JSON.stringify({operation,data,request_id})});const out=await r.json();if(!r.ok)throw Error(out.error);return out;}
export function connect(cb,status){let alive=true;const poll=async()=>{if(!alive)return;cb(await snapshot(current));status('已连接');};void poll();const t=setInterval(poll,120);return {subscribe(id){current=id;void poll();},close(){alive=false;clearInterval(t);}};}
`);
              return;
            }
            if (url.pathname.startsWith('/__test/')) {
              const actor = {
                user:
                  req.headers['x-test-role'] === 'nun'
                    ? 'nun'
                    : req.headers['x-test-role'] === 'spectator'
                      ? 'watcher'
                      : 'soul',
                nun: req.headers['x-test-role'] === 'nun',
              };
              res.setHeader('Content-Type', 'application/json');
              if (url.pathname === '/__test/snapshot')
                res.end(
                  JSON.stringify(
                    service.snapshot(actor, url.searchParams.get('session') || undefined),
                  ),
                );
              else {
                let body = '';
                for await (const chunk of req) body += chunk;
                const m = JSON.parse(body);
                res.end(
                  JSON.stringify(await service.command(actor, m.request_id, m.operation, m.data)),
                );
              }
              return;
            }
            next();
          } catch (e) {
            res.statusCode = 409;
            res.end(JSON.stringify({ error: (e as Error).message }));
          }
        });
      },
    },
  ],
});
await vite.listen();
let browser;
const results: string[] = [];
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const mobile = await browser.newContext({
    viewport: { width: 360, height: 800 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  if (process.env.TEST_FONT_DIR)
    await mobile.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/__font/400.css';
        document.head.append(link);
        const style = document.createElement('style');
        style.textContent = ":root{font-family:'Noto Serif SC',serif}";
        document.head.append(style);
      });
    });
  const page = await mobile.newPage();
  const nun = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  nun.on('pageerror', (e) => errors.push(e.message));
  mkdirSync('qa/screenshots', { recursive: true });
  await page.goto('http://127.0.0.1:4173');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'qa/screenshots/mobile-entrance.png', fullPage: true });
  await page.getByRole('button', { name: /以忏悔者身份进入/ }).click();
  await nun.goto('http://127.0.0.1:4173/?role=nun');
  await nun.getByRole('button', { name: '以修女身份进入', exact: true }).click();
  await nun.getByRole('button', { name: /上钟接待/ }).click();
  await page.getByRole('button', { name: '文字模式', exact: true }).click();
  await page.getByLabel('匿名消息').fill('我今天又熬夜了');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await nun.getByText('我今天又熬夜了', { exact: true }).waitFor();
  await nun.getByLabel('打开修女贴纸').click();
  await nun.getByLabel('发送贴纸 nun_16', { exact: true }).click();
  await page.getByAltText('修女表情贴纸').waitFor();
  const spectator = await browser.newPage({
    viewport: { width: 360, height: 800 },
    reducedMotion: 'reduce',
  });
  await spectator.goto('http://127.0.0.1:4173/?role=spectator');
  await spectator.getByRole('button', { name: '只围观', exact: true }).click();
  await spectator.getByText('我今天又熬夜了', { exact: true }).waitFor();
  assert.equal(await spectator.getByLabel('匿名消息').count(), 0);
  assert.equal(await spectator.getByRole('button', { name: '忏悔结束', exact: true }).count(), 0);
  results.push('360x800 anonymous three-client chat, sticker and read-only spectator PASS');
  assert.equal(await nun.getByRole('button', { name: '🔥 地狱', exact: true }).count(), 0);
  await nun.getByRole('button', { name: '忏悔结束', exact: true }).click();
  await nun.getByRole('button', { name: '🔥 地狱', exact: true }).click();
  await page.getByLabel('选择第 3 张塔罗牌').waitFor();
  for (let n = 1; n <= 5; n++) {
    const box = await page.getByLabel(`选择第 ${n} 张塔罗牌`).boundingBox();
    assert.ok(box && box.width >= 44 && box.height >= 44);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await spectator.getByLabel('选择第 3 张塔罗牌').waitFor();
  assert.equal(await spectator.getByLabel('选择第 3 张塔罗牌').isDisabled(), true);
  await page.getByLabel('选择第 3 张塔罗牌').click();
  await page.getByRole('button', { name: '接受判决并执行', exact: true }).click();
  await page.getByText('判决已结算', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('判决已结算', { exact: true }).waitFor();
  assert.equal(db.all('SELECT * FROM judgments').length, 1);
  assert.equal(discord.calls.filter((v) => v.startsWith('nickname')).length, 1);
  results.push('five targets >=44px; manual choice, execution and reload idempotency PASS');
  mkdirSync('qa/screenshots', { recursive: true });
  await page.screenshot({ path: 'qa/screenshots/mobile-settled.png', fullPage: true });
  // All six frozen SSR keys run through the real service and full React ceremony. Test-only DB fixture injection.
  for (const c of cards.filter((c) => c.rarity === 'SSR')) {
    await service.command({ user: 'soul', nun: false }, randomUUID(), 'close', {
      id: service.snapshot({ user: 'soul', nun: false }).session!.id,
    });
    const { id } = await service.command({ user: 'soul', nun: false }, randomUUID(), 'start', {});
    await service.command({ user: 'nun', nun: true }, randomUUID(), 'claim', { id });
    await service.command({ user: 'soul', nun: false }, randomUUID(), 'mode', { id, mode: 'text' });
    await service.command({ user: 'nun', nun: true }, randomUUID(), 'end_confession', { id });
    await service.command({ user: 'nun', nun: true }, randomUUID(), 'verdict', {
      id,
      verdict: c.id.startsWith('H') ? 'heaven' : 'hell',
    });
    const j = service.snapshot({ user: 'soul', nun: false }).judgment!;
    db.run('UPDATE judgments SET card_id=? WHERE id=?', c.id, j.id);
    await page.reload();
    await page.getByLabel('选择第 1 张塔罗牌').waitFor();
    assert.equal(
      await page.locator('.ceremony').getAttribute('data-animation'),
      manifest.ssr_animations[c.id].key,
    );
    await page.getByLabel('选择第 1 张塔罗牌').click();
    await page.getByRole('heading', { name: c.name, exact: true }).first().waitFor();
    if (c.id === 'P-REN-10') {
      await page.getByRole('button', { name: '请求宽恕（仅一次）' }).click();
      await page.getByRole('button', { name: '确认求饶', exact: true }).click();
    }
    if (c.id === 'P-LYB-10') await page.getByRole('button', { name: /庄家，我认输/ }).click();
    await page.getByRole('button', { name: '接受判决并执行', exact: true }).click();
    await page.getByText('判决已结算', { exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    results.push(c.animation_key + ' render and settlement PASS');
  }
  // Native voice UI changes only server mode; no browser microphone permission is requested.
  let active = service.snapshot({ user: 'soul', nun: false }).session!;
  await service.command({ user: 'soul', nun: false }, randomUUID(), 'close', { id: active.id });
  await page.reload();
  await page.getByRole('button', { name: /以忏悔者身份进入/ }).click();
  await nun.reload();
  await nun.getByRole('button', { name: /上钟接待/ }).click();
  await page.getByRole('button', { name: '勇者模式 · 本音', exact: true }).click();
  await nun.getByRole('button', { name: '语音 · Discord 原生开麦', exact: true }).click();
  await page.getByText(/勇者模式 · Discord 原生开麦、本音/).waitFor();
  assert.equal(service.snapshot({ user: 'soul', nun: false }).session?.reply_mode, 'voice');
  results.push('brave native voice UI + independent nun voice reply, no getUserMedia PASS');
  active = service.snapshot({ user: 'soul', nun: false }).session!;
  await service.command({ user: 'soul', nun: false }, randomUUID(), 'close', { id: active.id });
  await nun.reload();
  await nun.getByRole('button', { name: '🐋 向大肥鱼忏悔 · 仅文字', exact: true }).click();
  await nun.getByLabel('匿名消息').fill('我今天心情不好');
  await nun.getByRole('button', { name: '发送', exact: true }).click();
  await nun.getByText('先说说发生了什么，我听着。', { exact: true }).waitFor();
  assert.equal(await nun.getByRole('button', { name: /原生开麦/ }).count(), 0);
  assert.equal(await nun.getByRole('button', { name: '勇者模式 · 本音', exact: true }).count(), 0);
  await nun.getByRole('button', { name: '请大肥鱼判决', exact: true }).click();
  await nun.getByLabel('选择第 1 张塔罗牌').click();
  await nun.getByRole('button', { name: '接受判决并执行', exact: true }).click();
  await nun.getByText('判决已结算', { exact: true }).waitFor();
  results.push(
    'eligible nun -> AI confessor, text only, five-choice and settlement (fake provider) PASS',
  );
  assert.deepEqual(errors, []);
  await spectator.close();
  await mobile.close();
  await nun.close();
  writeFileSync(
    'qa/browser-results.json',
    JSON.stringify(
      {
        environment:
          'Headless Chromium, simulated touch 360x800, test-only Discord adapter; NOT real Android/Discord',
        results,
        page_errors: errors,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(results.join('\n'));
} finally {
  await browser?.close();
  await vite.close();
  db.db.close();
}
