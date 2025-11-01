const db = require('../../../utils/db');

module.exports = {
  name: 'transcript',
  description: 'Set transcript channel or generate transcript',
  async execute(message, args) {
    if (args[0] === 'set') {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.channel.send('❌ You need administrator permissions to set transcript channel.');
      }

      if (args.length < 2) {
        return message.channel.send('❌ Please provide a channel mention or ID.');
      }

      const channelId = args[1].replace(/[<#>]/g, '');
      const channel = message.guild.channels.cache.get(channelId);

      if (!channel) {
        return message.channel.send('❌ Channel not found.');
      }

      try {
        await db.executeWithRetry(
          'INSERT INTO transcript_channels (guild_id, channel_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE channel_id = ?',
          [message.guild.id, channel.id, channel.id]
        );

        message.channel.send(`✅ Transcript channel set to ${channel}`);
      } catch (error) {
        console.error('Transcript set error:', error);
        message.channel.send('❌ Error setting transcript channel.');
      }
    } else {
      // Generate transcript for current ticket
      const [ticket] = await db.executeWithRetry(
        'SELECT * FROM tickets WHERE channel_id = ?',
        [message.channel.id]
      );

      if (!ticket) {
        return message.channel.send('❌ This is not a ticket channel.');
      }

      // Simple transcript generation
      const messages = await message.channel.messages.fetch({ limit: 100 });
      const transcript = messages.reverse().map(msg => 
        `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content}`
      ).join('\n');

      // Save transcript
      await db.executeWithRetry(
        'UPDATE tickets SET transcript = ? WHERE channel_id = ?',
        [transcript, message.channel.id]
      );

      message.channel.send('✅ Transcript generated and saved.');
    }
  }
};