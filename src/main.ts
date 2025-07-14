import {  Client, Events, GatewayIntentBits } from 'discord.js';
import DynamicChannelManager from './dynamicChannelManager';
import Database from './database';


const { DISCORD_TOKEN, SETUP_CHANNEL_ID, DATABASE_PATH } = process.env;

if(!DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN environment variable is not set.');
}

if(!SETUP_CHANNEL_ID) {
  throw new Error('SETUP_CHANNEL_ID environment variable is not set.');
}

if(!DATABASE_PATH) {
  throw new Error('DATABASE_PATH environment variable is not set.');
}

const database = new Database(DATABASE_PATH);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

client.on(Events.ClientReady, async readyClient => {
  console.info('Logged in as',readyClient.user.tag);
  const setupChannel = await readyClient.channels.fetch(SETUP_CHANNEL_ID);
  if (!setupChannel || !setupChannel.isVoiceBased()) {
    throw new Error(`Channel with ID ${SETUP_CHANNEL_ID} is not a valid voice channel.`);
  }
  const dynamicCategory = setupChannel.parent;
  if (!dynamicCategory) {
    throw new Error(`SetupChannel ${setupChannel} does not belong to a valid category.`);
  }
  new DynamicChannelManager(readyClient, setupChannel, dynamicCategory, database);
});

client.login(DISCORD_TOKEN);
