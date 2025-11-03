const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
  name: 'bview',
  description: 'View detailed information about a backup',
  usage: 'bview [name]',
  aliases: ['backupview', 'viewbackup'],
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.channel.send('❌ You need administrator permissions to view backups.');
    }

    // If backup name provided directly
    if (args[0]) {
      return await viewSpecificBackup(message, args[0]);
    }

    // Show backup selection dropdown
    await showBackupSelection(message);
  }
};

async function showBackupSelection(message) {
  try {
    const backups = await db.executeWithRetry(
      'SELECT id, name, created_at FROM backups WHERE guild_id = ? ORDER BY created_at DESC',
      [message.guild.id]
    );

    if (backups.length === 0) {
      return message.channel.send('❌ No backups found for this server.');
    }

    const embed = new EmbedBuilder()
      .setTitle('👁️ View Backup Data')
      .setDescription('Select a backup from the dropdown below to view its detailed contents.')
      .setColor(0x00AE86)
      .setFooter({ 
        text: `${message.client.user.username} • Backup Viewer`,
        iconURL: message.client.user.displayAvatarURL()
      })
      .setTimestamp();

    const options = backups.slice(0, 25).map(backup => ({
      label: backup.name.length > 25 ? backup.name.substring(0, 22) + '...' : backup.name,
      value: backup.id.toString(),
      description: `Created ${formatTimeAgo(backup.created_at)}`,
      emoji: '📋'
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('bview_select')
      .setPlaceholder('📂 Select a backup to view...')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const reply = await message.channel.send({ 
      embeds: [embed], 
      components: [row] 
    });

    const collector = reply.createMessageComponentCollector({
      filter: i => i.user.id === message.author.id && i.customId === 'bview_select',
      time: 120000
    });

    collector.on('collect', async i => {
      await i.deferUpdate();
      const backupId = i.values[0];
      await viewBackupDetails(i, backupId);
    });

    collector.on('end', () => {
      reply.edit({ components: [] }).catch(() => {});
    });

  } catch (error) {
    console.error('Backup view error:', error);
    message.channel.send('❌ Error retrieving backups. Please try again.');
  }
}

async function viewSpecificBackup(message, backupName) {
  try {
    const [backup] = await db.executeWithRetry(
      'SELECT * FROM backups WHERE guild_id = ? AND name = ?',
      [message.guild.id, backupName]
    );

    if (!backup) {
      return message.channel.send(`❌ Backup \`${backupName}\` not found.`);
    }

    await displayBackupData(message, backup);
  } catch (error) {
    console.error('Specific backup view error:', error);
    message.channel.send('❌ Error viewing backup. Please try again.');
  }
}

async function viewBackupDetails(interaction, backupId) {
  try {
    const [backup] = await db.executeWithRetry(
      'SELECT * FROM backups WHERE id = ?',
      [backupId]
    );

    if (!backup) {
      return await interaction.followUp({ 
        content: '❌ Backup not found.', 
        flags: 64 
      });
    }

    await displayBackupData(interaction, backup);
  } catch (error) {
    console.error('Backup details error:', error);
    await interaction.followUp({ 
      content: '❌ Error viewing backup details.', 
      flags: 64 
    });
  }
}

async function displayBackupData(context, backup) {
  try {
    const backupData = JSON.parse(backup.data);
    const createdDate = new Date(backup.created_at);
    const sizeKB = (JSON.stringify(backupData).length / 1024).toFixed(2);

    // Count records per table
    const tableCounts = {};
    for (const [table, data] of Object.entries(backupData)) {
      if (Array.isArray(data)) {
        tableCounts[table] = data.length;
      } else if (typeof data === 'object' && data !== null) {
        tableCounts[table] = 1; // Single object
      } else {
        tableCounts[table] = 0;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`📊 Backup: ${backup.name}`)
      .setDescription(`Detailed view of backup data created <t:${Math.floor(createdDate.getTime() / 1000)}:R>`)
      .setColor(0x00AE86)
      .addFields(
        { name: '🆔 Backup ID', value: `\`${backup.id}\``, inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(createdDate.getTime() / 1000)}:F>`, inline: true },
        { name: '💾 Size', value: `${sizeKB} KB`, inline: true }
      )
      .setFooter({ 
        text: `${context.client?.user?.username || 'Backup System'} • Data Summary`,
        iconURL: context.client?.user?.displayAvatarURL()
      })
      .setTimestamp();

    // Add table counts
    const tableFields = [];
    for (const [table, count] of Object.entries(tableCounts)) {
      if (count > 0) {
        tableFields.push(`• **${table}**: ${count} records`);
      }
    }

    if (tableFields.length > 0) {
      embed.addFields({
        name: '📋 Data Contents',
        value: tableFields.join('\n').substring(0, 1024),
        inline: false
      });
    }

    // Add backup version info if available
    if (backupData.backup_version) {
      embed.addFields({
        name: '🔧 Backup Version',
        value: backupData.backup_version,
        inline: true
      });
    }

    if (backupData.backup_created_at) {
      embed.addFields({
        name: '⏰ Backup Timestamp',
        value: new Date(backupData.backup_created_at).toLocaleString(),
        inline: true
      });
    }

    if (context.reply || context.followUp) {
      // It's an interaction
      await context.followUp({ 
        embeds: [embed],
        flags: 64 
      });
    } else {
      // It's a message
      await context.channel.send({ embeds: [embed] });
    }

  } catch (error) {
    console.error('Display backup data error:', error);
    const errorMsg = '❌ Error parsing backup data. The backup might be corrupted.';
    
    if (context.reply || context.followUp) {
      await context.followUp({ 
        content: errorMsg,
        flags: 64 
      });
    } else {
      await context.channel.send(errorMsg);
    }
  }
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
