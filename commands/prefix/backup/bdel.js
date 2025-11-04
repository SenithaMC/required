const { PermissionsBitField, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
    name: 'bdel',
    description: 'Delete a created backup using dropdown menu',
    usage: 'bdel [name]',
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.channel.send('❌ You need administrator permissions to delete backups.');
        }

        const backupName = args.join(' ');
        if (backupName) {
            return await this.deleteBackupByName(message, backupName);
        }

        await this.showBackupDeleteDropdown(message);
    },

    async deleteBackupByName(message, backupName) {
        try {
            const [backup] = await db.executeWithRetry(
                'SELECT * FROM backups WHERE guild_id = ? AND name = ?',
                [message.guild.id, backupName]
            );

            if (!backup) {
                return message.channel.send('❌ Backup not found.');
            }

            await db.executeWithRetry(
                'DELETE FROM backups WHERE id = ? AND guild_id = ?',
                [backup.id, message.guild.id]
            );

            const embed = new EmbedBuilder()
                .setTitle('✅ Backup Deleted')
                .setColor(0x00FF00)
                .setDescription(`Backup **${backup.name}** has been permanently deleted.`)
                .addFields(
                    { name: 'Backup ID', value: `\`${backup.id}\``, inline: true },
                    { name: 'Created', value: new Date(backup.created_at).toLocaleString(), inline: true }
                )
                .setFooter({ text: 'This action cannot be undone' });

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Backup delete error:', error);
            message.channel.send('❌ Error deleting backup.');
        }
    },

    async showBackupDeleteDropdown(message) {
        try {
            const backups = await db.executeWithRetry(
                'SELECT id, name, created_at FROM backups WHERE guild_id = ? ORDER BY created_at DESC',
                [message.guild.id]
            );

            if (backups.length === 0) {
                return message.channel.send('❌ No backups found for this server.');
            }

            const embed = new EmbedBuilder()
                .setTitle('🗑️ Delete Backup')
                .setDescription('Select a backup to delete from the dropdown below:')
                .setColor(0xFF0000)
                .setFooter({ text: `Found ${backups.length} backup(s) • This action cannot be undone` });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('bdel_select')
                .setPlaceholder('Select a backup to delete...')
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