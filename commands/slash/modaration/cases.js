const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const db = require('../../../utils/db');

const activeCases = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cases')
        .setDescription('View all cases for a user')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to view cases for')
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option
                .setName('page')
                .setDescription('Page number to view')
                .setMinValue(1)
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ You do not have permission to view cases of members.')
                ],
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const page = interaction.options.getInteger('page') || 1;

        await interaction.deferReply();

        try {
            await sendCasesPage(interaction, targetUser, page, true);
        } catch (error) {
            console.error('Error displaying cases:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ There was an error fetching cases.')
                ]
            });
        }
    },

    handleComponent: async (interaction) => {
        if (!interaction.customId.startsWith('cases_')) return false;
        
        const [_, userId, action, currentPage] = interaction.customId.split('_');
        let page = parseInt(currentPage);
        
        if (action === 'next') page++;
        else if (action === 'prev') page--;
        else return false;
        
        if (!activeCases.has(interaction.message.id)) {
            return interaction.reply({
                content: 'This cases view has expired. Use the command again to view the latest data.',
                ephemeral: true
            });
        }
        
        try {
            await interaction.deferUpdate();
            await sendCasesPage(interaction, userId, page, true);
        } catch (error) {
            console.error('Error updating cases:', error);
            await interaction.followUp({
                content: 'There was an error updating the cases view.',
                ephemeral: true
            });
        }
        
        return true;
    }
};

async function sendCasesPage(interaction, targetUserOrId, page = 1, isInteraction = false) {
    const targetUser = typeof targetUserOrId === 'string' 
        ? await interaction.client.users.fetch(targetUserOrId).catch(() => null)
        : targetUserOrId;
    
    const guild = interaction.guild;
    const limit = 5;
    const skip = (page - 1) * limit;

    if (!targetUser) {
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ User not found.');
        
        if (isInteraction) {
            return interaction.editReply({ embeds: [embed], components: [] });
        } else {
            return interaction.channel.send({ embeds: [embed] });
        }
    }

    try {
        const [cases] = await db.pool.execute(
            'SELECT * FROM cases WHERE guildId = ? AND userId = ? ORDER BY caseId DESC LIMIT ? OFFSET ?',
            [guild.id, targetUser.id, limit, skip]
        );

        const [countRows] = await db.pool.execute(
            'SELECT COUNT(*) as total FROM cases WHERE guildId = ? AND userId = ?',
            [guild.id, targetUser.id]
        );
        const totalCases = countRows[0].total;

        const now = new Date();
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        
        const [last24hRows] = await db.pool.execute(
            'SELECT COUNT(*) as count FROM cases WHERE guildId = ? AND userId = ? AND createdAt >= ?',
            [guild.id, targetUser.id, oneDayAgo]
        );
        const last24hCount = last24hRows[0].count;
        
        const [last7dRows] = await db.pool.execute(
            'SELECT COUNT(*) as count FROM cases WHERE guildId = ? AND userId = ? AND createdAt >= ?',
            [guild.id, targetUser.id, sevenDaysAgo]
        );
        const last7dCount = last7dRows[0].count;

        const totalPages = Math.ceil(totalCases / limit);

        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        if (cases.length === 0) {
            const embed = new EmbedBuilder()
                .setAuthor({ name: 'Case History', iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
                .setColor(0xFFA500)
                .setDescription('No cases found for this user.')
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));

            if (isInteraction) {
                return interaction.editReply({ embeds: [embed], components: [] });
            } else {
                return interaction.channel.send({ embeds: [embed] });
            }
        }

        const casesContent = cases.map(c => {
            const date = `<t:${Math.floor(new Date(c.createdAt).getTime() / 1000)}:F>`;
            return `• ${date} \`${c.type}\` #${c.caseId} — ${c.reason}`;
        }).join('\n');

        const buttons = new ActionRowBuilder();
        
        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId(`cases_${targetUser.id}_prev_${page}`)
                .setEmoji({ id:'1416754806734848071', name: 'left' })
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page <= 1)
        );
        
        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId(`cases_${targetUser.id}_next_${page}`)
                .setEmoji({ id: '1416754743383953458', name: 'right'})
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page >= totalPages)
        );

        const embed = new EmbedBuilder()
            .setAuthor({ name: `Case History for ${targetUser.tag}`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
            .setDescription(casesContent)
            .setColor(0x0099FF)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'Last 24 hours', value: `${last24hCount} infraction${last24hCount !== 1 ? 's' : ''}`, inline: true },
                { name: 'Last 7 days', value: `${last7dCount} infraction${last7dCount !== 1 ? 's' : ''}`, inline: true },
                { name: 'Total', value: `${totalCases} infraction${totalCases !== 1 ? 's' : ''}`, inline: true }
            )
            .setFooter({ text: `Page ${page} of ${totalPages} • Query: ${targetUser.tag}` })
            .setTimestamp();

        let msg;
        if (isInteraction) {
            msg = await interaction.editReply({ 
                embeds: [embed], 
                components: [buttons] 
            });
        } else {
            msg = await interaction.channel.send({ 
                embeds: [embed], 
                components: [buttons] 
            });
        }
        
        activeCases.set(msg.id, Date.now());
        
        setTimeout(() => {
            activeCases.delete(msg.id);
        }, 10 * 60 * 1000);
        
    } catch (error) {
        console.error('Error fetching cases:', error);
        throw error;
    }
}

setInterval(() => {
    const now = Date.now();
    for (const [messageId, timestamp] of activeCases.entries()) {
        if (now - timestamp > 10 * 60 * 1000) {
            activeCases.delete(messageId);
        }
    }
}, 60 * 60 * 1000);