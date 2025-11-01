module.exports = {
  name: 'trename',
  description: 'Rename the current ticket',
  async execute(message, args) {
    if (args.length === 0) {
      return message.channel.send('❌ Please provide a new name for the ticket.');
    }

    const newName = args.join('-').toLowerCase();
    
    try {
      await message.channel.setName(`ticket-${newName}`);
      message.channel.send(`✅ Ticket renamed to: ticket-${newName}`);
    } catch (error) {
      console.error('Ticket rename error:', error);
      message.channel.send('❌ Error renaming ticket. Check my permissions.');
    }
  }
};