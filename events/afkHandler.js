const { Events, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    try {
      const [afkRows] = await db.pool.execute(
        'SELECT * FROM afk_status WHERE userId = ? AND guildId = ?',
        [message.author.id, message.guild.id]
      );
      
      if (afkRows.length > 0) {
        await db.pool.execute(
          'DELETE FROM afk_status WHERE userId = ? AND guildId = ?',
          [message.author.id, message.guild.id]
        );
        
        // Stealth welcome back message
        const welcomeMsg = await message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x00FF00)
              .setDescription(`Welcome back, ${message.author}!`)
          ]
        });
        
        setTimeout(async () => {
          if (welcomeMsg.deletable) await welcomeMsg.delete().catch(() => {});
        }, 3000);
      }

      // Check mentions for AFK users
      if (message.mentions.users.size > 0) {
        for (const [id, user] of message.mentions.users) {
          const [afkRows] = await db.pool.execute(
            'SELECT * FROM afk_status WHERE userId = ? AND guildId = ?',
            [id, message.guild.id]
          );
          
          if (afkRows.length > 0) {
            const afk = afkRows[0];
            const timeAgo = Math.floor((Date.now() - new Date(afk.createdAt).getTime()) / 1000);
            
            const afkMsg = await message.channel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor(0xFFFF00)
                  .setDescription(`${user.tag} is AFK: ${afk.reason} (${Math.floor(timeAgo / 60)}m ago)`)
              ]
            });
            
            setTimeout(async () => {
              if (afkMsg.deletable) await afkMsg.delete().catch(() => {});
            }, 5000);
          }
        }
      }
    } catch (error) {
    }
  },
};
