const fs = require('fs');
const path = require('path');
const config = require('../config');
const { REST, Routes } = require('discord.js');

const getCommandFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory()
      ? getCommandFiles(fullPath)
      : entry.name.endsWith('.js') ? [fullPath] : [];
  });
};

(async () => {
  try {
    console.log('🚀 Starting slash command deployment...');

    const allCommandFiles = getCommandFiles(path.join(__dirname, '../commands/slash'));
    const commands = [];
    const commandNames = new Set();

    for (const file of allCommandFiles) {
      try {
        const command = require(file);

        if (!command.name || !command.description) {
          console.warn(`⚠️ Skipping ${file} → missing "name" or "description"`);
          continue;
        }

        if (commandNames.has(command.name)) {
          console.warn(`⚠️ Duplicate command "${command.name}" found in ${file}`);
          continue;
        }

        commandNames.add(command.name);

        const commandData = {
          name: String(command.name).toLowerCase(), // must be lowercase
          description: String(command.description),
          options: Array.isArray(command.options) ? command.options : [],
        };

        commands.push(commandData);
      } catch (error) {
        console.error(`❌ Error loading command ${file}:`, error);
      }
    }

    const rest = new REST({ version: '10' }).setToken(config.token);

    console.log(`🔄 Deploying ${commands.length} slash commands globally...`);

    await rest.put(
      Routes.applicationCommands(config.client_id),
      { body: commands }
    );

    console.log('✅ Slash commands deployed globally!');
  } catch (error) {
    console.error('❌ Error deploying slash commands:', error);
  }
})();
