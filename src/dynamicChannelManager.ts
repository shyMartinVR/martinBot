import {  CategoryChannel, Client, Collection, Events, Interaction, Snowflake, VoiceBasedChannel, VoiceState } from 'discord.js';
import DynamicChannel, { DynamicChannelInteraction } from './dynamicChannel';


export default class DynamicChannelManager {
  private client: Client<true>;
  private setup: VoiceBasedChannel;
  private parent: CategoryChannel;
  private channels: Collection<Snowflake, DynamicChannel> = new Collection();

  constructor(client: Client<true>, setupChannel: VoiceBasedChannel, dynamicCategory: CategoryChannel) {
    this.client = client;
    this.setup = setupChannel;
    this.parent = dynamicCategory;

    client.on(Events.InteractionCreate, this.onInteractionCreate.bind(this));
    client.on(Events.VoiceStateUpdate, this.onVoiceStateUpdate.bind(this));
  }

  private onInteractionCreate(interaction: Interaction) {
    if(!interaction.channelId || !this.channels.has(interaction.channelId)) {
      console.warn('No dynamic channel found for interaction in channel', interaction.channelId);
      return;
    }

    const channel = this.channels.get(interaction.channelId)!;

    if (interaction.isButton()) {
      if(interaction.customId === DynamicChannelInteraction.RenameButton) {
        channel.handleRenameButton(interaction);
      }
    } else if (interaction.isModalSubmit()) {
      if(interaction.customId === DynamicChannelInteraction.RenameModal) {
        channel.handleRenameModal(interaction);
      }
    }
  }

  private async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    // No change in voice channel
    if (newState.channelId === oldState.channelId) {
      return;
    }

    // User left a dynamic channel
    if (oldState.member && oldState.channel?.id && this.channels.has(oldState.channel.id)) {
      console.info(oldState.member.displayName, 'left', oldState.channel?.name);

      const dynamicChannel = this.channels.get(oldState.channel.id)!;
      dynamicChannel.removeMember(oldState.member);
      console.assert(dynamicChannel.members.size === oldState.channel.members.size, `Member count mismatch in channel ${oldState.channel.name}. Expected: ${dynamicChannel.members.size}, Actual: ${oldState.channel.members.size}`);
      if (dynamicChannel.isEmpty()) {
        console.info('Deleting', dynamicChannel.channel.name);
        dynamicChannel.channel.delete();
        this.channels.delete(dynamicChannel.channel.id);
      }
    }

    // User joined setup channel
    if (newState.member && newState.channel?.id === this.setup.id) {
      console.info(newState.member.displayName, 'joined setup channel');

      const newChannel = await DynamicChannel.create(newState.member, this.parent, this.setup.position + 1)
      this.channels.set(newChannel.channel.id, newChannel);
      newState.member.voice.setChannel(newChannel.channel);
    }
    
    // User joined an existing dynamic channel
    if (newState.member && newState.channel?.id && this.channels.has(newState.channel.id)) {
      console.info(newState.member.displayName, 'joined', newState.channel?.name);    

      const dynamicChannel = this.channels.get(newState.channel.id)!;
      dynamicChannel.addMember(newState.member);
      console.assert(dynamicChannel.members.size === newState.channel.members.size, `Member count mismatch in channel ${newState.channel.name}. Expected: ${dynamicChannel.members.size}, Actual: ${newState.channel.members.size}`);
    }
  }
}