const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const Giveaway = require('../../../models/Giveaway');
const Invite = require('../../../models/Invite');
const MemberInvites = require('../../../models/MemberInvites');
const config = require('../../../config');

module.exports = {
  name: 'cleardb',
  description: 'Clear database collections (Restricted to bot owner)',
  usage: 'cleardb <collection> [confirm]',
  async execute(message, args) {
    const authorizedUserId = '1240540042926096406';
    if (message.author.id !== authorizedUserId) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> This command is restricted to the bot owner.')
        ]
      });
    }

    if (!args[0]) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('Database Clearance')
            .setDescription('Please specify a collection to clear.')
            .addFields(
              { name: 'Available Collections', value: '`giveaways`, `invites`, `all`' },
              { name: 'Usage', value: '`cleardb <collection> confirm`' },
              { name: 'Example', value: '`cleardb giveaways confirm`' }
            )
        ],
        ephemeral: true
      });
    }

    const collection = args[0].toLowerCase();
    const confirmation = args[1] === 'confirm';

    const validCollections = ['giveaways', 'invites', 'all'];
    if (!validCollections.includes(collection)) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> Invalid collection. Available options: `giveaways`, `invites`, `all`')
        ]
      });
    }

    if (!confirmation) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('⚠️ Confirmation Required')
            .setDescription(`You are about to clear the **${collection}** collection. This action is irreversible!`)
            .addFields(
              { name: 'To confirm', value: `Type \`cleardb ${collection} confirm\`` },
              { name: 'Warning', value: 'This will permanently delete all data in the specified collection.' }
            )
        ],
        ephemeral: true
      });
    }

    try {
      let result;
      let collectionName;

      switch (collection) {
        case 'giveaways':
          result = await Giveaway.deleteMany({});
          collectionName = 'giveaways';
          break;
        
        case 'invites':
          await Invite.deleteMany({});
          await MemberInvites.deleteMany({});
          result = { deletedCount: 'all invite data' };
          collectionName = 'invites and member invites';
          break;
        
        case 'all':
          await Giveaway.deleteMany({});
          await Invite.deleteMany({});
          await MemberInvites.deleteMany({});
          result = { deletedCount: 'all data' };
          collectionName = 'all collections';
          break;
      }

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Database Cleared')
        .setDescription(`Successfully cleared the **${collectionName}** collection.`)
        .addFields(
          { name: 'Action', value: `Cleared ${collectionName}` },
          { name: 'Deleted Documents', value: result?.deletedCount?.toString() || 'N/A' },
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
            .setDescription('<:error:1416752161638973490> Failed to clear the database. Check console for details.')
        ]
      });
    }
  },
};