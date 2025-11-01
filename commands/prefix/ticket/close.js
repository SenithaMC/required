const db = require('../../../utils/db');

module.exports = {
  name: 'tclose',
  description: 'Close the current ticket',
  async execute(message, args) {
    try {
      // Check if this is a ticket channel
      const [ticket] = await db.executeWithRetry(
        'SELECT * FROM tickets WHERE channel_id = ? AND status = "open"',
        [message.channel.id]
      );

      if (!ticket) {
        return message.channel.send('❌ This is not an open ticket channel.');
      }

      // Update ticket status
      await db.executeWithRetry(
        'UPDATE tickets SET status = "closed", closed_at = NOW() WHERE channel_id = ?',
        [message.channel.id]
      );

      // Delete channel after short delay
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