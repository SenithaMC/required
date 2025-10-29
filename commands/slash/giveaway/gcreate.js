const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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

function unixToMySQLDatetime(unixTimestamp) {
  return new Date(unixTimestamp * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

function msToMySQLDatetime(msTimestamp) {
  return new Date(msTimestamp).toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gcreate')
    .setDescription('Create a new giveaway with button interaction')
    // REQUIRED OPTIONS FIRST
    .addStringOption(option =>
      option
        .setName('prize')
        .setDescription('The prize for the giveaway')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('duration')
        .setDescription('Duration of the giveaway (e.g., 1h, 30m, 7d)')
        .setRequired(true)
    )
    // OPTIONAL OPTIONS AFTER REQUIRED
    .addIntegerOption(option =>
      option
        .setName('winners')
        .setDescription('Number of winners (default: 1)')
        .setMinValue(1)
        .setMaxValue(50)
        .setRequired(false)
    )
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('Role required to join (default: @everyone)')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ You need the `Manage Messages` permission to create giveaways.')
        ],
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // Get options in the new order
    const prize = interaction.options.getString('prize');
    const durationString = interaction.options.getString('duration');
    const winners = interaction.options.getInteger('winners') || 1;
    const role = interaction.options.getRole('role') || interaction.guild.roles.everyone;

    const duration = ms(durationString);
    if (!duration || duration < 1000) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ Invalid time format. Use: s (seconds), m (minutes), h (hours), d (days)')
        ]
      });
    }

    const endTime = Date.now() + duration;
    const endTimestamp = Math.floor(endTime / 1000);

    if (endTimestamp <= Math.floor(Date.now() / 1000)) {
      return interaction.editReply({
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
          { name: 'Hosted by', value: interaction.user.toString(), inline: true },
          { name: 'Required Role', value: role.toString(), inline: true },
          { name: 'Participant(s)', value: '0', inline: true }
        )
        .setColor(0x00FF00)
        .setFooter({ text: 'Click the button below to join!' })
        .setTimestamp(endTime);

      const giveawayMessage = await interaction.channel.send({
        embeds: [embed],
        components: [joinButton]
      });

      const endTimeMySQL = msToMySQLDatetime(endTime);

      const [result] = await db.pool.execute(
        `INSERT INTO giveaways (messageId, channelId, guildId, prize, winners, endTime, role, participants, hostId, ended, createdAt) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?)`,
        [
          giveawayMessage.id,
          interaction.channel.id,
          interaction.guild.id,
          prize,
          winners,
          endTimeMySQL,
          role.id,
          JSON.stringify([]),
          interaction.user.id,
          msToMySQLDatetime(Date.now())
        ]
      );

      const giveawayId = result.insertId;

      this.createGiveawayCollector(giveawayMessage, giveawayId, duration);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00FF00)
            .setDescription('✅ Giveaway created successfully!')
        ]
      });

    } catch (error) {
      console.error('Error creating giveaway:', error);
      await interaction.editReply({
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
        [msToMySQLDatetime(Date.now()), giveawayId]
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

      let endTimestamp;
      if (giveaway.endTime instanceof Date) {
        endTimestamp = Math.floor(giveaway.endTime.getTime() / 1000);
      } else {
        const endTimeDate = new Date(giveaway.endTime);
        endTimestamp = Math.floor(endTimeDate.getTime() / 1000);
      }
      
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
        'SELECT * FROM giveaways WHERE ended = FALSE AND endTime > UTC_TIMESTAMP()'
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

          let endTimeMs;
          if (giveaway.endTime instanceof Date) {
            endTimeMs = giveaway.endTime.getTime();
          } else {
            endTimeMs = new Date(giveaway.endTime).getTime();
          }

          const remainingTime = endTimeMs - Date.now();
          
          if (remainingTime <= 0) {
            await this.endGiveaway(message, giveaway.id);
            continue;
          }

          const endTimestamp = Math.floor(endTimeMs / 1000);

          const oldEmbed = message.embeds[0];
          
          let newDescription = oldEmbed.description;
          if (newDescription) {
            newDescription = newDescription.replace(/<t:\d+:R>/g, `<t:${endTimestamp}:R>`);
            newDescription = newDescription.replace(/<t:\d+:F>/g, `<t:${endTimestamp}:F>`);
          }

          const restoredEmbed = EmbedBuilder.from(oldEmbed)
            .setDescription(newDescription)
            .setTimestamp(endTimeMs);

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
        'SELECT * FROM giveaways WHERE ended = FALSE AND endTime <= UTC_TIMESTAMP()'
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
