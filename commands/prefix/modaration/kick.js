const { PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'kick',
  description: 'Kick a user from the server',
  aliases: [],

  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ You do not have permission to kick members.')
        ]
      });
    }

    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    if (!target) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ Please mention a valid user or provide their ID.')
        ]
      });
    }

    if (target.id === message.author.id) {
      return message.channel.send("❌ You can’t kick yourself.");
    }
    if (target.roles.highest.position >= message.member.roles.highest.position) {
      return message.channel.send("❌ You can’t kick someone with equal or higher role.");
    }

    let reason = args.slice(1).join(" ") || "No reason provided";

    let dmSuccess = true;
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('You were kicked')
        .addFields(
          { name: 'Server', value: message.guild.name, inline: true },
          { name: 'Reason', value: reason, inline: true },
          { name: 'Kicked by', value: message.author.tag, inline: true },
          { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        );
      await target.send({ embeds: [dmEmbed] });
    } catch {
      dmSuccess = false;
    }

    try {
      await target.kick(reason);
      const responseEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setDescription(`✅ Kicked **${target.user.tag}** for: ${reason}`);

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
            .setDescription('❌ Failed to kick user. Do I have permission?')
        ]
      });
    }
  }
};
