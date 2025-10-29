const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../utils/db');
const config = require('../../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription("Check your or another user's invite statistics")
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to check invites for')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;

    await interaction.deferReply();

    try {
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      const displayName = member ? member.displayName : targetUser.username;

      const [memberInvitesRows] = await db.pool.execute(
        'SELECT * FROM member_invites WHERE guildId = ? AND memberId = ?',
        [interaction.guild.id, targetUser.id]
      );

      const memberInvites = memberInvitesRows[0];
      const embed = new EmbedBuilder()
        .setTitle(`${displayName}'s Invites`)
        .setColor(0x69008C);

      if (!memberInvites) {
        embed.setDescription(`**${displayName}** currently has **0 invites**. (0 regular, 0 left, 0 fake)`);
      } else {
        embed.setDescription(
          `**${displayName}** currently has **${memberInvites.totalInvites} invites**. ` +
          `(${memberInvites.validInvites} regular, ${memberInvites.leaveInvites} left, ${memberInvites.fakeInvites} fake)`
        );
        embed.setFooter({ text: `${config.bot_name} • Invites`});
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching invite data:', error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ There was an error fetching invite data.')
        ]
      });
    }
  },
};