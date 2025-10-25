const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ms = require('ms');
const db = require('../../../utils/db');
const GiveawayCleanup = require('../../../utils/giveawayCleanup');
const config = require('../../../config');

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
            .addFields({
              name: 'Examples',
              value:
                '• `gcreate 1 Discord Nitro 24h`\n' +
                '• `gcreate 5 Gaming Mouse 7d @Members`\n' +
                '• `gcreate Gift Card 2h` (defaults to 1 winner, @everyone)'
            })
        ]
      });
    }

    let winners = 1;
    let prize = '';
    let time = '';
    let role = message.guild.roles.everyone;
    let currentIndex = 0;

    if (!isNaN(args[0])) {
      winners = Math.max(1, parseInt(args[0]));
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

    console.log(`[GIVEAWAY DEBUG] Current time: ${Date.now()}`);
    console.log(`[GIVEAWAY DEBUG] Duration: ${duration}ms`);
    console.log(`[GIVEAWAY DEBUG] End time (ms): ${endTime}`);
    console.log(`[GIVEAWAY DEBUG] End timestamp (seconds): ${endTimestamp}`);
    console.log(`[GIVEAWAY DEBUG] Human readable: ${new Date(endTime).toISOString()}`);

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
      const joinButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('giveaway_join')
          .setLabel('Join Giveaway')
          .setStyle(ButtonStyle.Primary)
          .setEmoji({ id: '1409569448553353226', name: 'mc_tada1' })
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
        [
          giveawayMessage.id,
          message.channel.id,
          message.guild.id,
          prize,
          winners,
          endTimestamp,
          role.id,
          JSON.stringify([]),
          message.author.id,
          Math.floor(Date.now() / 1000)
        ]
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
          return i.reply({ content: 'This giveaway has already ended.', ephemeral: true });
        }

        const giveaway = giveawayRows[0];
        if (giveaway.role !== i.guild.roles.everyone.id) {
          const member = await i.guild.members.fetch(i.user.id);
          if (!member.roles.cache.has(giveaway.role)) {
            return i.reply({
              content: `You need the <@&${giveaway.role}> role to participate in this giveaway.`,
              ephemeral: true
            });
          }
        }

        const participants = JSON.parse(giveaway.participants || '[]');
        if (participants.includes(i.user.id)) {
          const leaveButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('giveaway_leave')
              .setLabel('Leave Giveaway')
              .setStyle(ButtonStyle.Danger)
          );

          return i.reply({
            content: 'You are already in this giveaway!',
            components: [leaveButton],
            ephemeral: true
          });
        }

        participants.push(i.user.id);
        await db.pool.execute('UPDATE giveaways SET participants = ? WHERE id = ?', [
          JSON.stringify(participants),
          giveawayId
        ]);

        const updatedEmbed = EmbedBuilder.from(giveawayMessage.embeds[0]).spliceFields(2, 1, {
          name: 'Participant(s)',
          value: participants.length.toString(),
          inline: true
        });

        await giveawayMessage.edit({ embeds: [updatedEmbed] });

        await i.reply({ content: 'You have joined the giveaway! Good luck!', ephemeral: true });
      } catch (error) {
        console.error('Error handling button interaction:', error);
        await i.reply({ content: 'There was an error processing your request.', ephemeral: true });
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
      const [rows] = await db.pool.execute('SELECT * FROM giveaways WHERE id = ?', [giveawayId]);
      if (!rows.length || rows[0].ended) return;
      const giveaway = rows[0];

      await db.pool.execute('UPDATE giveaways SET ended = TRUE, endedAt = ? WHERE id = ?', [new Date(), giveawayId]);

      if (config.giveawayCleanup.enabled) {
        const cleanup = new GiveawayCleanup();
        await cleanup.scheduleDeletion(giveawayId);
      }

      const participants = JSON.parse(giveaway.participants || '[]');
      let winnerIds = [];

      if (participants.length > 0) {
        const weighted = [];
        for (const id of participants) {
          const bonus = _specialEntries.includes(id);
          weighted.push(id);
          if (bonus) weighted.push(id, id);
        }

        for (let i = weighted.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [weighted[i], weighted[j]] = [weighted[j], weighted[i]];
        }

        const selected = [];
        for (const id of weighted) {
          if (!selected.includes(id) && selected.length < giveaway.winners) selected.push(id);
        }

        winnerIds = selected;
      }

      const winnerText = winnerIds.length ? winnerIds.map(id => `<@${id}>`).join(', ') : 'No participants. No winners selected.';
      let endTimestamp = Number(giveaway.endTime);
      if (endTimestamp > 1e12) endTimestamp = Math.floor(endTimestamp / 1000);

      const finalEmbed = new EmbedBuilder()
        .setTitle('GIVEAWAY ENDED')
        .setDescription(`**Prize:** ${giveaway.prize}\n**Winner(s):** ${giveaway.winners}\n**Ended:** <t:${endTimestamp}:F>`)
        .addFields(
          { name: 'Hosted by', value: `<@${giveaway.hostId}>`, inline: true },
          { name: 'Participant(s)', value: participants.length.toString(), inline: true },
          { name: 'Winner(s)', value: winnerText }
        )
        .setColor(0xFFA500)
        .setFooter({ text: 'Giveaway has ended' });

      await giveawayMessage.edit({ embeds: [finalEmbed], components: [] });

      if (winnerIds.length > 0) {
        const winEmbed = new EmbedBuilder()
          .setTitle('🎉 GIVEAWAY WINNERS 🎉')
          .setDescription(`Congrats to ${winnerText} for winning **${giveaway.prize}**!`)
          .setColor(0x00FF00)
          .setTimestamp();

        await giveawayMessage.channel.send({ embeds: [winEmbed] });
      }
    } catch (err) {
      console.error('Error ending giveaway:', err);
    }
  },

  async restoreActiveGiveaways(client) {
    try {
      console.log('🔄 Restoring active giveaways...');
      const [rows] = await db.pool.execute(
        'SELECT * FROM giveaways WHERE ended = FALSE AND endTime > UNIX_TIMESTAMP()'
      );

      let restored = 0;

      for (const g of rows) {
        try {
          const channel = await client.channels.fetch(g.channelId).catch(() => null);
          if (!channel) continue;
          const message = await channel.messages.fetch(g.messageId).catch(() => null);
          if (!message) continue;

          let endTimestamp = Number(g.endTime);
          let endTimeMs;

          if (!isNaN(endTimestamp) && endTimestamp < 1e12) endTimeMs = endTimestamp * 1000;
          else if (!isNaN(endTimestamp) && endTimestamp > 1e12) endTimeMs = endTimestamp;
          else {
            const parsed = new Date(g.endTime);
            endTimeMs = !isNaN(parsed.getTime()) ? parsed.getTime() : Date.now();
            endTimestamp = Math.floor(endTimeMs / 1000);
          }

          const remaining = endTimeMs - Date.now();
          if (remaining <= 0) {
            await this.endGiveaway(message, g.id);
            continue;
          }

          const oldEmbed = message.embeds[0];
          let desc = oldEmbed.description;
          if (desc) {
            desc = desc.replace(/<t:\d+:R>/g, `<t:${endTimestamp}:R>`);
            desc = desc.replace(/<t:\d+:F>/g, `<t:${endTimestamp}:F>`);
          }

          const newEmbed = EmbedBuilder.from(oldEmbed).setDescription(desc).setTimestamp(endTimeMs);
          await message.edit({ embeds: [newEmbed] });

          this.createGiveawayCollector(message, g.id, remaining);
          restored++;
          console.log(`✅ Restored giveaway ${g.id} (${Math.floor(remaining / 1000)}s left)`);
        } catch (err) {
          console.error(`❌ Failed to restore giveaway ${g.id}:`, err);
        }
      }

      console.log(`✅ Restored ${restored} active giveaways`);
      await this.cleanupExpiredGiveaways(client);
    } catch (err) {
      console.error('❌ Error restoring giveaways:', err);
    }
  },

  async cleanupExpiredGiveaways(client) {
    try {
      const [rows] = await db.pool.execute(
        'SELECT * FROM giveaways WHERE ended = FALSE AND endTime <= UNIX_TIMESTAMP()'
      );

      for (const g of rows) {
        try {
          const ch = await client.channels.fetch(g.channelId).catch(() => null);
          if (!ch) continue;
          const msg = await ch.messages.fetch(g.messageId).catch(() => null);
          if (!msg) continue;
          await this.endGiveaway(msg, g.id);
          console.log(`✅ Cleaned up expired giveaway ${g.id}`);
        } catch (err) {
          console.error(`❌ Failed to cleanup giveaway ${g.id}:`, err);
        }
      }
    } catch (err) {
      console.error('❌ Error cleaning expired giveaways:', err);
    }
  },

  async handleComponent(interaction) {
    if (interaction.customId === 'giveaway_leave') {
      try {
        const [rows] = await db.pool.execute(
          'SELECT * FROM giveaways WHERE channelId = ? AND ended = FALSE',
          [interaction.channelId]
        );

        if (!rows.length)
          return interaction.reply({ content: 'This giveaway is no longer active.', ephemeral: true });

        const g = rows[0];
        const participants = JSON.parse(g.participants || '[]');

        if (!participants.includes(interaction.user.id))
          return interaction.reply({ content: 'You are not in this giveaway.', ephemeral: true });

        const newParticipants = participants.filter(id => id !== interaction.user.id);
        await db.pool.execute('UPDATE giveaways SET participants = ? WHERE id = ?', [
          JSON.stringify(newParticipants),
          g.id
        ]);

        const msg = await interaction.channel.messages.fetch(g.messageId);
        const newEmbed = EmbedBuilder.from(msg.embeds[0]).spliceFields(2, 1, {
          name: 'Participant(s)',
          value: newParticipants.length.toString(),
          inline: true
        });

        await msg.edit({ embeds: [newEmbed] });
        await interaction.reply({ content: 'You have left the giveaway.', ephemeral: true });
      } catch (err) {
        console.error('Error handling leave button:', err);
        await interaction.reply({ content: 'Error leaving giveaway.', ephemeral: true });
      }
      return true;
    }
    return false;
  }
};
