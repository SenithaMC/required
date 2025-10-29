const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionsBitField } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cremove')
        .setDescription('Remove cases for a user')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to remove cases for')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ You need the `Manage Messages` permission to remove cases.')
                ],
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user');

        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ That user is not in this server.')
                ],
                ephemeral: true
            });
        }

        await interaction.deferReply();

        const [cases] = await db.pool.execute(
            'SELECT * FROM cases WHERE guildId = ? AND userId = ? ORDER BY createdAt ASC',
            [interaction.guild.id, targetUser.id]
        );

        if (cases.length === 0) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFFA500)
                        .setDescription(`No cases found for ${targetUser.tag}.`)
                ]
            });
        }

        const caseOptions = cases.map((caseData, index) => {
            const caseDate = new Date(caseData.createdAt).toLocaleDateString('en-GB', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
            const caseTime = new Date(caseData.createdAt).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const truncatedReason = caseData.reason && caseData.reason.length > 50 
                ? caseData.reason.substring(0, 47) + '...' 
                : caseData.reason || 'No reason provided';
            
            const caseType = caseData.type || 'Unknown';
            
            return {
                label: `#${index + 1} ${caseDate} at ${caseTime} (${caseType})`,
                description: truncatedReason,
                value: `case_${caseData.id}`
            };
        });

        caseOptions.unshift({
            label: '🗑️ REMOVE ALL CASES',
            description: 'Remove all cases for this user',
            value: 'remove_all_cases'
        });

        const customId = `cases_remove_${targetUser.id}_${Date.now()}`;

        const dropdownRow = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(customId)
                    .setPlaceholder('Select a case to remove or remove all...')
                    .addOptions(caseOptions)
            );

        const overviewEmbed = new EmbedBuilder()
            .setTitle(`🗑️ Remove Cases for ${targetUser.tag}`)
            .setDescription(`Found **${cases.length}** cases for this user. Use the dropdown below to remove individual cases or remove all cases.`)
            .addFields(
                { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                { name: 'Total Cases', value: cases.length.toString(), inline: true },
                { name: 'First Case', value: `<t:${Math.floor(new Date(cases[0].createdAt).getTime() / 1000)}:R>`, inline: true },
                { name: 'Last Case', value: `<t:${Math.floor(new Date(cases[cases.length - 1].createdAt).getTime() / 1000)}:R>`, inline: true },
                { name: 'Warning', value: 'This action cannot be undone! Cases will be permanently deleted.', inline: false }
            )
            .setColor(0xFFA500)
            .setFooter({ text: 'Select a case to remove it or choose "REMOVE ALL CASES"' })
            .setTimestamp();

        try {
            await interaction.editReply({
                embeds: [overviewEmbed],
                components: [dropdownRow]
            });
            
        } catch (error) {
            console.error('Error sending cases remove menu:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ Failed to create cases remove menu.')
                ]
            });
        }
    },

    handleComponent: async (interaction) => {
        if (!interaction.customId.startsWith('cases_remove_')) return false;
        
        try {
            await interaction.deferReply({ ephemeral: true });
            
            const targetUserId = interaction.customId.split('_')[2];
            
            if (interaction.values[0] === 'remove_all_cases') {
                try {
                    const [result] = await db.pool.execute(
                        'DELETE FROM cases WHERE guildId = ? AND userId = ?',
                        [interaction.guild.id, targetUserId]
                    );

                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ All Cases Removed Successfully')
                        .setDescription(`Successfully removed ${result.affectedRows} cases.`)
                        .setColor(0x00FF00)
                        .setTimestamp();

                    await interaction.editReply({
                        embeds: [successEmbed]
                    });

                    try {
                        await interaction.message.delete();
                    } catch (deleteError) {
                        console.error('Error deleting original message:', deleteError);
                    }
                    
                    return true;
                } catch (error) {
                    console.error('Error removing all cases:', error);
                    await interaction.editReply({
                        content: '❌ There was an error removing all cases.'
                    });
                    return true;
                }
            }
            
            const caseId = interaction.values[0].replace('case_', '');
            
            try {
                const [caseRows] = await db.pool.execute(
                    'SELECT * FROM cases WHERE id = ?',
                    [caseId]
                );
                
                if (caseRows.length === 0) {
                    await interaction.editReply({
                        content: '❌ Case not found. It may have already been deleted.'
                    });
                    return true;
                }

                const caseData = caseRows[0];

                const [result] = await db.pool.execute(
                    'DELETE FROM cases WHERE id = ?',
                    [caseId]
                );

                if (result.affectedRows === 0) {
                    await interaction.editReply({
                        content: '❌ Failed to remove the case.'
                    });
                    return true;
                }

                const caseDate = new Date(caseData.createdAt).toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                });
                const caseTime = new Date(caseData.createdAt).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const caseType = caseData.type || 'Unknown';

                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Case Removed Successfully')
                    .setDescription(`Case #${caseData.caseId || 'N/A'} has been removed.`)
                    .addFields(
                        { name: 'Case Details', value: `${caseDate} at ${caseTime} (${caseType})`, inline: false },
                        { name: 'Reason', value: caseData.reason || 'No reason provided', inline: false },
                    )
                    .setColor(0x00FF00)
                    .setTimestamp();

                await interaction.editReply({
                    embeds: [successEmbed]
                });

                try {
                    await interaction.message.delete();
                } catch (deleteError) {
                    console.error('Error deleting original message:', deleteError);
                }
                
                return true;
            } catch (error) {
                console.error('Error removing case:', error);
                await interaction.editReply({
                    content: '❌ There was an error removing the case.'
                });
                return true;
            }
        } catch (error) {
            console.error('Error in cases-remove component handler:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({
                        content: '❌ This interaction failed. Please try the command again.',
                        ephemeral: true
                    });
                } catch (fallbackError) {
                    console.error('Error in fallback reply:', fallbackError);
                }
            } else if (interaction.deferred) {
                try {
                    await interaction.editReply({
                        content: '❌ An error occurred while processing your request.'
                    });
                } catch (editError) {
                    console.error('Error editing reply:', editError);
                }
            }
            return true;
        }
    }
};