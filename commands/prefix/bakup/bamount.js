const { PermissionsBitField } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
  name: 'bamount',
  description: 'Set how many backups to keep',
  usage: 'bamount <number>',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.channel.send('❌ You need administrator permissions to use this command.');
    }

    if (!args[0]) {
      return message.channel.send('❌ Usage: `bamount <number>`');
    }

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.channel.send('❌ Please provide a valid number (1-100).');
    }

    const guildId = message.guild.id;

    try {
      await db.executeWithRetry(
        `INSERT INTO backup_settings (guild_id, keep_amount) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE keep_amount = ?`,
        [guildId, amount, amount]
      );

      message.channel.send(`✅ Will keep **${amount}** most recent backups.`);

      await cleanupOldBackups(guildId);

    } catch (error) {
      console.error('Backup amount setting error:', error);
      message.channel.send('❌ Failed to set backup amount. Please try again later.');
    }
  }
};

async function cleanupOldBackups(guildId) {
  try {
    await db.executeWithRetry(
      `DELETE FROM backups 
       WHERE guild_id = ? 
       AND id NOT IN (
         SELECT id FROM (
           SELECT id FROM backups 
           WHERE guild_id = ? 
           ORDER BY created_at DESC 
           LIMIT ?
         ) AS recent_backups
       )`,
      [guildId, guildId, amount]
    );
  } catch (error) {
    console.error('Error cleaning up old backups:', error);
  }
}