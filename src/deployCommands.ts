import { REST, Routes } from 'discord.js';
import {customDynamicChannelNameCommand } from './dynamicChannels/customName'
import { Environment } from './environment';
import logger from './logger';
const commands = [customDynamicChannelNameCommand];

const rest = new REST().setToken(Environment.discordToken);

(async () => {
  try {
    logger.info(`Started refreshing ${commands.length} application commands.`);
    const data: any = await rest.put(Routes.applicationGuildCommands(Environment.applicationId, Environment.guildId), { body: commands });

    logger.info(`Successfully reloaded ${data.length} application commands.`);
  } catch (error) {
    logger.error(error);
  }
})();