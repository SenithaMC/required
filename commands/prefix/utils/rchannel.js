const db = require('../../utils/db');

module.exports = {
  name: 'rchannel',
  description: 'Set review channel',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.channel.send('❌ You need administrator permissions to set review channel.');
    }

    if (args.length === 0) {
      return message.channel.send('❌ Please provide a channel mention or ID.');
    }

    const channelId = args[0].replace(/[<#>]/g, '');
    const channel = message.guild.channels.cache.get(channelId);

    if (!channel) {
      return message.channel.send('❌ Channel not found.');
    }

    try {
      await db.executeWithRetry(
        'INSERT INTO review_channels (guild_id, channel_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE channel_id = ?',
        [message.guild.id, channel.id, channel.id]
      );

      message.channel.send(`✅ Review channel set to ${channel}`);
    } catch (error) {
      console.error('Review channel error:', error);
      message.channel.send('❌ Error setting review channel.');
    }
  }
};