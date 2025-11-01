const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
  name: 'tsend',
  description: 'Send the ticket panel to a channel',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.channel.send('❌ You need administrator permissions to send ticket panels.');
    }

    if (args.length === 0) {
      return message.channel.send('❌ Please provide a channel mention or ID.');
    }

    const channelId = args[0].replace(/[<#>]/g, '');
    const channel = message.guild.channels.cache.get(channelId);

    if (!channel) {
      return message.channel.send('❌ Channel not found.');
    }

    try {
      const embed = new EmbedBuilder()
        .setTitle('Support Tickets')
        .setDescription('Click the button below to create a support ticket!')
        .setColor(0x00AE86)
        .setFooter({ text: 'Our team will assist you shortly' });

      const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('Create Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎫')
      );

      const panelMessage = await channel.send({ 
        embeds: [embed], 
        components: [button] 
      });

      // Save panel info to database
      await db.executeWithRetry(
        'UPDATE ticket_panels SET panel_channel = ?, panel_message = ? WHERE guild_id = ?',
        [channel.id, panelMessage.id, message.guild.id]
      );

      message.channel.send('✅ Ticket panel sent successfully!');
    } catch (error) {
      console.error('Ticket send error:', error);
      message.channel.send('❌ Error sending ticket panel.');
    }
  }
};