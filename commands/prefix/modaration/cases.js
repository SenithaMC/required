const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Case = require('../../../models/Case');

const activeCases = new Map();

module.exports = {
  name: 'cases',
  description: 'View all cases for a user',
  usage: 'cases [@user]',
  async execute(message, args) {
    const targetUser = message.mentions.users.first() || message.author;
    const page = parseInt(args[1]) || 1;

    try {
      await sendCasesPage(message, targetUser, page);
    } catch (error) {
      console.error('Error displaying cases:', error);
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> There was an error fetching cases.')
        ]
      });
    }
  },

  handleComponent: async (interaction) => {
    if (!interaction.customId.startsWith('cases_')) return false;
    
    const [_, userId, action, currentPage] = interaction.customId.split('_');
    let page = parseInt(currentPage);
    
    if (action === 'next') page++;
    else if (action === 'prev') page--;
    else return false;
    
    if (!activeCases.has(interaction.message.id)) {
      return interaction.channel.send({
        content: 'This cases view has expired. Use the command again to view the latest data.',
        ephemeral: true
      });
    }
    
    try {
      await interaction.deferUpdate();
      await sendCasesPage(interaction, userId, page, true);
    } catch (error) {
      console.error('Error updating cases:', error);
      await interaction.followUp({
        content: 'There was an error updating the cases view.',
        ephemeral: true
      });
    }
    
    return true;
  }
};

async function sendCasesPage(messageOrInteraction, targetUserOrId, page = 1, isInteraction = false) {
  const targetUser = typeof targetUserOrId === 'string' 
    ? await messageOrInteraction.client.users.fetch(targetUserOrId).catch(() => null)
    : targetUserOrId;
  
  const guild = isInteraction ? messageOrInteraction.guild : messageOrInteraction.guild;
  const limit = 5;
  const skip = (page - 1) * limit;

  if (!targetUser) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription('<:error:1416752161638973490> User not found.');
    
    if (isInteraction) {
      return messageOrInteraction.editchannel.send({ embeds: [embed], components: [] });
    } else {
      return messageOrInteraction.channel.send({ embeds: [embed] });
    }
  }

  try {
    const cases = await Case.find({ 
      guildId: guild.id, 
      userId: targetUser.id 
    }).sort({ caseId: -1 }).skip(skip).limit(limit);

    const totalCases = await Case.countDocuments({ 
      guildId: guild.id, 
      userId: targetUser.id 
    });
    const totalPages = Math.ceil(totalCases / limit);

    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    
    const last24hCount = await Case.countDocuments({ 
      guildId: guild.id, 
      userId: targetUser.id,
      createdAt: { $gte: oneDayAgo }
    });
    
    const last7dCount = await Case.countDocuments({ 
      guildId: guild.id, 
      userId: targetUser.id,
      createdAt: { $gte: sevenDaysAgo }
    });

    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    if (cases.length === 0) {
      const embed = new EmbedBuilder()
        .setAuthor({ name: 'Case History', iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
        .setColor(0xFFA500)
        .setDescription('No cases found for this user.')
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));

      if (isInteraction) {
        return messageOrInteraction.editchannel.send({ embeds: [embed], components: [] });
      } else {
        return messageOrInteraction.channel.send({ embeds: [embed] });
      }
    }

    const casesContent = cases.map(c => {
      const date = `<t:${Math.floor(c.createdAt.getTime() / 1000)}:F>`;
      return `• ${date} \`${c.type}\` #${c.caseId} — ${c.reason}`;
    }).join('\n');

    const buttons = new ActionRowBuilder();
    
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(`cases_${targetUser.id}_prev_${page}`)
        .setEmoji({ id:'1416754806734848071', name: 'left' })
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page <= 1)
    );
    
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(`cases_${targetUser.id}_next_${page}`)
        .setEmoji({ id: '1416754743383953458', name: 'right'})
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= totalPages)
    );

    const embed = new EmbedBuilder()
      .setAuthor({ name: `Case History for ${targetUser.tag}`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
      .setDescription(casesContent)
      .setColor(0x0099FF)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Last 24 hours', value: `${last24hCount} infraction${last24hCount !== 1 ? 's' : ''}`, inline: true },
        { name: 'Last 7 days', value: `${last7dCount} infraction${last7dCount !== 1 ? 's' : ''}`, inline: true },
        { name: 'Total', value: `${totalCases} infraction${totalCases !== 1 ? 's' : ''}`, inline: true }
      )
      .setFooter({ text: `Page ${page} of ${totalPages} • Query: ${targetUser.tag}` })
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
    
    activeCases.set(msg.id, Date.now());
    
    setTimeout(() => {
      activeCases.delete(msg.id);
    }, 10 * 60 * 1000);
    
  } catch (error) {
    console.error('Error fetching cases:', error);
    throw error;
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [messageId, timestamp] of activeCases.entries()) {
    if (now - timestamp > 10 * 60 * 1000) {
      activeCases.delete(messageId);
    }
  }
}, 60 * 60 * 1000);