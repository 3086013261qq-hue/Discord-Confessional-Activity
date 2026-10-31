import { createHash } from 'node:crypto';
import type { DiscordPort } from './discord.js';
import { Store, Locks } from './db.js';
import { artUrls, byId, manifest, assetManifest } from './cards.js';
export class ChannelPosts {
  private locks = new Locks();
  constructor(
    private db: Store,
    private discord: DiscordPort,
    private origin: string,
    private context?: { guild: string; channel: string },
  ) {}
  pollUrl(id: string) {
    return this.context
      ? `https://discord.com/channels/${this.context.guild}/${this.context.channel}/${id}`
      : undefined;
  }
  private async once(key: string, payload: Parameters<DiscordPort['send']>[0]) {
    return this.locks.use(key, async () => {
      const old = this.db.get<any>('SELECT value FROM metadata WHERE key=?', key);
      if (old) {
        const state = JSON.parse(old.value);
        if (state.id) return state.id as string;
        // An interrupted send is ambiguous: do not resend after restart and risk duplicate posts.
        throw Error('CHANNEL_DELIVERY_UNCERTAIN');
      }
      this.db.run('INSERT INTO metadata VALUES(?,?)', key, JSON.stringify({ status: 'sending' }));
      try {
        const nonce = BigInt(
          '0x' + createHash('sha256').update(key).digest('hex').slice(0, 16),
        ).toString();
        const id = await this.discord.send({ ...payload, nonce, enforceNonce: true });
        this.db.run(
          'UPDATE metadata SET value=? WHERE key=?',
          JSON.stringify({ status: 'sent', id }),
          key,
        );
        return id;
      } catch (error) {
        // Discord explicitly rejected the request: no message exists, so retry is safe.
        const status = (error as any)?.status;
        if (Number.isInteger(status) && status >= 400 && status < 500 && status !== 429) {
          this.db.run('DELETE FROM metadata WHERE key=?', key);
          throw Error('CHANNEL_SEND_REJECTED');
        }
        this.db.run(
          'UPDATE metadata SET value=? WHERE key=?',
          JSON.stringify({ status: 'uncertain' }),
          key,
        );
        throw Error('CHANNEL_DELIVERY_UNCERTAIN');
      }
    });
  }
  poll(s: any) {
    return this.once('community_poll:' + s.id, {
      content: s.anonymous_id + ' · 群众意见仅供参考，最终裁决由当值修女决定。',
      poll: {
        question: { text: '这个迷途灵魂应该——' },
        answers: [{ text: '😇 上天堂' }, { text: '🔥 下地狱' }],
        duration: 1,
        allowMultiselect: false,
      },
    });
  }
  async result(s: any, j: any) {
    const c = byId.get(j.card_id)!;
    // Use a catalogued, enabled fallback instead of a possibly missing dedicated override.
    const urls = artUrls(c);
    const image =
      urls.find((url) =>
        assetManifest.assets.some(
          (a: any) =>
            a.path === 'public/' + decodeURIComponent(url.split('?')[0].replace('/cloud/', '')) &&
            a.enabled &&
            !a.adult_only,
        ),
      ) || urls.at(-1)!;
    return this.once('channel_posted:' + j.id, {
      embeds: [
        {
          title: '⛪ 忏悔室判决 · ' + (j.verdict === 'heaven' ? '天堂' : '地狱'),
          description: s.anonymous_id + '\n最终裁决由当值修女决定',
          fields: [
            { name: '当值修女', value: s.kind === 'ai' ? '大肥鱼' : '真人修女' },
            {
              name: '角色 · 稀有度 · 牌名',
              value: `${({ tatsumaki: '龙卷', ren_yamashiro: '山城恋', yuzuha_lee: '李柚巴' } as Record<string, string>)[c.character]} · ${c.rarity} · ${c.name}`,
            },
            {
              name: '最终昵称、持续时间与内部状态',
              value:
                (JSON.parse(j.report || '[]') as string[]).join('\n').slice(0, 1024) || '已结算',
            },
          ],
          image: { url: new URL(image, this.origin).href },
          color: j.verdict === 'heaven' ? 0xead79e : 0x8b2030,
        },
      ],
    });
  }
}
