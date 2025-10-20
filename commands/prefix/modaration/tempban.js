const { PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'tempban',
  aliases: ['tban'],
  description: 'Temporarily ban a user from the server.',
  usage: '<user> <duration> [reason] [-dm]',
  execute: async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.channel.send('❌ You do not have permission to ban members.');
    }

    const user = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    if (!user) {
      return message.channel.send('❌ Please specify a valid user to ban.');
    }

    const duration = args[1];
    if (!duration) return message.channel.send('❌ Please provide a duration (e.g., 1d, 2h, 30m).');

    const sendDM = args.includes('-dm');
    const reason = args.slice(2).join(' ').replace('-dm', '').trim() || 'No reason provided';

    const timeRegex = /^(\d+)([dDhHmM])$/;
    const match = duration.match(timeRegex);
    if (!match) {
      return message.channel.send('❌ Invalid duration format. Use format like: 1d (day), 2h (hour), 30m (minute)');
    }

    const amount = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    let milliseconds;
    switch(unit) {
      case 'd': milliseconds = amount * 24 * 60 * 60 * 1000; break;
      case 'h': milliseconds = amount * 60 * 60 * 1000; break;
      case 'm': milliseconds = amount * 60 * 1000; break;
      default: return message.channel.send('❌ Invalid time unit. Use d, h, or m.');
    }

    const unbanTime = new Date(Date.now() + milliseconds);
    const formattedUnbanTime = `<t:${Math.floor(unbanTime.getTime() / 1000)}:F>`;

    let dmSuccess = true;
    if (sendDM) {
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('You were temporarily banned')
          .addFields(
            { name: 'Server', value: message.guild.name, inline: true },
            { name: 'Reason', value: reason, inline: true },
            { name: 'Duration', value: duration, inline: true },
            { name: 'Will be unbanned', value: formattedUnbanTime, inline: true },
            { name: 'Banned by', value: message.author.tag, inline: true },
            { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
          );
        await user.send({ embeds: [dmEmbed] });
      } catch (dmError) {
        dmSuccess = false;
        console.log('Could not send DM to user:', dmError.message);
      }
    }

    try {
      await user.ban({ reason: `${reason} | Duration: ${duration} | Unban at: ${formattedUnbanTime}` });

      const responseEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setDescription(`🔨 Temporarily banned **${user.user.tag}** for: ${reason}`)
        .addFields(
          { name: 'Duration', value: duration, inline: true },
          { name: 'Will be unbanned', value: formattedUnbanTime, inline: true }
        );

      if (sendDM && !dmSuccess) {
        responseEmbed.setFooter({ text: 'Note: Could not send DM to user (DMs might be disabled)' });
      }

      message.channel.send({ embeds: [responseEmbed] });

      setTimeout(async () => {
        try {
          await message.guild.members.unban(user.id, 'Temporary ban expired');
          console.log(`Automatically unbanned ${user.user.tag} after temporary ban`);
        } catch (unbanError) {
          console.error(`Failed to unban ${user.user.tag}:`, unbanError.message);
        }
      }, milliseconds);

    } catch (err) {
      console.error(err);
      message.channel.send('❌ Failed to ban user. Do I have permission?');
    }
  }
};
