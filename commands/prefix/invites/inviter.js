const { EmbedBuilder } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
  name: 'inviter',
  description: 'Check who invited a user',
  usage: 'inviter [@user]',
  async execute(message, args) {
    const targetUser = message.mentions.users.first() || message.author;

    try {
      const [invites] = await db.pool.execute(
        'SELECT * FROM invites WHERE guildId = ?',
        [message.guild.id]
      );

      let foundInvite = null;
      let userInviteData = null;

      for (const invite of invites) {
        const invitedUsers = JSON.parse(invite.invitedUsers || '[]');
        const userData = invitedUsers.find(u => u.userId === targetUser.id);
        if (userData) {
          foundInvite = invite;
          userInviteData = userData;
          break;
        }
      }

      if (!foundInvite) {
        return message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFFA500)
              .setTitle('No Invite Found')
              .setDescription(
                `Could not find who invited **${targetUser.tag}**.\n` +
                `They may have joined through another method (vanity, external link, etc.) or their invite wasn't tracked.`
              )
          ]
        });
      }

      const inviter = await message.client.users.fetch(foundInvite.memberId).catch(() => null);

      const joinDate = userInviteData?.joinedAt
        ? `<t:${Math.floor(new Date(userInviteData.joinedAt).getTime() / 1000)}:F>`
        : 'Unknown';

      const [inviterStatsRows] = await db.pool.execute(
        'SELECT * FROM member_invites WHERE guildId = ? AND memberId = ?',
        [message.guild.id, foundInvite.memberId]
      );

      const inviterStats = inviterStatsRows[0];
      let totalInvites = 0, valid = 0, left = 0, fake = 0;
      
      if (inviterStats) {
        valid = inviterStats.validInvites || 0;
        left = inviterStats.leaveInvites || 0;
        fake = inviterStats.fakeInvites || 0;
        totalInvites = valid + left + fake;
      }

      const embed = new EmbedBuilder()
        .setTitle('👤 Inviter Information')
        .setColor(0x69008C)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setDescription(`**${targetUser.tag}** was invited by **${inviter ? inviter.tag : 'Unknown User'}**`)
        .addFields(
          { name: '📨 Invite Code', value: `\`${foundInvite.inviteCode}\``, inline: true },
          { name: '📅 Join Date', value: joinDate, inline: true },
          { 
            name: '📊 Inviter\'s Stats', 
            value: inviterStats
              ? `**${totalInvites}** total invites\n(${valid} regular, ${left} left, ${fake} fake)`
              : 'No invite data',
            inline: false 
          }
        )
        .setFooter({ text: `User ID: ${targetUser.id}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('Error fetching inviter data:', error);
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ There was an error fetching inviter data.')
        ]
      });
    }
  },
};