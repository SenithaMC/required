const { REST, Routes } = require('discord.js');
const config = require('../config');

if (!config.token || !config.client_id) {
  console.error('❌ Missing required .env variables. Ensure these exist:');
  console.error('TOKEN=your_bot_token');
  console.error('CLIENT_ID=your_bot_client_id');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    console.log('🗑️ Clearing all application commands...');

    await rest.put(
      Routes.applicationCommands(config.client_id),
      { body: [] }
    );
    console.log('✅ Successfully cleared ALL global commands');
  } catch (error) {
    console.error('❌ Failed to clear commands:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Verify CLIENT_ID matches your bot\'s application ID');
    console.error('2. Check TOKEN is valid and not expired');
    console.error('3. Ensure bot has proper permissions (applications.commands scope)');
    console.error('Full error:', error);
  }
})();
