const db = require('../../../utils/db');

module.exports = {
  name: 'tremove',
  description: 'Remove a user from the ticket',
  async execute(message, args) {
    if (args.length === 0) {
      return message.channel.send('❌ Please mention a user or provide their ID.');
    }

    const userId = args[0].replace(/[<@!>]/g, '');
    
    const [ticket] = await db.executeWithRetry(
      'SELECT * FROM tickets WHERE channel_id = ?',
      [message.channel.id]
    );

    if (!ticket) {
      return message.channel.send('❌ This is not a ticket channel.');
    }

    if (userId === ticket.user_id) {
      return message.channel.send('❌ Cannot remove the ticket creator.');
    }

    const member = await message.guild.members.fetch(userId).catch(() => null);

    if (!member) {
      return message.channel.send('❌ User not found.');
    }

    try {
      await message.channel.permissionOverwrites.delete(member);
      message.channel.send(`✅ Removed ${member.user.tag} from the ticket.`);
    } catch (error) {
      console.error('Ticket remove error:', error);
      message.channel.send('❌ Error removing user from ticket.');
    }
  }
};