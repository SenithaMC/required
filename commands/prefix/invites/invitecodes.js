const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
  name: 'invitecodes',
  description: 'Check the invite codes of a user',
  aliases: ['icodes'],
  usage: 'invitecodes [@user]',
  async execute(message, args) {
    const targetUser = message.mentions.users.first() || message.author;

    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ You need the `Manage Messages` permission to view invite codes.')
        ]
      });
    }
    
    try {
      const [invites] = await db.pool.execute(
        'SELECT * FROM invites WHERE guildId = ? AND memberId = ?',
        [message.guild.id, targetUser.id]
      );

      if (!invites.length) {
        return message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFFA500)
              .setDescription(`**${targetUser.tag}** has no invite codes.\nThey haven't created any invite links or their invites weren't tracked.`)
          ]
        });
      }

      invites.sort((a, b) => (b.uses || 0) - (a.uses || 0));

      let inviteCodesText = '';
      let totalUses = 0;

      for (const invite of invites) {
        const uses = invite.uses || 0;
        totalUses += uses;

        const invitedUsers = JSON.parse(invite.invitedUsers || '[]');
        const activeUsers = invitedUsers.filter(u => !u.left).length;
        const leftUsers = invitedUsers.filter(u => u.left).length;

        inviteCodesText += `**Code:** \`${invite.inviteCode}\`\n`;
        inviteCodesText += `**Uses:** ${uses} (${activeUsers} active, ${leftUsers} left)\n`;
        if (invite.createdAt) {
          inviteCodesText += `**Created:** <t:${Math.floor(new Date(invite.createdAt).getTime() / 1000)}:R>\n`;
        }
        inviteCodesText += '\n';
      }

      const embed = new EmbedBuilder()
        .setTitle(`Invite Codes for ${targetUser.tag}`)
        .setDescription(inviteCodesText)
        .setColor(0x69008C)
        .setFooter({ text: `Total codes: ${invites.length} • Total uses: ${totalUses}` })
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('Error fetching invite codes:', error);
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ There was an error fetching invite codes.')
        ]
      });
    }
  },
};
