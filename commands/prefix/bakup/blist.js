const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
    name: 'blist',
    description: 'Show created backup list',
    usage: 'blist',
    async execute(message, args) {
        try {
            const backups = await db.executeWithRetry(
                'SELECT id, name, created_at FROM backups WHERE guild_id = ? ORDER BY created_at DESC',
                [message.guild.id]
            );

            if (backups.length === 0) {
                return message.channel.send('❌ No backups found for this server.');
            }

            const embed = new EmbedBuilder()
                .setTitle(`Backups for ${message.guild.name}`)
                .setColor(0x00AE86)
                .setTimestamp();

            backups.forEach((backup, index) => {
                const date = new Date(backup.created_at).toLocaleString();
                embed.addFields({
                    name: `${index + 1}. ${backup.name}`,
                    value: `ID: ${backup.id} | Created: ${date}`,
                    inline: false
                });
            });

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Backup list error:', error);
            message.channel.send('❌ Error retrieving backup list.');
        }
    },

    async handleComponent(interaction) {
        if (interaction.customId === 'bview_select') {
            await this.showBackupSelect(interaction, 'view');
        } else if (interaction.customId === 'bload_select') {
            await this.showBackupSelect(interaction, 'load');
        } else if (interaction.customId === 'bdel_select') {
            await this.showBackupSelect(interaction, 'delete');
        }
        return true;
    },

    async showBackupSelect(interaction, action) {
        try {
            const backups = await db.executeWithRetry(
                'SELECT id, name, created_at FROM backups WHERE guild_id = ? ORDER BY created_at DESC',
                [interaction.guild.id]
            );

            if (backups.length === 0) {
                return await interaction.reply({ 
                    content: '❌ No backups found.', 
                    flags: 64 
                });
            }

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`${action}_backup_select`)
                .setPlaceholder(`Select a backup to ${action}...`)
                .addOptions(
                    backups.map(backup => ({
                        label: backup.name.length > 25 ? backup.name.substring(0, 22) + '...' : backup.name,
                        description: `Created: ${new Date(backup.created_at).toLocaleDateString()}`,
                        value: backup.id.toString()
                    }))
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.reply({
                content: `Select a backup to ${action}:`,
                components: [row],
                flags: 64
            });

        } catch (error) {
            console.error('Backup select error:', error);
            await interaction.reply({ 
                content: '❌ Error loading backups.', 
                flags: 64 
            });
        }
    }
};