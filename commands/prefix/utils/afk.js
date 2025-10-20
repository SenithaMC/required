const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../utils/db');

const afkCooldowns = new Map();

// AFK command
const afkCommand = {
  name: 'afk',
  description: 'Set your AFK status',
  usage: 'afk [reason]',
  async execute(message, args) {
    // Check if user is on cooldown (prevent spam)
    if (afkCooldowns.has(message.author.id)) {
      const cooldown = afkCooldowns.get(message.author.id);
      if (Date.now() - cooldown < 5000) { // 5 second cooldown
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
      // Check if user already has an AFK status
      const [existingAFK] = await db.pool.execute(
        'SELECT * FROM afk WHERE userId = ? AND guildId = ?',
        [userId, guildId]
      );

      if (existingAFK.length > 0) {
        // Update existing AFK
        await db.pool.execute(
          'UPDATE afk SET reason = ?, createdAt = ? WHERE userId = ? AND guildId = ?',
          [reason, new Date(), userId, guildId]
        );
      } else {
        // Insert new AFK
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
  }
};

// AFK List command
const afkListCommand = {
  name: 'afklist',
  description: 'View all AFK users in the server',
  usage: 'afklist [page]',
  async execute(message, args) {
    const page = parseInt(args[0]) || 1;
    const guildId = message.guild.id;

    try {
      await sendAFKListPage(message, guildId, page);
    } catch (error) {
      console.error('Error displaying AFK list:', error);
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:mc_white_cross:1411727598840451174> There was an error fetching AFK users.')
        ]
      });
    }
  }
};

// AFK check function (to be called from message handler)
async function checkAFK(message) {
  if (message.author.bot) return;

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
      
      // Delete welcome back message after 10 seconds
      setTimeout(() => {
        msg.delete().catch(() => {});
      }, 10000);
    }

    // Check for mentioned users who are AFK
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
          
          // Delete AFK notification after 15 seconds
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

async function sendAFKListPage(message, guildId, page = 1) {
  const limit = 10;
  const skip = (page - 1) * limit;

  try {
    // Fixed query - no JOIN with users table
    const [afkUsers] = await db.pool.execute(
      `SELECT * FROM afk 
       WHERE guildId = ? 
       ORDER BY createdAt DESC 
       LIMIT ? OFFSET ?`,
      [guildId, limit, skip]
    );

    const [countRows] = await db.pool.execute(
      'SELECT COUNT(*) as total FROM afk WHERE guildId = ?',
      [guildId]
    );
    const totalAFK = countRows[0].total;
    const totalPages = Math.ceil(totalAFK / limit);

    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    if (afkUsers.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('AFK Users')
        .setDescription('No users are currently AFK in this server.')
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // Build AFK list using Discord.js to fetch user information
    const afkList = [];
    for (const afk of afkUsers) {
      try {
        const user = await message.client.users.fetch(afk.userId).catch(() => null);
        const userTag = user ? user.tag : `Unknown User (${afk.userId})`;
        const timeAgo = `<t:${Math.floor(new Date(afk.createdAt).getTime() / 1000)}:R>`;
        afkList.push(`• **${userTag}** - ${afk.reason}\n  ⏰ ${timeAgo}`);
      } catch (error) {
        // If user can't be fetched, use fallback
        const timeAgo = `<t:${Math.floor(new Date(afk.createdAt).getTime() / 1000)}:R>`;
        afkList.push(`• **User ID: ${afk.userId}** - ${afk.reason}\n  ⏰ ${timeAgo}`);
      }
    }

    const formattedList = afkList.join('\n\n');

    const buttons = new ActionRowBuilder();
    
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(`afklist_${guildId}_prev_${page}`)
        .setEmoji({ id: '1416754806734848071', name: 'left' })
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page <= 1)
    );
    
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(`afklist_${guildId}_next_${page}`)
        .setEmoji({ id: '1416754743383953458', name: 'right' })
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= totalPages)
    );

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`AFK Users - ${message.guild.name}`)
      .setDescription(formattedList)
      .setFooter({ text: `Page ${page} of ${totalPages} • ${totalAFK} user${totalAFK !== 1 ? 's' : ''} AFK` })
      .setTimestamp();

    await message.channel.send({ 
      embeds: [embed], 
      components: totalPages > 1 ? [buttons] : []
    });
    
  } catch (error) {
    console.error('Error fetching AFK list:', error);
    throw error;
  }
}

// Clean up cooldowns periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamp] of afkCooldowns.entries()) {
    if (now - timestamp > 300000) { // 5 minutes
      afkCooldowns.delete(userId);
    }
  }
}, 300000);

// Export both commands and the check function
module.exports = {
  commands: [afkCommand, afkListCommand],
  checkAFK
};
