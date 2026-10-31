import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export class Store {
  db: DatabaseSync;
  constructor(path = 'data/confessional.sqlite') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(readFileSync(new URL('./migrations/001.sql', import.meta.url), 'utf8'));
    const columns = new Set(this.all<any>('PRAGMA table_info(sessions)').map((c) => c.name));
    for (const [name, type] of Object.entries({
      instance_id: "TEXT NOT NULL DEFAULT 'default'",
      kind: "TEXT NOT NULL DEFAULT 'human'",
      mode: 'TEXT',
      reply_mode: "TEXT NOT NULL DEFAULT 'text'",
      mode_deadline: 'INTEGER',
      confessor_disconnected_at: 'INTEGER',
      nun_disconnected_at: 'INTEGER',
      poll_id: 'TEXT',
    })) {
      if (!columns.has(name)) this.db.exec(`ALTER TABLE sessions ADD COLUMN ${name} ${type}`);
    }
    if (!this.get('SELECT 1 FROM metadata WHERE key=?', 'candidate2:migrated'))
      this.tx(() => {
        // Never announce old Candidate1 results on upgrade.
        for (const j of this.all<any>('SELECT id FROM judgments WHERE report IS NOT NULL'))
          this.run(
            'INSERT OR IGNORE INTO metadata VALUES(?,?)',
            'channel_posted:' + j.id,
            JSON.stringify({ status: 'legacy_skipped' }),
          );
        this.run('INSERT INTO metadata VALUES(?,?)', 'candidate2:migrated', '1');
      });
    this.run("UPDATE active_effects SET status='ignored' WHERE kind='state'");
    // Old Role records are historical only. Never call Discord Role writes, even during recovery.
    this.run("UPDATE active_effects SET status='legacy_retired' WHERE kind='role'");
  }
  get<T = any>(sql: string, ...args: any[]): T | undefined {
    return this.db.prepare(sql).get(...args) as T | undefined;
  }
  all<T = any>(sql: string, ...args: any[]): T[] {
    return this.db.prepare(sql).all(...args) as T[];
  }
  run(sql: string, ...args: any[]) {
    return this.db.prepare(sql).run(...args);
  }
  tx<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
}
export class Locks {
  private tails = new Map<string, Promise<unknown>>();
  async use<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) || Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    this.tails.set(key, next);
    try {
      return await next;
    } finally {
      if (this.tails.get(key) === next) this.tails.delete(key);
    }
  }
}
