const { EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
  name: 'afk',
  description: 'Set your AFK status',
  aliases: [],
  async execute(message, args) {
    const reason = args.join(' ') || 'No reason provided';
    
    try {
      await db.pool.execute(
        'INSERT INTO afk_status (userId, guildId, reason, createdAt) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE reason = ?, createdAt = ?',
        [message.author.id, message.guild.id, reason, new Date(), reason, new Date()]
      );

      const afkMsg = await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00FF00)
            .setDescription(`<:mc_white_checkmark:1411727594261114880> AFK set: ${reason}`)
        ]
      });
      
      setTimeout(async () => {
        try {
          if (message.deletable) await message.delete().catch(() => {});
          if (afkMsg.deletable) await afkMsg.delete().catch(() => {});
        } catch (error) {
        }
      }, 2000);

    } catch (error) {
      console.error('Error setting AFK:', error);
    }
  }
};
