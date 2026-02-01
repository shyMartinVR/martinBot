import { CategoryChannel, ChatInputCommandInteraction, Client, Collection, Events, Interaction, Snowflake, VoiceBasedChannel, VoiceState } from 'discord.js';
import DynamicChannel, { DynamicChannelInteraction } from './dynamicChannel';
import ChannelDatabase from './database';


export class DynamicChannelManager {
  private client: Client<true>;
  private setup: VoiceBasedChannel;
  private parent: CategoryChannel;
  private channels: Collection<Snowflake, DynamicChannel> = new Collection();
  private database: ChannelDatabase;

  constructor(client: Client<true>, setupChannel: VoiceBasedChannel, dynamicCategory: CategoryChannel, database: ChannelDatabase) {
    this.client = client;
    this.setup = setupChannel;
    this.parent = dynamicCategory;
    this.database = database;
    this.loadFromDatabase();

    client.on(Events.InteractionCreate, this.onInteractionCreate.bind(this));
    client.on(Events.VoiceStateUpdate, this.onVoiceStateUpdate.bind(this));
  }

  private async loadFromDatabase() {
    try {
      const rows = this.database.getChannels();
      for (const { channelId, ownerId } of rows) {
        const channel = await this.client.channels.fetch(channelId);
        if (!channel || !channel.isVoiceBased()) {
          console.warn('Channel not found or not a voice channel:', channelId);
          this.database.removeChannel(channel);
          continue;
        }

        if (channel.members.size === 0) {
          console.warn('Channel is empty:', channelId);
          this.database.removeChannel(channel);
          channel.delete();
          continue;
        }

        let owner = channel.members.get(ownerId);
        if (!owner) {
          console.warn('Owner member not found in channel:', ownerId, 'for channel', channelId);
          owner = channel.members.random();
          this.database.setChannel(channel, owner);
        }

        const dynamicChannel = new DynamicChannel(channel, owner);
        this.channels.set(channelId, dynamicChannel);
        console.info('Loaded dynamic channel:', dynamicChannel.channel.name, 'for owner:', owner.displayName);
      }
    } catch (error) {
      console.error(error);
    }
  }

  private onInteractionCreate(interaction: Interaction) {
    if (interaction.isChatInputCommand()) return; // Handled elsewhere
    try {
      if (!interaction.channelId || !this.channels.has(interaction.channelId)) {
        console.warn('No dynamic channel found for interaction in channel', interaction.channelId);
        return;
      }

      const channel = this.channels.get(interaction.channelId);

      if (interaction.isButton()) {
        switch (interaction.customId) {
          case DynamicChannelInteraction.RenameButton:
            channel.handleRenameButton(interaction);
            break;
          case DynamicChannelInteraction.GuestInviteButton:
            channel.handleGuestInviteButton(interaction);
            break;
          default:
            console.warn('Unknown button interaction:', interaction.customId, 'in channel', interaction.channelId);
            break;
        }
      } else if (interaction.isModalSubmit()) {
        if (interaction.customId === DynamicChannelInteraction.RenameModal) {
          channel.handleRenameModal(interaction);
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  private async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    try {
      // No change in voice channel
      if (newState.channelId === oldState.channelId) {
        return;
      }

      // User left a dynamic channel
      if (oldState.member && oldState.channel?.id && this.channels.has(oldState.channel.id)) {
        console.info(oldState.member.displayName, 'left', oldState.channel?.name);

        const dynamicChannel = this.channels.get(oldState.channel.id)!;
        dynamicChannel.removeMember(oldState.member, this.database);
        console.assert(dynamicChannel.members.size === oldState.channel.members.size, `Member count mismatch in channel ${oldState.channel.name}. Expected: ${dynamicChannel.members.size}, Actual: ${oldState.channel.members.size}`);
        if (dynamicChannel.isEmpty()) {
          console.info('Deleting', dynamicChannel.channel.name);
          dynamicChannel.channel.delete();
          this.channels.delete(dynamicChannel.channel.id);
          this.database.removeChannel(dynamicChannel.channel);
        }
      }

      // User joined setup channel
      if (newState.member && newState.channel?.id === this.setup.id) {
        console.info(newState.member.displayName, 'joined setup channel');
        const customName = this.database.getCustomChannelName(newState.member.user);
        const newChannel = await DynamicChannel.create(newState.member, this.parent, this.setup.position + 1, customName);
        this.channels.set(newChannel.channel.id, newChannel);
        newState.member.voice.setChannel(newChannel.channel);
        this.database.setChannel(newChannel.channel, newState.member);
      }

      // User joined an existing dynamic channel
      if (newState.member && newState.channel?.id && this.channels.has(newState.channel.id)) {
        console.info(newState.member.displayName, 'joined', newState.channel?.name);

        const dynamicChannel = this.channels.get(newState.channel.id)!;
        dynamicChannel.addMember(newState.member);
        console.assert(dynamicChannel.members.size === newState.channel.members.size, `Member count mismatch in channel ${newState.channel.name}. Expected: ${dynamicChannel.members.size}, Actual: ${newState.channel.members.size}`);
      }
    } catch (error) {
      console.error(error);
    }
  }
}
