// Add this to your AFK command to check if table exists
const { EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
  name: 'afk',
  description: 'Set your AFK status',
  aliases: [],
  async execute(message, args) {
    const reason = args.join(' ') || 'No reason provided';
    
    try {
      // Test if table exists first
      await db.pool.execute(`
        CREATE TABLE IF NOT EXISTS afk_status (
          userId VARCHAR(255) NOT NULL,
          guildId VARCHAR(255) NOT NULL,
          reason TEXT NOT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (userId, guildId)
        )
      `);

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
      // Send error message for debugging
      await message.channel.send(`Error: ${error.message}`).then(msg => {
        setTimeout(() => msg.delete(), 5000);
      });
    }
  }
};
