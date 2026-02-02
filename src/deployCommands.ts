import { REST, Routes } from 'discord.js';
import {customDynamicChannelNameCommand } from './dynamicChannels/customName'
import { Environment } from './environment';
const commands = [customDynamicChannelNameCommand];

const rest = new REST().setToken(Environment.discordToken);

(async () => {
	try {
		console.info(`Started refreshing ${commands.length} application commands.`);
		const data: any = await rest.put(Routes.applicationGuildCommands(Environment.applicationId, Environment.guildId), { body: commands });

		console.info(`Successfully reloaded ${data.length} application commands.`);
	} catch (error) {
		console.error(error);
	}
})();