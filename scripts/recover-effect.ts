import 'dotenv/config';
import { Store } from '../server/db';
import { DiscordBot } from '../server/discord';
import { Effects } from '../server/effects';
const id = process.argv[2];
if (!id) throw Error('Usage: npm run recover -- EFFECT_ID');
const db = new Store(
  process.env.DATABASE_URL?.replace(/^sqlite:/, '') || 'data/confessional.sqlite',
);
const e = db.get<any>('SELECT * FROM active_effects WHERE id=?', id);
if (!e) throw Error('Effect not found');
const bot = new DiscordBot(process.env.DISCORD_GUILD_ID!, () => {
  throw Error('Recovery must not create roles');
});
try {
  await bot.start(process.env.DISCORD_BOT_TOKEN!);
  if (e.kind === 'role' && !db.get('SELECT 1 FROM managed_roles WHERE role_id=?', e.applied_value))
    throw Error('Unowned role; refusing recovery');
  const effects = new Effects(db, bot);
  await effects.restore(e);
  console.log('Recovery complete; inspect effect status.');
} finally {
  bot.client.destroy();
  db.db.close();
}
