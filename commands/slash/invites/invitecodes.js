const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invitecodes')
    .setDescription("Check a user's invite codes")
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to check invite codes for')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;

    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ You need the `Manage Messages` permission to view invite codes.')
        ],
        ephemeral: true
      });
    }
    
    await interaction.deferReply();

    try {
      const [invites] = await db.pool.execute(
        'SELECT * FROM invites WHERE guildId = ? AND memberId = ?',
        [interaction.guild.id, targetUser.id]
      );

      if (!invites.length) {
        return interaction.editReply({
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

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error fetching invite codes:', error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ There was an error fetching invite codes.')
        ]
      });
    }
  },
};
