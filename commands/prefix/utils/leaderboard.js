const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const MemberInvites = require('../../../models/MemberInvites');
const { aliases } = require('./invitecodes');

const activeLeaderboards = new Map();

module.exports = {
  name: 'leaderboard',
  aliases: ['lb', 'top'],
  description: 'Show the invite leaderboard',
  usage: 'leaderboard [page]',
  async execute(message, args) {
    const page = parseInt(args[0]) || 1;

    try {
      await sendLeaderboard(message, page);
    } catch (error) {
      console.error('Error displaying leaderboard:', error);
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> There was an error fetching the leaderboard.')
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
    else if (action === 'refresh') {/* Keep same page */}
    else return false;
    
    if (!activeLeaderboards.has(interaction.message.id)) {
      return interaction.channel.send({
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

async function sendLeaderboard(messageOrInteraction, page = 1, isInteraction = false) {
  const guild = isInteraction ? messageOrInteraction.guild : messageOrInteraction.guild;
  const limit = 10;
  const skip = (page - 1) * limit;

  try {
    const leaderboard = await MemberInvites.find({ guildId: guild.id })
      .sort({ validInvites: -1 })
      .skip(skip)
      .limit(limit);

    const totalCount = await MemberInvites.countDocuments({ guildId: guild.id });
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
        return messageOrInteraction.editchannel.send({ embeds: [embed], components: [] });
      } else {
        return messageOrInteraction.channel.send({ embeds: [embed] });
      }
    }

    let leaderboardText = '';
    for (let i = 0; i < leaderboard.length; i++) {
      try {
        const user = await guild.client.users.fetch(leaderboard[i].memberId);
        const rank = i + 1 + skip;
        
        let rankEmoji = '';
        if (rank === 1) rankEmoji = '🥇 ';
        else if (rank === 2) rankEmoji = '🥈 ';
        else if (rank === 3) rankEmoji = '🥉 ';
        else rankEmoji = `**${rank}.** `;
        
        leaderboardText += `${rankEmoji}${user.tag} - **${leaderboard[i].validInvites}** invites\n`;
        leaderboardText += `   📊 ${leaderboard[i].validInvites} valid • ${leaderboard[i].fakeInvites} fake • ${leaderboard[i].leaveInvites} left\n`;
      } catch {
        leaderboardText += `**${i + 1 + skip}.** Unknown User - **${leaderboard[i].validInvites}** invites\n`;
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
      msg = await messageOrInteraction.editchannel.send({ 
        embeds: [embed], 
        components: [buttons] 
      });
    } else {
      msg = await messageOrInteraction.channel.send({ 
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