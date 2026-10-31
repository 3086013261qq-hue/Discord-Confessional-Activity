/** Offline only: operator must visually verify delivery before resolving an ambiguous outbox intent. */
import 'dotenv/config';
import { Store } from '../server/db.js';
const [key, value] = process.argv.slice(2);
if (
  !key ||
  !/^(community_poll|channel_posted):[a-zA-Z0-9-]+$/.test(key) ||
  !value ||
  !(value === '--not-sent' || /^\d{10,22}$/.test(value))
)
  throw Error('Usage (service stopped): npm run recover:channel -- KEY MESSAGE_ID|--not-sent');
const db = new Store(
  process.env.DATABASE_URL?.replace(/^sqlite:/, '') || 'data/confessional.sqlite',
);
try {
  const current = db.get<any>('SELECT value FROM metadata WHERE key=?', key);
  if (!current || !['sending', 'uncertain'].includes(JSON.parse(current.value).status))
    throw Error('No ambiguous delivery intent');
  if (value === '--not-sent') db.run('DELETE FROM metadata WHERE key=?', key);
  else {
    db.run(
      'UPDATE metadata SET value=? WHERE key=?',
      JSON.stringify({ status: 'sent', id: value }),
      key,
    );
    if (key.startsWith('community_poll:'))
      db.run(
        "UPDATE sessions SET poll_id=?,status='COMMUNITY_VOTE' WHERE id=? AND closed_at IS NULL AND status='CONFESSING'",
        value,
        key.slice('community_poll:'.length),
      );
  }
  console.log('Channel delivery record resolved.');
} finally {
  db.db.close();
}
