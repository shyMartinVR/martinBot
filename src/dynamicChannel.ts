import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CategoryChannel, ChannelType, Collection, GuildMember, MessageFlags, ModalBuilder, ModalSubmitInteraction, Snowflake, TextDisplayBuilder, TextInputBuilder, TextInputStyle, VoiceBasedChannel } from "discord.js";
import ChannelDatabase from "./database";


export enum DynamicChannelInteraction {
  RenameButton = 'dynamicChannelRenameButton',
  RenameModal = 'dynamicChannelRenameModal',
  GuestInviteButton = 'dynamicChannelGuestInviteButton',
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

    const guestInviteButton = new ButtonBuilder()
      .setCustomId(DynamicChannelInteraction.GuestInviteButton)
      .setEmoji('📧')
      .setLabel('Create Guest Invite')
      .setStyle(ButtonStyle.Secondary);

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(renameButton, guestInviteButton);

    const text = new TextDisplayBuilder().setContent(content);

    this.channel.send({flags: MessageFlags.IsComponentsV2, components: [text, actionRow], allowedMentions: {users: [] } });
  }

  static async create(owner: GuildMember, parent: CategoryChannel, position: number, customName?: string | null) {
    const channel = await parent.guild.channels.create({
      name: customName ?? `dynamic-channel-${owner.displayName}`,
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
    console.info('Rename button clicked by', interaction.user.tag, 'in channel', interaction.channel.name);
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
      .setValue(interaction.channel.name)
      .setMinLength(1)
      .setMaxLength(100)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));

    interaction.showModal(modal);
  }

  async handleRenameModal(interaction: ModalSubmitInteraction) {
    const newName = interaction.fields.getTextInputValue(DynamicChannelInput.NewChannelName).trim();
    console.info('Renaming channel', interaction.channel.name, 'to', newName, 'by', interaction.user.tag);
    await this.channel.setName(newName, `Renamed by ${ interaction.user.tag }`);
    interaction.reply(`Channel renamed to ${newName}.`);
  }

  async handleGuestInviteButton(interaction: ButtonInteraction) {
    console.info('Guest invite button clicked by', interaction.user.tag, 'in channel', interaction.channel.name);
    const invite = await this.channel.createInvite({ temporary: true, maxAge: 0, reason: `Guest invite created by ${interaction.user.tag}` });
    interaction.reply({ content: `${interaction.member} created a guest invite: ${invite}`, allowedMentions: { users: [] } });
  }
  
  isEmpty() {
    return this.members.size === 0;
  }
}