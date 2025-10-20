const { EmbedBuilder } = require('discord.js');
const db = require('../../../utils/db');
const config = require('../../../config');

module.exports = {
  name: 'cleardb',
  description: 'Clear database tables (Restricted to bot owner)',
  usage: 'cleardb <table> [confirm]',
  async execute(message, args) {
    const authorizedUserId = '1240540042926096406';
    if (message.author.id !== authorizedUserId) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:mc_white_cross:1411727598840451174> This command is restricted to the bot owner.')
        ]
      });
    }

    if (!args[0]) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('Database Clearance')
            .setDescription('Please specify a table to clear.')
            .addFields(
              { name: 'Available Tables', value: '`giveaways`, `invites`, `cases`, `all`' },
              { name: 'Usage', value: '`cleardb <table> confirm`' },
              { name: 'Example', value: '`cleardb giveaways confirm`' }
            )
        ],
        ephemeral: true
      });
    }

    const table = args[0].toLowerCase();
    const confirmation = args[1] === 'confirm';

    const validTables = ['giveaways', 'invites', 'cases', 'all'];
    if (!validTables.includes(table)) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:mc_white_cross:1411727598840451174> Invalid table. Available options: `giveaways`, `invites`, `cases`, `all`')
        ]
      });
    }

    if (!confirmation) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('⚠️ Confirmation Required')
            .setDescription(`You are about to clear the **${table}** table. This action is irreversible!`)
            .addFields(
              { name: 'To confirm', value: `Type \`cleardb ${table} confirm\`` },
              { name: 'Warning', value: 'This will permanently delete all data in the specified table.' }
            )
        ],
        ephemeral: true
      });
    }

    try {
      let result;
      let tableName;

      switch (table) {
        case 'giveaways':
          [result] = await db.pool.execute('DELETE FROM giveaways');
          tableName = 'giveaways';
          break;
        
        case 'invites':
          await db.pool.execute('DELETE FROM invites');
          await db.pool.execute('DELETE FROM member_invites');
          result = { affectedRows: 'all invite data' };
          tableName = 'invites and member_invites';
          break;
        
        case 'cases':
          [result] = await db.pool.execute('DELETE FROM cases');
          tableName = 'cases';
          break;
        
        case 'all':
          await db.pool.execute('DELETE FROM giveaways');
          await db.pool.execute('DELETE FROM invites');
          await db.pool.execute('DELETE FROM member_invites');
          await db.pool.execute('DELETE FROM cases');
          result = { affectedRows: 'all data' };
          tableName = 'all tables';
          break;
      }

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('<:mc_white_check_mark:1410629081845989386> Database Cleared')
        .setDescription(`Successfully cleared the **${tableName}** table.`)
        .addFields(
          { name: 'Action', value: `Cleared ${tableName}` },
          { name: 'Affected Rows', value: result?.affectedRows?.toString() || 'N/A' },
          { name: 'Executed by', value: `${message.author.tag} (${message.author.id})` }
        )
        .setTimestamp();

      await message.channel.send({ embeds: [embed], ephemeral: true });

    } catch (error) {
      console.error('Error clearing database:', error);
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:mc_white_cross:1411727598840451174> Failed to clear the database. Check console for details.')
        ]
      });
    }
  },
};