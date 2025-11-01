    module.exports = {
  name: 'tadd',
  description: 'Add a user to the ticket',
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
      await message.channel.permissionOverwrites.create(member, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });

      message.channel.send(`✅ Added ${member.user.tag} to the ticket.`);
    } catch (error) {
      console.error('Ticket add error:', error);
      message.channel.send('❌ Error adding user to ticket.');
    }
  }
};
