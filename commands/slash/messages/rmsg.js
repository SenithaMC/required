const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rmsg')
        .setDescription('Reset message counters for users, roles, or entire server')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to reset message count for')
                .setRequired(false)
        )
        .addRoleOption(option =>
            option
                .setName('role')
                .setDescription('The role to reset message counts for')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('scope')
                .setDescription('What to reset')
                .setRequired(false)
                .addChoices(
                    { name: 'All users in server', value: 'all' }
                )
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ You need the `Manage Messages` permission to reset message counters.')
                ],
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser('user');
            const targetRole = interaction.options.getRole('role');
            const scope = interaction.options.getString('scope');
            
            let resetCount = 0;
            let description = '';

            if (targetUser) {
                const [result] = await db.pool.execute(
                    'DELETE FROM user_messages WHERE guild_id = ? AND user_id = ?',
                    [interaction.guild.id, targetUser.id]
                );
                resetCount = result.affectedRows;
                
                description = `✅ Reset message count for **${targetUser.tag}**`;
                
            } else if (targetRole) {
                const members = targetRole.members;
                
                for (const [memberId, member] of members) {
                    const [result] = await db.pool.execute(
                        'DELETE FROM user_messages WHERE guild_id = ? AND user_id = ?',
                        [interaction.guild.id, memberId]
                    );
                    resetCount += result.affectedRows;
                }
                
                description = `✅ Reset message counts for **${members.size}** members with role **${targetRole.name}**`;
                
            } else if (scope === 'all') {
                const [result] = await db.pool.execute(
                    'DELETE FROM user_messages WHERE guild_id = ?',
                    [interaction.guild.id]
                );
                resetCount = result.affectedRows;
                description = `✅ Reset all message counters for this server (**${resetCount}** users)`;
            } else {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription('❌ Please specify a user, role, or use "all" to reset all message counters.')
                    ]
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setDescription(description)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in rmsg command:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ Failed to reset message counters. Please try again.')
                ]
            });
        }
    }
};
