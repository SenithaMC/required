const db = require('../../../utils/db');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'tclose',
  description: 'Close the current ticket',
  async execute(message, args) {
    try {
      const [ticket] = await db.executeWithRetry(
        'SELECT * FROM tickets WHERE channel_id = ? AND status = "open"',
        [message.channel.id]
      );

      if (!ticket) {
        return message.channel.send('❌ This is not an open ticket channel.');
      }

      await db.executeWithRetry(
        'UPDATE tickets SET status = "closed", closed_at = NOW() WHERE channel_id = ?',
        [message.channel.id]
      );

      try {
        const creator = await message.guild.members.fetch(ticket.user_id);
        const dmEmbed = new EmbedBuilder()
          .setTitle(`Ticket Closed - ${ticket.ticket_id}`)
          .setDescription(`Your ticket in ${message.guild.name} has been closed.`)
          .addFields(
            { name: 'Closed by', value: message.author.tag, inline: true },
            { name: 'Category', value: ticket.category || 'General', inline: true }
          )
          .setColor(0xFF0000)
          .setTimestamp();

        await creator.send({ embeds: [dmEmbed] });
      } catch (dmError) {
        console.log('Could not send DM to ticket creator:', dmError);
      }

      message.channel.send('✅ Ticket closed. This channel will be deleted in 5 seconds.');
      setTimeout(() => {
        message.channel.delete().catch(console.error);
      }, 5000);

    } catch (error) {
      console.error('Ticket close error:', error);
      message.channel.send('❌ Error closing ticket.');
    }
  }
};