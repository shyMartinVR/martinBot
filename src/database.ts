import { Database } from 'bun:sqlite';
import { GuildMember, Snowflake, VoiceBasedChannel } from 'discord.js';

type ChannelRow = {
  channelId: Snowflake;
  ownerId: Snowflake;
};

export default class ChannelDatabase {
  private database: Database;
  public constructor(path: string) {
    this.database = new Database(path, { create: true });
    this.createTables();
  }

  createTables() {
    this.database.run(`
      CREATE TABLE IF NOT EXISTS "channels" (
        "channelId"	INTEGER NOT NULL UNIQUE,
        "ownerId"	INTEGER NOT NULL,
        PRIMARY KEY("channelId")
      )
    `);
  }

  getChannels(): ChannelRow[] {
    return this.database.query<ChannelRow, any>('SELECT channelId, ownerId FROM channels').all();
  }

  setChannel(channel: VoiceBasedChannel | Snowflake, owner: GuildMember | Snowflake) {
    const channelId = typeof channel === 'string' ? channel : channel.id;
    const ownerId = typeof owner === 'string' ? owner : owner.id;
    this.database.run('INSERT INTO channels (channelId, ownerId) VALUES (?, ?) ON CONFLICT(channelId) DO UPDATE SET channels=excluded.ownerId', [channelId, ownerId]);
  }

  removeChannel(channel: VoiceBasedChannel | Snowflake) {
    const channelId = typeof channel === 'string' ? channel : channel.id;
    this.database.run('DELETE FROM channels WHERE channelId = ?', [channelId]);
  }
}
