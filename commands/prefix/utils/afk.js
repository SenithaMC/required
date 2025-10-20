const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../utils/db');

const afkCooldowns = new Map();

function formatDuration(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  if (seconds > 0) parts.push(`${seconds} second${seconds > 1 ? 's' : ''}`);

  if (parts.length === 0) return 'a few moments';
  return parts.join(', ');
}

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

      // Set cooldown
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
        const afkData = afkStatus[0];
        const afkDuration = Date.now() - new Date(afkData.createdAt).getTime();
        const formattedDuration = formatDuration(afkDuration);

        await db.pool.execute(
          'DELETE FROM afk WHERE userId = ? AND guildId = ?',
          [userId, guildId]
        );

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setAuthor({ 
            name: `Hey ${message.author}, welcome back!`, 
            iconURL: message.author.displayAvatarURL({ dynamic: true }) 
          })
          .setDescription(
            `I've removed your **AFK** status.\n\n` +
            `⏰ You were AFK for **${formattedDuration}**`
          )
          .addFields(
            { name: '💬 AFK Reason', value: afkData.reason || 'No reason provided', inline: false }
          )

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
            const afkDuration = Date.now() - new Date(afkData.createdAt).getTime();
            const formattedDuration = formatDuration(afkDuration);
            
            const embed = new EmbedBuilder()
              .setColor(0xFFA500)
              .setDescription(`**${user.tag}** is currently AFK: ${afkData.reason}\n⏰ AFK for **${formattedDuration}**`);

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

setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamp] of afkCooldowns.entries()) {
    if (now - timestamp > 300000) {
      afkCooldowns.delete(userId);
    }
  }
}, 300000);
