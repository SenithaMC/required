const { PermissionsBitField } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
  name: 'bcreate',
  description: 'Create a manual backup of server data',
  usage: 'bcreate <name>',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.channel.send('❌ You need administrator permissions to use this command.');
    }

    if (!args[0]) {
      return message.channel.send('❌ Please provide a name for the backup. Usage: `bcreate <name>`');
    }

    const backupName = args.join(' ').slice(0, 255);
    const guildId = message.guild.id;

    try {
      await message.channel.send('🔄 Creating backup... This may take a moment.');

      const backupData = await gatherGuildData(guildId);

      await db.executeWithRetry(
        'INSERT INTO backups (guild_id, name, data) VALUES (?, ?, ?)',
        [guildId, backupName, JSON.stringify(backupData)]
      );

      await updateBackupSettings(guildId);

      await cleanupOldBackups(guildId);

      message.channel.send(`✅ Backup created successfully: **${backupName}**`);

    } catch (error) {
      console.error('Backup creation error:', error);
      message.channel.send('❌ Failed to create backup. Please try again later.');
    }
  }
};

async function gatherGuildData(guildId) {
  const backupData = {};

  try {
    const [guildSettings] = await db.executeWithRetry(
      'SELECT * FROM guilds WHERE guild_id = ?',
      [guildId]
    );
    backupData.guild_settings = guildSettings || {};

    const cases = await db.executeWithRetry(
      'SELECT * FROM cases WHERE guildId = ?',
      [guildId]
    );
    backupData.cases = cases;

    const userMessages = await db.executeWithRetry(
      'SELECT * FROM user_messages WHERE guild_id = ?',
      [guildId]
    );
    backupData.user_messages = userMessages;

    const afkData = await db.executeWithRetry(
      'SELECT * FROM afk WHERE guildId = ?',
      [guildId]
    );
    backupData.afk = afkData;

    const [commandRestrict] = await db.executeWithRetry(
      'SELECT * FROM command_restrict WHERE guildId = ?',
      [guildId]
    );
    backupData.command_restrict = commandRestrict || {};

    const giveaways = await db.executeWithRetry(
      'SELECT * FROM giveaways WHERE guildId = ?',
      [guildId]
    );
    backupData.giveaways = giveaways;

    const invites = await db.executeWithRetry(
      'SELECT * FROM invites WHERE guildId = ?',
      [guildId]
    );
    backupData.invites = invites;

    const memberInvites = await db.executeWithRetry(
      'SELECT * FROM member_invites WHERE guildId = ?',
      [guildId]
    );
    backupData.member_invites = memberInvites;

    const [greetConfig] = await db.executeWithRetry(
      'SELECT * FROM greet_configs WHERE guildId = ?',
      [guildId]
    );
    backupData.greet_configs = greetConfig || {};

    const tickets = await db.executeWithRetry(
      'SELECT * FROM tickets WHERE guild_id = ?',
      [guildId]
    );
    backupData.tickets = tickets;

    const ticketPanels = await db.executeWithRetry(
      'SELECT * FROM ticket_panels WHERE guild_id = ?',
      [guildId]
    );
    backupData.ticket_panels = ticketPanels;

    const ticketCategories = await db.executeWithRetry(
      'SELECT * FROM ticket_categories WHERE guild_id = ?',
      [guildId]
    );
    backupData.ticket_categories = ticketCategories;

    const tags = await db.executeWithRetry(
      'SELECT * FROM tags WHERE guild_id = ?',
      [guildId]
    );
    backupData.tags = tags;

    const reviews = await db.executeWithRetry(
      'SELECT * FROM reviews WHERE guild_id = ?',
      [guildId]
    );
    backupData.reviews = reviews;

    const [reviewChannel] = await db.executeWithRetry(
      'SELECT * FROM review_channels WHERE guild_id = ?',
      [guildId]
    );
    backupData.review_channels = reviewChannel || {};

    const [transcriptChannel] = await db.executeWithRetry(
      'SELECT * FROM transcript_channels WHERE guild_id = ?',
      [guildId]
    );
    backupData.transcript_channels = transcriptChannel || {};

    const [backupSettings] = await db.executeWithRetry(
      'SELECT * FROM backup_settings WHERE guild_id = ?',
      [guildId]
    );
    backupData.backup_settings = backupSettings || {};

    backupData.backup_created_at = new Date().toISOString();
    backupData.backup_version = '1.0';

  } catch (error) {
    console.error('Error gathering guild data:', error);
    throw error;
  }

  return backupData;
}

async function updateBackupSettings(guildId) {
  try {
    await db.executeWithRetry(
      `INSERT INTO backup_settings (guild_id, last_backup) 
       VALUES (?, NOW()) 
       ON DUPLICATE KEY UPDATE last_backup = NOW()`,
      [guildId]
    );
  } catch (error) {
    console.error('Error updating backup settings:', error);
  }
}

async function cleanupOldBackups(guildId) {
  try {
    const [settings] = await db.executeWithRetry(
      'SELECT keep_amount FROM backup_settings WHERE guild_id = ?',
      [guildId]
    );

    const keepAmount = settings?.keep_amount || 10;

    await db.executeWithRetry(
      `DELETE FROM backups 
       WHERE guild_id = ? 
       AND id NOT IN (
         SELECT id FROM (
           SELECT id FROM backups 
           WHERE guild_id = ? 
           ORDER BY created_at DESC 
           LIMIT ?
         ) AS recent_backups
       )`,
      [guildId, guildId, keepAmount]
    );

  } catch (error) {
    console.error('Error cleaning up old backups:', error);
  }
}
