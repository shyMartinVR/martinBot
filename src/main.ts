import { Environment } from './environment';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { DynamicChannelManager } from './dynamicChannelManager';
import Database from './database';

const database = new Database(Environment.databasePath);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

client.on(Events.ClientReady, async readyClient => {
  console.info('Logged in as', readyClient.user.tag);
  const setupChannel = await readyClient.channels.fetch(Environment.setupChannelId);
  if (!setupChannel || !setupChannel.isVoiceBased()) {
    throw new Error(`Channel with ID ${Environment.setupChannelId} is not a valid voice channel.`);
  }
  const dynamicCategory = setupChannel.parent;
  if (!dynamicCategory) {
    throw new Error(`SetupChannel ${setupChannel} does not belong to a valid category.`);
  }
  new DynamicChannelManager(readyClient, setupChannel, dynamicCategory, database);
});

client.login(Environment.discordToken);
