import {  ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CategoryChannel, ChannelType, Collection, GuildMember, MessageFlags, ModalBuilder, ModalSubmitInteraction, Snowflake, TextDisplayBuilder, TextInputBuilder, TextInputStyle, VoiceBasedChannel } from "discord.js";
import ChannelDatabase from "./database";

export enum DynamicChannelInteraction {
  RenameButton = 'dynamicChannelRenameButton',
  RenameModal = 'dynamicChannelRenameModal',
}

enum DynamicChannelInput {
  NewChannelName = 'newChannelName',
}

class VoiceMember {
  public readonly joinTime: Date;
  public readonly member: GuildMember;
  public constructor(member: GuildMember, joinTime?: Date) {
    this.member = member;
    this.joinTime = joinTime ?? new Date();
  }

  get id(): Snowflake {
    return this.member.id;
  }

  get displayName(): string {
    return this.member.displayName;
  }

  toString(): string {
    return this.member.toString();
  }
}

export default class DynamicChannel {
  channel: VoiceBasedChannel;
  owner: VoiceMember;
  members: Collection<Snowflake, VoiceMember>;

  constructor(channel: VoiceBasedChannel, owner: GuildMember) {
    this.channel = channel;
    this.owner = new VoiceMember(owner);
    this.members = new Collection(channel.members.map(member => [member.id, new VoiceMember(member)]));
  }

  sendCreationMessage() {
    console.info('Created', this.channel.name);
    const content = `Dynamic channel created! Owner is ${this.owner}.`;

    const renameButton = new ButtonBuilder()
      .setCustomId(DynamicChannelInteraction.RenameButton)
      .setEmoji('✏️')
      .setLabel('Rename Channel')
      .setStyle(ButtonStyle.Primary);

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(renameButton);

    const text = new TextDisplayBuilder().setContent(content);

    this.channel.send({flags: MessageFlags.IsComponentsV2, components: [text, actionRow], allowedMentions: {users: [] } });
  }

  static async create(owner: GuildMember, parent: CategoryChannel, position: number) {
    const channel = await parent.guild.channels.create({
      name: `dynamic-channel-${owner.displayName}`,
      type: ChannelType.GuildVoice,
      parent,
      position
    });

    const newChannel = new DynamicChannel(channel, owner);
    newChannel.sendCreationMessage();
    return newChannel;
  }

  addMember(member: GuildMember) {
    this.members.set(member.id, new VoiceMember(member));
    console.assert(this.members.size === this.channel.members.size, `Member count mismatch in channel ${this.channel.name}. Expected: ${this.members.size}, Actual: ${this.channel.members.size}`);
  }
  
  removeMember(member: GuildMember, database: ChannelDatabase) {
    this.members.delete(member.id);
    if (this.owner.id === member.id && !this.isEmpty()) {
      this.members.sort((a, b) => a.joinTime.getTime() - b.joinTime.getTime());
      // If the owner leaves and the channel is not empty, set oldest member as the new owner
      this.owner = this.members.first();
      const content = `Previous owner ${member} left. New owner is now ${this.owner}!`;
      this.channel.send({content, allowedMentions: { users: [] } });
      database.setChannel(this.channel, this.owner.member);
    }
  }

  handleRenameButton(interaction: ButtonInteraction) {
    if (interaction.user.id !== this.owner.id) {
      interaction.reply({ content: `Only the owner ${this.owner} can rename the channel.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(DynamicChannelInteraction.RenameModal)
      .setTitle('Rename Dynamic Channel');

    const input = new TextInputBuilder()
      .setCustomId(DynamicChannelInput.NewChannelName)
      .setLabel('New Channel Name')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));

    interaction.showModal(modal);
  }

  async handleRenameModal(interaction: ModalSubmitInteraction) {
    const newName = interaction.fields.getTextInputValue(DynamicChannelInput.NewChannelName).trim();
    if (newName.length > 100) {
      interaction.reply({ content: 'Channel name cannot exceed 100 characters.', flags: MessageFlags.Ephemeral });
      return;
    }

    await this.channel.setName(newName);
    interaction.reply(`Channel renamed to ${newName}.`);
  }
  
  isEmpty() {
    return this.members.size === 0;
  }
}