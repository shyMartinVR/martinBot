import { Database } from 'bun:sqlite';
import { Channel, GuildMember, Snowflake, User, VoiceBasedChannel } from 'discord.js';


type ChannelRow = {
  channelId: Snowflake;
  ownerId: Snowflake;
};

export default class ChannelDatabase {
  private database: Database;
  public constructor(path: string) {
    this.database = new Database(path, { create: true, strict: true });
    this.createTables();
  }

  private createTables() {
    this.database.run(`
      CREATE TABLE IF NOT EXISTS "channels" (
        "channelId" TEXT NOT NULL UNIQUE,
        "ownerId" TEXT NOT NULL,
        PRIMARY KEY("channelId")
      )
    `);
  }

  // #region Channel Management
  public getChannels(): ChannelRow[] {
    return this.database.query<ChannelRow, any>('SELECT channelId, ownerId FROM channels').all();
  }

  public setChannel(channel: VoiceBasedChannel, owner: GuildMember) {
    this.database.query(`
      INSERT INTO channels (channelId, ownerId) VALUES (:channelId, :ownerId)
      ON CONFLICT(channelId) DO UPDATE SET ownerId=excluded.ownerId`
    ).run({ channelId: channel.id, ownerId: owner.id });
  }

  public removeChannel(channel: Channel) {
    this.database.query('DELETE FROM channels WHERE channelId = :channelId')
      .run({ channelId: channel.id });
  }
  // #endregion
}
