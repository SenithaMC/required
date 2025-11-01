const db = require('../../utils/db');

module.exports = {
  name: 'pset',
  description: 'Set server prefix',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.channel.send('❌ You need administrator permissions to change the prefix.');
    }

    if (args.length === 0) {
      return message.channel.send('❌ Please provide a new prefix.');
    }

    const newPrefix = args[0];
    if (newPrefix.length > 5) {
      return message.channel.send('❌ Prefix must be 5 characters or less.');
    }

    try {
      await db.setGuildPrefix(message.guild.id, newPrefix);
      // Update cache
      if (message.client.prefixCache) {
        message.client.prefixCache.set(message.guild.id, newPrefix);
      }
      
      message.channel.send(`✅ Prefix updated to: \`${newPrefix}\``);
    } catch (error) {
      console.error('Prefix set error:', error);
      message.channel.send('❌ Error updating prefix.');
    }
  }
};