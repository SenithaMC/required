const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
  name: 'blist',
  description: 'Show all backups for this server',
  usage: 'blist',
  aliases: ['backuplist', 'listbackups'],
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.channel.send('❌ You need administrator permissions to view backups.');
    }

    try {
      const backups = await db.executeWithRetry(
        'SELECT id, name, created_at, LENGTH(data) as size FROM backups WHERE guild_id = ? ORDER BY created_at DESC',
        [message.guild.id]
      );

      if (backups.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('💾 Server Backups')
          .setDescription('No backups found for this server.')
          .setColor(0x808080)
          .addFields({
            name: 'Create Your First Backup',
            value: 'Use `bcreate <name>` to create your first backup of server data.',
            inline: false
          })
          .setFooter({ 
            text: `${message.client.user.username} • Backup System`,
            iconURL: message.client.user.displayAvatarURL()
          })
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      }

      const totalSize = backups.reduce((sum, backup) => sum + (backup.size || 0), 0);
      const formattedSize = (totalSize / 1024).toFixed(2); // Convert to KB

      const embed = new EmbedBuilder()
        .setTitle(`💾 Server Backups (${backups.length})`)
        .setDescription(`Total storage used: **${formattedSize} KB**\n\nSelect a backup from the dropdown below to view details or manage.`)
        .setColor(0x00AE86)
        .setFooter({ 
          text: `${message.client.user.username} • ${backups.length} backups`,
          iconURL: message.client.user.displayAvatarURL()
        })
        .setTimestamp();

      // Create dropdown options
      const options = backups.slice(0, 25).map((backup, index) => ({
        label: backup.name.length > 25 ? backup.name.substring(0, 22) + '...' : backup.name,
        value: backup.id.toString(),
        description: `Created ${formatTimeAgo(backup.created_at)}`,
        emoji: getBackupEmoji(index)
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('blist_select')
        .setPlaceholder('📂 Select a backup to manage...')
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const reply = await message.channel.send({ 
        embeds: [embed], 
        components: [row] 
      });

      setupBackupListCollector(reply, message, backups);

    } catch (error) {
      console.error('Backup list error:', error);
      message.channel.send('❌ Error retrieving backups. Please try again.');
    }
  }
};

function setupBackupListCollector(reply, message, backups) {
  const collector = reply.createMessageComponentCollector({
    filter: i => i.user.id === message.author.id && i.customId === 'blist_select',
    time: 120000
  });

  collector.on('collect', async i => {
    await i.deferUpdate();
    
    const backupId = i.values[0];
    const backup = backups.find(b => b.id.toString() === backupId);
    
    if (!backup) {
      return await i.followUp({ 
        content: '❌ Backup not found.', 
        flags: 64 
      });
    }

    const backupEmbed = createBackupDetailEmbed(backup);
    const actionRow = createBackupActionRow(backup.id);

    await i.followUp({ 
      embeds: [backupEmbed], 
      components: [actionRow],
      flags: 64 
    });
  });

  collector.on('end', () => {
    reply.edit({ components: [] }).catch(() => {});
  });
}

function createBackupDetailEmbed(backup) {
  const sizeKB = (backup.size / 1024).toFixed(2);
  const createdDate = new Date(backup.created_at);
  
  const embed = new EmbedBuilder()
    .setTitle(`📋 Backup: ${backup.name}`)
    .setColor(0x00AE86)
    .addFields(
      { name: '🆔 Backup ID', value: `\`${backup.id}\``, inline: true },
      { name: '📅 Created', value: `<t:${Math.floor(createdDate.getTime() / 1000)}:R>`, inline: true },
      { name: '💾 Size', value: `${sizeKB} KB`, inline: true },
      { name: '📊 Full Date', value: `<t:${Math.floor(createdDate.getTime() / 1000)}:F>`, inline: false }
    )
    .setTimestamp();

  return embed;
}

function createBackupActionRow(backupId) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`bload_${backupId}`)
        .setLabel('Load Backup')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🔁'),
      new ButtonBuilder()
        .setCustomId(`bview_${backupId}`)
        .setLabel('View Data')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('👁️'),
      new ButtonBuilder()
        .setCustomId(`bdel_${backupId}`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️')
    );
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function getBackupEmoji(index) {
  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  return emojis[index] || '📁';
}
