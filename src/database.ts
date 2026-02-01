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
    this.database.run(`
      CREATE TABLE IF NOT EXISTS "custom_channel_names" (
        "userId" TEXT NOT NULL UNIQUE,
        "customName" TEXT NOT NULL,
        PRIMARY KEY("userId")
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

  // #region Custom Channel Name
  public setCustomChannelName(user: User, customName: string) {
    this.database.query(`
      INSERT INTO custom_channel_names (userId, customName) VALUES (:userId, :customName)
      ON CONFLICT(userId) DO UPDATE SET customName=excluded.customName
    `).run({ userId: user.id, customName });
  }

  public removeCustomChannelName(user: User) {
    this.database.query('DELETE FROM custom_channel_names WHERE userId = :userId')
      .run({ userId: user.id });
  }

  public getCustomChannelName(user: User): string | null {
    const row = this.database.query<{ customName: string }, any>(
      'SELECT customName FROM custom_channel_names WHERE userId = :userId'
    ).get({ userId: user.id });
    return row ? row.customName : null;
  }
  // #endregion
}
