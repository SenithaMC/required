const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../utils/db');

const activeAFKLists = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('afklist')
        .setDescription('View all AFK users in the server')
        .addIntegerOption(option =>
            option
                .setName('page')
                .setDescription('Page number to view')
                .setMinValue(1)
                .setRequired(false)
        ),

    async execute(interaction) {
        const page = interaction.options.getInteger('page') || 1;
        const guildId = interaction.guild.id;

        await interaction.deferReply();

        try {
            await sendAFKListPage(interaction, page, true);
        } catch (error) {
            console.error('Error fetching AFK list:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ There was an error fetching AFK users.')
                ]
            });
        }
    },

    handleComponent: async (interaction) => {
        if (!interaction.customId.startsWith('afklist_')) return false;
        
        const [_, guildId, action, currentPage] = interaction.customId.split('_');
        let page = parseInt(currentPage);
        
        if (action === 'next') page++;
        else if (action === 'prev') page--;
        else return false;
        
        if (!activeAFKLists.has(interaction.message.id)) {
            return interaction.reply({
                content: 'This AFK list has expired. Use the command again to view the latest data.',
                ephemeral: true
            });
        }
        
        try {
            await interaction.deferUpdate();
            await sendAFKListPage(interaction, page, true);
        } catch (error) {
            console.error('Error updating AFK list:', error);
            await interaction.followUp({
                content: 'There was an error updating the AFK list.',
                ephemeral: true
            });
        }
        
        return true;
    }
};

async function sendAFKListPage(interaction, page = 1, isInteraction = false) {
    const guildId = interaction.guild.id;
    const limit = 10;
    const skip = (page - 1) * limit;

    try {
        const [afkUsers] = await db.pool.execute(
            `SELECT * FROM afk 
             WHERE guildId = ? 
             ORDER BY createdAt DESC 
             LIMIT ? OFFSET ?`,
            [guildId, limit, skip]
        );

        const [countRows] = await db.pool.execute(
            'SELECT COUNT(*) as total FROM afk WHERE guildId = ?',
            [guildId]
        );
        const totalAFK = countRows[0].total;
        const totalPages = Math.ceil(totalAFK / limit);

        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        if (afkUsers.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('AFK Users')
                .setDescription('No users are currently AFK in this server.')
                .setTimestamp();

            if (isInteraction) {
                return interaction.editReply({ embeds: [embed], components: [] });
            } else {
                return interaction.channel.send({ embeds: [embed] });
            }
        }

        const afkList = [];
        for (const afk of afkUsers) {
            try {
                const user = await interaction.client.users.fetch(afk.userId).catch(() => null);
                const userTag = user ? user.tag : `Unknown User (${afk.userId})`;
                const timeAgo = `<t:${Math.floor(new Date(afk.createdAt).getTime() / 1000)}:R>`;
                afkList.push(`• **${userTag}** - ${afk.reason}\n  ⏰ ${timeAgo}`);
            } catch (error) {
                const timeAgo = `<t:${Math.floor(new Date(afk.createdAt).getTime() / 1000)}:R>`;
                afkList.push(`• **User ID: ${afk.userId}** - ${afk.reason}\n  ⏰ ${timeAgo}`);
            }
        }

        const formattedList = afkList.join('\n\n');

        const buttons = new ActionRowBuilder();
        
        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId(`afklist_${guildId}_prev_${page}`)
                .setEmoji({ id: '1416754806734848071', name: 'left' })
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page <= 1)
        );
        
        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId(`afklist_${guildId}_next_${page}`)
                .setEmoji({ id: '1416754743383953458', name: 'right' })
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page >= totalPages)
        );

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`AFK Users - ${interaction.guild.name}`)
            .setDescription(formattedList)
            .setFooter({ text: `Page ${page} of ${totalPages} • ${totalAFK} user${totalAFK !== 1 ? 's' : ''} AFK` })
            .setTimestamp();

        let msg;
        if (isInteraction) {
            msg = await interaction.editReply({ 
                embeds: [embed], 
                components: totalPages > 1 ? [buttons] : []
            });
        } else {
            msg = await interaction.channel.send({ 
                embeds: [embed], 
                components: totalPages > 1 ? [buttons] : []
            });
        }
        
        activeAFKLists.set(msg.id, Date.now());
        
        setTimeout(() => {
            activeAFKLists.delete(msg.id);
        }, 10 * 60 * 1000);
        
    } catch (error) {
        console.error('Error fetching AFK list:', error);
        throw error;
    }
}

setInterval(() => {
    const now = Date.now();
    for (const [messageId, timestamp] of activeAFKLists.entries()) {
        if (now - timestamp > 10 * 60 * 1000) {
            activeAFKLists.delete(messageId);
        }
    }
}, 60 * 60 * 1000);