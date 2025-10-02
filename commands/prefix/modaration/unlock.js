const { PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'unlock',
  description: 'Unlock a channel to allow messages.',
  usage: '[channel] [reason]',
  execute: async (message, args) => {
    const member = message.member;

    if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.channel.send('<:error:1416752161638973490> Missing permission to manage channels.');
    }

    let channel = message.mentions.channels.first();
    if (!channel && args[0]) {
      channel = message.guild.channels.cache.get(args[0]);
    }
    if (!channel) channel = message.channel;

    const reason = args.slice(1).join(' ') || 'None';

    const everyone = message.guild.roles.everyone;
    const currentPerms = channel.permissionOverwrites.cache.get(everyone.id);

    if (!currentPerms || !currentPerms.deny.has(PermissionsBitField.Flags.SendMessages)) {
      return message.channel.send('🔓 Channel is already unlocked.');
    }

    await channel.permissionOverwrites.edit(everyone, { SendMessages: null });

    const embed = new EmbedBuilder()
      .setTitle('🔓 Unlocked')
      .addFields(
        { name: 'Unlocked by', value: `${member}`, inline: true },
        { name: 'Reason', value: reason, inline: true }
      )
      .setColor('Green')
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    message.channel.send(`🔓 Unlocked ${channel}`);
  }
};
