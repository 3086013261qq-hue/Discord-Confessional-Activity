import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  type MessageCreateOptions,
} from 'discord.js';
export interface Member {
  nickname: string | null;
  display: string;
  roles: string[];
}
export interface DiscordPort {
  member(user: string): Promise<Member>;
  nickname(user: string, value: string | null): Promise<void>;
  send(payload: MessageCreateOptions): Promise<string>;
}
export class DiscordBot implements DiscordPort {
  client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
  constructor(
    private guildId: string,
    private channelId: string,
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
  async send(payload: MessageCreateOptions) {
    const channel = await this.client.channels.fetch(this.channelId);
    if (!channel?.isSendable()) throw Error('CHANNEL_NOT_SENDABLE');
    const message = await channel.send({ ...payload, allowedMentions: { parse: [] } });
    return message.id;
  }
}
