const { EmbedBuilder } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
    name: 'bview',
    description: 'View comprehensive backup details including server structure',
    usage: 'bview <name>',
    async execute(message, args) {
        const name = args.join(' ');
        if (!name) {
            return message.channel.send('❌ Please provide a backup name. Usage: `bview <name>`');
        }

        try {
            const [backup] = await db.executeWithRetry(
                'SELECT * FROM backups WHERE guild_id = ? AND name = ?',
                [message.guild.id, name]
            );

            if (!backup) {
                return message.channel.send('❌ Backup not found.');
            }

            const backupData = JSON.parse(backup.data);
            const serverStructure = backupData.server_structure;
            
            const embed = new EmbedBuilder()
                .setTitle(`📊 Backup: ${backup.name}`)
                .setColor(0x3498DB)
                .setDescription(`Comprehensive backup of **${serverStructure.guild_info.name}**`)
                .addFields(
                    { name: 'Backup ID', value: `\`${backup.id}\``, inline: true },
                    { name: 'Created', value: new Date(backup.created_at).toLocaleString(), inline: true },
                    { name: 'Version', value: backupData.backup_version || '2.0', inline: true }
                );

            if (serverStructure) {
                embed.addFields(
                    { name: '👑 Server Info', value: `Owner: <@${serverStructure.guild_info.owner_id}>\nMembers: ${serverStructure.guild_info.member_count}`, inline: true },
                    { name: '🎭 Roles', value: serverStructure.roles.length.toString(), inline: true },
                    { name: '📁 Channels', value: serverStructure.channels.length.toString(), inline: true },
                    { name: '📂 Categories', value: serverStructure.categories.length.toString(), inline: true },
                    { name: '😊 Emojis', value: serverStructure.emojis.length.toString(), inline: true },
                    { name: '👥 Members', value: serverStructure.members.length.toString(), inline: true }
                );
            }

            if (backupData.mysql_data) {
                const mysqlStats = [];
                if (backupData.mysql_data.data.cases) mysqlStats.push(`Cases: ${backupData.mysql_data.data.cases.length}`);
                if (backupData.mysql_data.data.tickets) mysqlStats.push(`Tickets: ${backupData.mysql_data.data.tickets.length}`);
                if (backupData.mysql_data.data.tags) mysqlStats.push(`Tags: ${backupData.mysql_data.data.tags.length}`);
                if (backupData.mysql_data.data.reviews) mysqlStats.push(`Reviews: ${backupData.mysql_data.data.reviews.length}`);

                if (mysqlStats.length > 0) {
                    embed.addFields({ 
                        name: '🗃️ Bot Data', 
                        value: mysqlStats.join(' | ') 
                    });
                }
            }

            if (serverStructure.guild_info.features && serverStructure.guild_info.features.length > 0) {
                embed.addFields({
                    name: '🚀 Server Features',
                    value: serverStructure.guild_info.features.slice(0, 5).join(', ') + 
                          (serverStructure.guild_info.features.length > 5 ? `... (+${serverStructure.guild_info.features.length - 5} more)` : ''),
                    inline: false
                });
            }

            embed.setFooter({ text: `Total Backup Size: ${Math.round(backupData.backup_metadata?.total_size / 1024) || 'N/A'} KB` });

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Backup view error:', error);
            message.channel.send('❌ Error viewing backup.');
        }
    }
};