const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
  name: 'afklist',
  description: 'View all AFK users in the server',
  usage: 'afklist [page]',
  async execute(message, args) {
    const page = parseInt(args[0]) || 1;
    const guildId = message.guild.id;

    try {
      const limit = 10;
      const skip = (page - 1) * limit;

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

      const afkList = [];
      for (const afk of afkUsers) {
        try {
          const user = await message.client.users.fetch(afk.userId).catch(() => null);
          const userTag = user ? user.tag : `Unknown User (${afk.userId})`;
          const timeAgo = `<t:${Math.floor(new Date(afk.createdAt).getTime() / 1000)}:R>`;
          afkList.push(`• **${userTag}** - ${afk.reason}\n  ⏰ ${timeAgo}`);
        } catch (error) {
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
