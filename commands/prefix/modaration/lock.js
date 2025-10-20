const { PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'lock',
  description: 'Lock a channel to prevent messages.',
  aliases: [],

  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:mc_white_cross:1411727598840451174> You do not have permission to manage channels.')
        ]
      });
    }

    const channel =
      message.mentions.channels.first() ||
      message.guild.channels.cache.get(args[0]) ||
      message.channel;

    const reason = args.slice(1).join(' ') || 'None';

    const everyone = message.guild.roles.everyone;
    const currentPerms = channel.permissionOverwrites.cache.get(everyone.id);

    if (currentPerms?.deny.has(PermissionsBitField.Flags.SendMessages)) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xF2FF00)
            .setDescription(`🔒 ${channel} is already locked.`)
        ]
      });
    }

    try {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: false });

      const embed = new EmbedBuilder()
        .setTitle('🔒 Channel Locked')
        .addFields(
          { name: 'Locked by', value: `${message.member}`, inline: true },
          { name: 'Reason', value: reason, inline: true }
        )
        .setColor(0xFF0000)
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription(`🔒 Locked ${channel}`)
        ]
      });
    } catch (err) {
      console.error(err);
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:mc_white_cross:1411727598840451174> Failed to lock the channel. Do I have permission?')
        ]
      });
    }
  }
};
