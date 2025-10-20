const { PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'ban',
  description: 'Ban a user from the server',
  aliases: [],

  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:mc_white_cross:1411727598840451174> You do not have permission to ban members.')
        ]
      });
    }

    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    if (!target) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:mc_white_cross:1411727598840451174> Please mention a valid user or provide their ID.')
        ]
      });
    }

    if (target.id === message.author.id) {
      return message.channel.send("<:mc_white_cross:1411727598840451174> You can’t ban yourself.");
    }
    if (target.roles.highest.position >= message.member.roles.highest.position) {
      return message.channel.send("<:mc_white_cross:1411727598840451174> You can’t ban someone with equal or higher role.");
    }

    let reason = args.slice(1).join(" ") || "No reason provided";

    let dmSuccess = true;
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('You were banned')
        .addFields(
          { name: 'Server', value: message.guild.name, inline: true },
          { name: 'Reason', value: reason, inline: true },
          { name: 'Banned by', value: message.author.tag, inline: true },
          { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        );
      await target.send({ embeds: [dmEmbed] });
    } catch {
      dmSuccess = false;
    }

    try {
      await target.ban({ reason });
      const responseEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setDescription(`🔨 Banned **${target.user.tag}** for: ${reason}`);

      if (!dmSuccess) {
        responseEmbed.setFooter({ text: 'Note: Could not DM the user (DMs might be disabled).' });
      }

      await message.channel.send({ embeds: [responseEmbed] });
    } catch (err) {
      console.error(err);
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:mc_white_cross:1411727598840451174> Failed to ban user. Do I have permission?')
        ]
      });
    }
  }
};
