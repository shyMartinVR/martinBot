import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { Environment } from "../environment";
import MartinDatabase from "../database";
import logger from "../logger";

const commandName = 'custom_dynamic_channel_name';
const nameOptionName = 'custom_name';
const targetUserOptionName = 'target';

export const customDynamicChannelNameCommand = new SlashCommandBuilder()
  .setName(commandName)
  .setDescription('Set a default name for dynamic channels')
  .addStringOption(option =>
    option.setName(nameOptionName)
      .setDescription('The new default channel name (leave empty to reset)')
      .setRequired(false)
      .setMaxLength(50)
  ).addUserOption(option =>
    option.setName(targetUserOptionName)
      .setDescription('The user to set the default name for (leave empty for yourself)')
      .setRequired(false)
  ).toJSON();

export const customNamehandler = (database: MartinDatabase) => {
  return async function (interaction: ChatInputCommandInteraction) {
    if (interaction.commandName !== commandName) return;
    try {
      const customName = interaction.options.getString(nameOptionName, false)?.trim();
      const targetUser = interaction.options.getUser(targetUserOptionName, false) ?? interaction.user;

      // Permission check: only owner can set names for other users
      if (targetUser.id !== interaction.user.id) {
        if (interaction.user.id !== Environment.ownerId) {
          logger.warn('User', interaction.user.tag, 'tried to set default name for', targetUser.tag);
          interaction.reply({ content: 'You do not have permission to set default names for other users.', flags: MessageFlags.Ephemeral });
          return;
        }
      }

      if (customName) {
        database.setCustomChannelName(targetUser, customName);
        if (targetUser.id !== interaction.user.id) {
          logger.info(interaction.user.tag, 'set default channel name for', targetUser.tag, 'to', customName);
        } else {
          logger.info(interaction.user.tag, 'set their default channel name to', customName);
        }
        interaction.reply({ content: `Set default channel name to "${customName}".`, flags: MessageFlags.Ephemeral });
      } else {
        if (targetUser.id !== interaction.user.id) {
          logger.info(interaction.user.tag, 'cleared default channel name for', targetUser.tag);
        } else {
          logger.info(interaction.user.tag, 'cleared their default channel name');
        }
        database.removeCustomChannelName(targetUser);
        interaction.reply({ content: 'Cleared default channel name.', flags: MessageFlags.Ephemeral });
      }
    } catch (error) {
      logger.error(error);
    }
  }
};