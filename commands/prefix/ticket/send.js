const { 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
  name: 'tsend',
  description: 'Send the ticket panel with categories dropdown to a channel',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.channel.send('❌ You need administrator permissions to send ticket panels.');
    }

    let channel = message.channel;
    
    if (args.length > 0) {
      const channelId = args[0].replace(/[<#>]/g, '');
      const targetChannel = message.guild.channels.cache.get(channelId);
      if (!targetChannel) {
        return message.channel.send('❌ Channel not found.');
      }
      channel = targetChannel;
    }

    try {
      const categories = await db.executeWithRetry(
        'SELECT * FROM ticket_categories WHERE guild_id = ?',
        [message.guild.id]
      );

      if (categories.length === 0) {
        return message.channel.send('❌ No ticket categories set up. Use `b!tsetup` first.');
      }

      const embed = new EmbedBuilder()
        .setTitle('Support Tickets')
        .setDescription('Select a category below to create a support ticket!')
        .setColor(0x00AE86)
        .setFooter({ text: 'Our team will assist you shortly' });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('create_ticket_category')
        .setPlaceholder('Select a ticket category')
        .addOptions(
          categories.map(cat => ({
            label: cat.name,
            value: cat.id.toString(),
            description: cat.description?.substring(0, 50) || 'Create a ticket',
            emoji: cat.emoji || '🎫'
          }))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const panelMessage = await channel.send({ 
        embeds: [embed], 
        components: [row] 
      });

      await db.executeWithRetry(
        'UPDATE ticket_panels SET panel_channel = ?, panel_message = ? WHERE guild_id = ?',
        [channel.id, panelMessage.id, message.guild.id]
      );
      
    } catch (error) {
      console.error('Ticket send error:', error);
      message.channel.send('❌ Error sending ticket panel.');
    }
  }
};