module.exports = {
  name: 'tremove',
  description: 'Remove a user from the ticket',
  async execute(message, args) {
    if (args.length === 0) {
      return message.channel.send('❌ Please mention a user or provide their ID.');
    }

    const userId = args[0].replace(/[<@!>]/g, '');
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