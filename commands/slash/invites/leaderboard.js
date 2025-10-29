const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../utils/db');

const activeLeaderboards = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the invite leaderboard')
    .addIntegerOption(option =>
      option
        .setName('page')
        .setDescription('Page number to view')
        .setMinValue(1)
        .setRequired(false)
    ),

  async execute(interaction) {
    const page = interaction.options.getInteger('page') || 1;

    await interaction.deferReply();

    try {
      await sendLeaderboard(interaction, page, true);
    } catch (error) {
      console.error('Error displaying leaderboard:', error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ There was an error fetching the leaderboard.')
        ]
      });
    }
  },

  handleComponent: async (interaction) => {
    if (!interaction.customId.startsWith('leaderboard_')) return false;
    
    const [_, guildId, action, currentPage] = interaction.customId.split('_');
    let page = parseInt(currentPage);
    
    if (action === 'next') page++;
    else if (action === 'prev') page--;
    else if (action === 'refresh') {}
    else return false;
    
    if (!activeLeaderboards.has(interaction.message.id)) {
      return interaction.reply({
        content: 'This leaderboard has expired. Use the command again to view the latest data.',
        ephemeral: true
      });
    }
    
    try {
      await interaction.deferUpdate();
      await sendLeaderboard(interaction, page, true);
    } catch (error) {
      console.error('Error updating leaderboard:', error);
      await interaction.followUp({
        content: 'There was an error updating the leaderboard.',
        ephemeral: true
      });
    }
    
    return true;
  }
};

async function sendLeaderboard(interaction, page = 1, isInteraction = false) {
  const guild = interaction.guild;
  const limit = 10;
  const skip = (page - 1) * limit;

  try {
    const [countRows] = await db.pool.execute(
      'SELECT COUNT(*) as total FROM member_invites WHERE guildId = ?',
      [guild.id]
    );
    const totalCount = countRows[0].total;

    const [leaderboard] = await db.pool.execute(
      'SELECT * FROM member_invites WHERE guildId = ? ORDER BY validInvites DESC LIMIT ? OFFSET ?',
      [guild.id, limit, skip]
    );

    const totalPages = Math.ceil(totalCount / limit);

    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    if (leaderboard.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('Invite Leaderboard')
        .setColor(0xFFA500)
        .setDescription('No invite data available yet.\nStart inviting people to appear on the leaderboard!')
        .setThumbnail(guild.iconURL({ dynamic: true }));

      if (isInteraction) {
        return interaction.editReply({ embeds: [embed], components: [] });
      } else {
        return interaction.channel.send({ embeds: [embed] });
      }
    }

    let leaderboardText = '';
    for (let i = 0; i < leaderboard.length; i++) {
      try {
        const data = leaderboard[i];
        const user = await guild.client.users.fetch(data.memberId);
        const rank = i + 1 + skip;
        
        let rankEmoji = '';
        if (rank === 1) rankEmoji = '🥇 ';
        else if (rank === 2) rankEmoji = '🥈 ';
        else if (rank === 3) rankEmoji = '🥉 ';
        else rankEmoji = `**${rank}.** `;
        
        leaderboardText += `${rankEmoji}${user.tag} **${data.validInvites} invites.** (${data.validInvites} regular, ${data.leaveInvites} left, ${data.fakeInvites} fake)\n`;
      } catch {
        const data = leaderboard[i];
        const rank = i + 1 + skip;
        leaderboardText += `**${rank}.** Unknown User - **${data.validInvites} invites.** (${data.validInvites} regular, ${data.leaveInvites} left, ${data.fakeInvites} fake)\n`;
      }
    }

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`leaderboard_${guild.id}_prev_${page}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page <= 1)
          .setEmoji({ id:'1416754806734848071', name: 'left' })
      )
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`leaderboard_${guild.id}_refresh_${page}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji({ id: '1416756316428308610' , name: 'refresh' })
      )
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`leaderboard_${guild.id}_next_${page}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page >= totalPages)
          .setEmoji({ id: '1416754743383953458', name: 'right'})
      );

    const embed = new EmbedBuilder()
      .setTitle('🏆 Invite Leaderboard')
      .setDescription(leaderboardText)
      .setColor(0x00FF00)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .setFooter({ 
        text: `Page ${page} of ${totalPages} • Total members: ${totalCount}`,
        iconURL: guild.client.user.displayAvatarURL()
      })
      .setTimestamp();

    let msg;
    if (isInteraction) {
      msg = await interaction.editReply({ 
        embeds: [embed], 
        components: [buttons] 
      });
    } else {
      msg = await interaction.channel.send({ 
        embeds: [embed], 
        components: [buttons] 
      });
    }
    
    activeLeaderboards.set(msg.id, Date.now());
    
    setTimeout(() => {
      activeLeaderboards.delete(msg.id);
    }, 10 * 60 * 1000);
    
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    throw error;
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [messageId, timestamp] of activeLeaderboards.entries()) {
    if (now - timestamp > 10 * 60 * 1000) {
      activeLeaderboards.delete(messageId);
    }
  }
}, 60 * 60 * 1000);