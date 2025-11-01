const { PermissionFlagsBits } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
  name: 'tsetup',
  description: 'Set up the ticket system',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.channel.send('❌ You need administrator permissions to set up tickets.');
    }

    try {
      // Create or update ticket panel configuration
      await db.executeWithRetry(
        'INSERT INTO ticket_panels (guild_id, category_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE category_id = ?',
        [message.guild.id, message.channel.parentId, message.channel.parentId]
      );

      message.channel.send('✅ Ticket system setup completed! Use `b!tsend #channel` to send the ticket panel.');
    } catch (error) {
      console.error('Ticket setup error:', error);
      message.channel.send('❌ Error setting up ticket system.');
    }
  }
};