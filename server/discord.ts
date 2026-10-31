import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
export interface Member {
  nickname: string | null;
  display: string;
  roles: string[];
}
export interface DiscordPort {
  member(user: string): Promise<Member>;
  nickname(user: string, value: string | null): Promise<void>;
  ensureRole(name: string, known?: string): Promise<string>;
  addRole(user: string, role: string): Promise<void>;
  removeRole(user: string, role: string): Promise<void>;
}
export class DiscordBot implements DiscordPort {
  client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
  constructor(
    private guildId: string,
    private saveRole: (name: string, id: string) => void,
  ) {}
  async start(token: string) {
    await this.client.login(token);
    if (!this.client.isReady())
      await new Promise<void>((resolve) => this.client.once('clientReady', () => resolve()));
  }
  async guild() {
    return this.client.guilds.fetch(this.guildId);
  }
  async member(user: string) {
    const m = await (await this.guild()).members.fetch({ user, force: true });
    return {
      nickname: m.nickname,
      display: m.user.globalName || m.user.username,
      roles: [...m.roles.cache.keys()],
    };
  }
  async inChannel(user: string, channel: string) {
    const g = await this.guild();
    return g.voiceStates.cache.get(user)?.channelId === channel;
  }
  async nickname(user: string, value: string | null) {
    const g = await this.guild(),
      m = await g.members.fetch({ user, force: true }),
      me = await g.members.fetchMe();
    if (!me.permissions.has(PermissionFlagsBits.ManageNicknames))
      throw Error('MISSING_MANAGE_NICKNAMES');
    if (!m.manageable) throw Error('ROLE_HIERARCHY_BLOCKED');
    await m.setNickname(value, 'Confessional temporary judgment / safe restore');
  }
  async ensureRole(name: string, known?: string) {
    const g = await this.guild();
    const me = await g.members.fetchMe();
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) throw Error('MISSING_MANAGE_ROLES');
    if (known) {
      const r = await g.roles.fetch(known);
      if (r) {
        if (r.permissions.bitfield !== 0n || r.mentionable || r.managed)
          throw Error('ROLE_NOT_COSMETIC');
        if (r.position >= me.roles.highest.position) throw Error('ROLE_HIERARCHY_BLOCKED');
        return r.id;
      }
    }
    // Exact frozen role names; the database is the ownership metadata. Never adopt an existing same-name role.
    const r = await g.roles.create({
      name,
      permissions: [],
      mentionable: false,
      hoist: false,
      reason: 'Confessional managed cosmetic role',
    });
    this.saveRole(name, r.id);
    return r.id;
  }
  async addRole(user: string, role: string) {
    const g = await this.guild(),
      m = await g.members.fetch({ user, force: true });
    await this.ensureKnownCosmetic(g, role);
    await m.roles.add(role, 'Confessional temporary judgment');
  }
  async removeRole(user: string, role: string) {
    const g = await this.guild(),
      m = await g.members.fetch({ user, force: true });
    await m.roles.remove(role, 'Confessional effect expiry');
  }
  private async ensureKnownCosmetic(g: Awaited<ReturnType<DiscordBot['guild']>>, id: string) {
    const r = await g.roles.fetch(id),
      me = await g.members.fetchMe();
    if (!r || r.permissions.bitfield !== 0n || r.mentionable || r.managed)
      throw Error('ROLE_NOT_COSMETIC');
    if (r.position >= me.roles.highest.position) throw Error('ROLE_HIERARCHY_BLOCKED');
  }
}
