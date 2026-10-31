import { Store } from '../server/db';
import { Effects } from '../server/effects';
import { Service } from '../server/service';
import type { DiscordPort, Member } from '../server/discord';
export class FakeDiscord implements DiscordPort {
  members = new Map<string, Member>();
  roles = new Map<string, string>();
  calls: string[] = [];
  denied = '';
  async member(user: string) {
    if (!this.members.has(user))
      this.members.set(user, { nickname: '原昵称', display: 'Test', roles: [] });
    return structuredClone(this.members.get(user)!);
  }
  async nickname(user: string, value: string | null) {
    if (this.denied) throw Error(this.denied);
    this.calls.push('nickname:' + user + ':' + value);
    await this.member(user);
    this.members.get(user)!.nickname = value;
  }
  async ensureRole(name: string, known?: string) {
    if (this.denied) throw Error(this.denied);
    if (known) return known;
    const id = 'role-' + this.roles.size;
    this.roles.set(name, id);
    return id;
  }
  async addRole(user: string, role: string) {
    if (this.denied) throw Error(this.denied);
    this.calls.push('add:' + user + ':' + role);
    await this.member(user);
    this.members.get(user)!.roles.push(role);
  }
  async removeRole(user: string, role: string) {
    if (this.denied) throw Error(this.denied);
    this.calls.push('remove:' + user + ':' + role);
    await this.member(user);
    this.members.get(user)!.roles = this.members.get(user)!.roles.filter((r) => r !== role);
  }
}
export function setup(path = ':memory:') {
  let now = 1800000000000;
  const db = new Store(path),
    discord = new FakeDiscord(),
    effects = new Effects(
      db,
      discord,
      () => 0.25,
      () => now,
    ),
    service = new Service(
      db,
      effects,
      () => 0.25,
      () => now,
    );
  return {
    db,
    discord,
    effects,
    service,
    time: {
      get now() {
        return now;
      },
      advance(ms: number) {
        now += ms;
      },
    },
  };
}
