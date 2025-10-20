const { EmbedBuilder } = require('discord.js');
const db = require('../../../utils/db');
const config = require('../../../config');

module.exports = {
  name: 'invites',
  description: 'Check your or another user\'s invite statistics',
  usage: 'invites [@user]',
  async execute(message, args) {
    let targetUser = message.author;
    if (message.mentions.users.size > 0) {
      targetUser = message.mentions.users.first();
    }

    try {
      const member = await message.guild.members.fetch(targetUser.id).catch(() => null);
      const displayName = member ? member.displayName : targetUser.username;

      const [memberInvitesRows] = await db.pool.execute(
        'SELECT * FROM member_invites WHERE guildId = ? AND memberId = ?',
        [message.guild.id, targetUser.id]
      );

      const memberInvites = memberInvitesRows[0];
      const embed = new EmbedBuilder()
        .setTitle(displayName)
        .setColor(0x69008C);

      if (!memberInvites) {
        embed.setDescription(`You currently have **0 invites**. (0 regular, 0 left, 0 fake)`);
      } else {
        embed.setDescription(
          `You currently have **${memberInvites.totalInvites} invites**. ` +
          `(${memberInvites.validInvites} regular, ${memberInvites.leaveInvites} left, ${memberInvites.fakeInvites} fake)`
        );
        embed.setFooter({ text: `${config.bot_name} • Invites`});
      }

      await message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching invite data:', error);
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:mc_white_cross:1411727598840451174> There was an error fetching invite data.')
        ]
      });
    }
  },
};