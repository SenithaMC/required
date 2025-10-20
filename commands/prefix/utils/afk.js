const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../utils/db');

const afkCooldowns = new Map();

module.exports = {
  name: 'afk',
  description: 'Set your AFK status',
  usage: 'afk [reason]',
  async execute(message, args) {
    if (afkCooldowns.has(message.author.id)) {
      const cooldown = afkCooldowns.get(message.author.id);
      if (Date.now() - cooldown < 5000) {
        return message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription('<:mc_white_cross:1411727598840451174> Please wait a few seconds before setting AFK again.')
          ]
        });
      }
    }

    const reason = args.join(' ') || 'No reason provided';
    const userId = message.author.id;
    const guildId = message.guild.id;

    try {
      const [existingAFK] = await db.pool.execute(
        'SELECT * FROM afk WHERE userId = ? AND guildId = ?',
        [userId, guildId]
      );

      if (existingAFK.length > 0) {
        await db.pool.execute(
          'UPDATE afk SET reason = ?, createdAt = ? WHERE userId = ? AND guildId = ?',
          [reason, new Date(), userId, guildId]
        );
      } else {
        await db.pool.execute(
          'INSERT INTO afk (userId, guildId, reason, createdAt) VALUES (?, ?, ?, ?)',
          [userId, guildId, reason, new Date()]
        );
      }

      afkCooldowns.set(message.author.id, Date.now());

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setDescription(`<:mc_green_tick:1240005330024079491> You are now AFK: **${reason}**`)
        .setFooter({ text: 'You will be automatically removed from AFK when you send a message' });

      await message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('Error setting AFK status:', error);
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:mc_white_cross:1411727598840451174> There was an error setting your AFK status.')
        ]
      });
    }
  },

  checkAFK: async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const guildId = message.guild.id;

    try {
      const [afkStatus] = await db.pool.execute(
        'SELECT * FROM afk WHERE userId = ? AND guildId = ?',
        [userId, guildId]
      );

      if (afkStatus.length > 0) {
        // Remove AFK status
        await db.pool.execute(
          'DELETE FROM afk WHERE userId = ? AND guildId = ?',
          [userId, guildId]
        );

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setDescription(`<:mc_green_tick:1240005330024079491> Welcome back ${message.author}! I've removed your AFK status.`)
          .setFooter({ text: `You were AFK: ${afkStatus[0].reason}` });

        const msg = await message.channel.send({ embeds: [embed] });
        
        setTimeout(() => {
          msg.delete().catch(() => {});
        }, 10000);
      }

      if (message.mentions.users.size > 0) {
        for (const [id, user] of message.mentions.users) {
          if (user.bot) continue;

          const [mentionedAFK] = await db.pool.execute(
            'SELECT * FROM afk WHERE userId = ? AND guildId = ?',
            [id, guildId]
          );

          if (mentionedAFK.length > 0) {
            const afkData = mentionedAFK[0];
            
            const embed = new EmbedBuilder()
              .setColor(0xFFA500)
              .setDescription(`**${user.tag}** is currently AFK: ${afkData.reason}\n⏰ AFK for <t:${Math.floor(new Date(afkData.createdAt).getTime() / 1000)}:R>`);

            const msg = await message.channel.send({ embeds: [embed] });
            
            setTimeout(() => {
              msg.delete().catch(() => {});
            }, 15000);
          }
        }
      }
    } catch (error) {
      console.error('Error checking AFK status:', error);
    }
  }
};
