const { PermissionsBitField } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
  name: 'binterval',
  description: 'Set the automatic backup interval',
  usage: 'binterval set <time-in-hours>',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.channel.send('❌ You need administrator permissions to use this command.');
    }

    if (args[0]?.toLowerCase() !== 'set' || !args[1]) {
      return message.channel.send('❌ Usage: `binterval set <time-in-hours>`');
    }

    const hours = parseInt(args[1]);
    if (isNaN(hours) || hours < 1 || hours > 8760) {
      return message.channel.send('❌ Please provide a valid number of hours (1-8760).');
    }

    const guildId = message.guild.id;

    try {
      await db.executeWithRetry(
        `INSERT INTO backup_settings (guild_id, interval_hours) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE interval_hours = ?`,
        [guildId, hours, hours]
      );

      message.channel.send(`✅ Automatic backup interval set to **${hours} hours**.`);

    } catch (error) {
      console.error('Backup interval setting error:', error);
      message.channel.send('❌ Failed to set backup interval. Please try again later.');
    }
  }
};