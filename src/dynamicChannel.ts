import {  ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CategoryChannel, ChannelType, GuildMember, Message, MessageFlags, ModalBuilder, ModalSubmitInteraction, TextDisplayBuilder, TextInputBuilder, TextInputStyle, VoiceChannel } from "discord.js";

export enum DynamicChannelInteraction {
  RenameButton = 'dynamicChannelRenameButton',
  RenameModal = 'dynamicChannelRenameModal',
}

enum DynamicChannelInput {
  NewChannelName = 'newChannelName',
}

export default class DynamicChannel {
  channel: VoiceChannel;
  owner: GuildMember;
  members: Set<GuildMember>;

  constructor(channel: VoiceChannel, owner: GuildMember) {
    this.channel = channel;
    this.owner = owner;
    this.members = new Set([owner]);
    this.sendCreationMessage();
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
    
    return new DynamicChannel(channel, owner);
  }

  addMember(member: GuildMember) {
    this.members.add(member);
    console.assert(this.members.size === this.channel.members.size, `Member count mismatch in channel ${this.channel.name}. Expected: ${this.members.size}, Actual: ${this.channel.members.size}`);
  }
  
  removeMember(member: GuildMember) {
    this.members.delete(member);
    if (this.owner.id === member.id && !this.isEmpty()) {
      // If the owner leaves and the channel is not empty, set oldest member as the new owner
      this.owner = this.members.values().next().value;
      const content = `Previous owner ${member} left. New owner is now ${this.owner}!`;
      this.channel.send({content, allowedMentions: { users: [] } });
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