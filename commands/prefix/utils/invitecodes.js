const { EmbedBuilder } = require('discord.js');
const Invite = require('../../../models/Invite');

module.exports = {
  name: 'invitecodes',
  description: 'Check the invite codes of a user',
  aliases: ['icodes'],
  usage: 'invitecodes [@user]',
  async execute(message, args) {
    const targetUser = message.mentions.users.first() || message.author;

    try {
      const invites = await Invite.find({
        guildId: message.guild.id,
        memberId: targetUser.id
      });

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

        const activeUsers = invite.invitedUsers.filter(u => !u.left && !u.isBot).length;
        const leftUsers = invite.invitedUsers.filter(u => u.left && !u.isBot).length;

        inviteCodesText += `**Code:** \`${invite.inviteCode}\`\n`;
        inviteCodesText += `**Uses:** ${uses} (${activeUsers} active, ${leftUsers} left)\n`;
        if (invite.createdAt) {
          inviteCodesText += `**Created:** <t:${Math.floor(invite.createdAt.getTime() / 1000)}:R>\n`;
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
            .setDescription('<:error:1416752161638973490> There was an error fetching invite codes.')
        ]
      });
    }
  },
};
