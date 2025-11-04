const { PermissionsBitField, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
    name: 'bload',
    description: 'Load a created backup using dropdown menu',
    usage: 'bload [name]',
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.channel.send('❌ You need administrator permissions to load backups.');
        }

        const backupName = args.join(' ');
        if (backupName) {
            return await this.loadBackupByName(message, backupName);
        }

        await this.showBackupLoadDropdown(message);
    },

    async loadBackupByName(message, backupName) {
        try {
            const [backup] = await db.executeWithRetry(
                'SELECT * FROM backups WHERE guild_id = ? AND name = ?',
                [message.guild.id, backupName]
            );

            if (!backup) {
                return message.channel.send('❌ Backup not found.');
            }

            const embed = new EmbedBuilder()
                .setTitle('🔄 Load Backup')
                .setDescription(`You are about to load the backup: **${backup.name}**`)
                .setColor(0xF39C12)
                .addFields(
                    { name: 'Backup ID', value: `\`${backup.id}\``, inline: true },
                    { name: 'Created', value: new Date(backup.created_at).toLocaleString(), inline: true },
                    { name: 'Warning', value: 'This will restore server roles, channels, and bot data. This action cannot be undone!', inline: false }
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`bload_confirm_${backup.id}`)
                    .setLabel('Load Backup')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('bload_cancel')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

            await message.channel.send({ 
                embeds: [embed], 
                components: [row] 
            });

        } catch (error) {
            console.error('Backup load error:', error);
            message.channel.send('❌ Error loading backup.');
        }
    },

    async showBackupLoadDropdown(message) {
        try {
            const backups = await db.executeWithRetry(
                'SELECT id, name, created_at FROM backups WHERE guild_id = ? ORDER BY created_at DESC',
                [message.guild.id]
            );

            if (backups.length === 0) {
                return message.channel.send('❌ No backups found for this server.');
            }

            const embed = new EmbedBuilder()
                .setTitle('🔄 Load Backup')
                .setDescription('Select a backup to load from the dropdown below:')
                .setColor(0xF39C12)
                .setFooter({ text: `Found ${backups.length} backup(s) • This will restore server structure and data` });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('bload_select')
                .setPlaceholder('Select a backup to load...')
                .addOptions(
                    backups.map(backup => ({
                        label: backup.name.length > 25 ? backup.name.substring(0, 22) + '...' : backup.name,
                        description: `Created: ${new Date(backup.created_at).toLocaleDateString()}`,
                        value: backup.id.toString()
                    }))
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await message.channel.send({ 
                embeds: [embed], 
                components: [row] 
            });

        } catch (error) {
            console.error('Backup dropdown error:', error);
            message.channel.send('❌ Error loading backups.');
        }
    }
};