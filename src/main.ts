import {  CategoryChannel, Client, Collection, Events, GatewayIntentBits, Snowflake, VoiceChannel } from 'discord.js';
import DynamicChannel from './dynamicChannel';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

let setupChannel: VoiceChannel | null = null;
let dynamicCategory: CategoryChannel | null = null;

client.on(Events.ClientReady, async readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}!`);
  setupChannel = await readyClient.channels.fetch(process.env.SETUP_CHANNEL!) as VoiceChannel;
  dynamicCategory = setupChannel.parent;
});

client.on(Events.InteractionCreate, async interaction => {  
  if (interaction.isButton() && interaction.customId === 'dynamicChannelRename' && dynamicChannels.has(interaction.channelId)) {
    dynamicChannels.get(interaction.channelId)!.handleRenameButton(interaction);
  } else if (interaction.isModalSubmit() && interaction.customId === 'renameChannelModal' && interaction.channelId && dynamicChannels.has(interaction.channelId)) {
      dynamicChannels.get(interaction.channelId)!.handleRenameModal(interaction);
  }
});

const dynamicChannels = new Collection<Snowflake, DynamicChannel>();

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (!setupChannel || !dynamicCategory) {
    console.error('Setup channel or dynamic category not initialized.');
    return;
  };

  if (newState.channelId === oldState.channelId) {
    return; // No change in voice channel
  }

  if (newState.member && newState.channelId === setupChannel.id) {
    // User joined the setup channel
    const position = (dynamicChannels.last()?.channel.position ?? setupChannel.position) + 1;
    const newChannel = await DynamicChannel.create(newState.member, dynamicCategory, position);
    newState.member.voice.setChannel(newChannel.channel);
    dynamicChannels.set(newChannel.channel.id, newChannel);
  }
  
  if (newState.member && newState.channelId && dynamicChannels.has(newState.channelId)) {
    // User joined an existing dynamic channel
    const dynamicChannel = dynamicChannels.get(newState.channelId)!;
    dynamicChannel.addMember(newState.member);
  }
  
  if (oldState.member && oldState.channelId && dynamicChannels.has(oldState.channelId)) {
    // User left a dynamic channel
    const dynamicChannel = dynamicChannels.get(oldState.channelId)!;
    dynamicChannel.removeMember(oldState.member);
    if (dynamicChannel.isEmpty()) {
      dynamicChannels.delete(oldState.channelId);
      oldState.channel?.delete().catch(console.error);
    }
  }
});

client.login(process.env.TOKEN);