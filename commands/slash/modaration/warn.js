const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user and log the case')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to warn')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for the warning')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.KickMembers)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ You need the `Moderate Members` permission to warn users.')
                ],
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        await interaction.deferReply();

        try {
            const [lastCaseRows] = await db.pool.execute(
                'SELECT caseId FROM cases WHERE guildId = ? ORDER BY caseId DESC LIMIT 1',
                [interaction.guild.id]
            );
            const caseId = lastCaseRows.length > 0 ? lastCaseRows[0].caseId + 1 : 1;

            await db.pool.execute(
                'INSERT INTO cases (caseId, guildId, userId, moderatorId, type, reason) VALUES (?, ?, ?, ?, ?, ?)',
                [caseId, interaction.guild.id, targetUser.id, interaction.user.id, 'WARN', reason]
            );

            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('⚠️ You have been warned')
                    .setDescription(`You received a warning in **${interaction.guild.name}**`)
                    .addFields(
                        { name: 'Reason', value: reason },
                        { name: 'Moderator', value: interaction.user.tag },
                        { name: 'Case ID', value: `#${caseId}` }
                    )
                    .setColor(0xFFA500)
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log(`Could not send DM to ${targetUser.tag}:`, dmError.message);
            }

            const [cases] = await db.pool.execute(
                'SELECT * FROM cases WHERE guildId = ? AND userId = ? ORDER BY caseId DESC LIMIT 10',
                [interaction.guild.id, targetUser.id]
            );

            const now = Date.now();
            const last24hCount = cases.filter(c => now - new Date(c.createdAt).getTime() < 24 * 60 * 60 * 1000).length;
            const last7dCount = cases.filter(c => now - new Date(c.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000).length;
            const totalCount = cases.length;

            const casesContent = cases.map(c => {
                const date = `<t:${Math.floor(new Date(c.createdAt).getTime() / 1000)}:F>`;
                return `• ${date} \`${c.type}\` #${c.caseId} — ${c.reason}`;
            }).join('\n') || 'No previous cases.';

            const embed = new EmbedBuilder()
                .setTitle('✅ User Warned')
                .setDescription(casesContent)
                .setColor(0x00FF00)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `Query: Targeting ${targetUser.tag}` })
                .addFields(
                    { name: 'Last 24 hours', value: `${last24hCount} infraction${last24hCount !== 1 ? 's' : ''}`, inline: true },
                    { name: 'Last 7 days', value: `${last7dCount} infraction${last7dCount !== 1 ? 's' : ''}`, inline: true },
                    { name: 'Total', value: `${totalCount} infraction${totalCount !== 1 ? 's' : ''}`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error warning user:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ There was an error warning the user.')
                ]
            });
        }
    }
};