const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ms = require('ms');
const Giveaway = require('../../../models/Giveaway');
const GiveawayCleanup = require('../../../utils/giveawayCleanup');
const config = require('../../../config');

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
            .setDescription('<:error:1416752161638973490> You need the `Manage Messages` permission to create giveaways.')
        ]
      });
    }

    if (args.length < 2) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> Invalid syntax. Usage: `gcreate [winners] <prize> <time> [@role]`')
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
              .setDescription('<:error:1416752161638973490> Invalid role mentioned.')
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
            .setDescription('<:error:1416752161638973490> Prize is required.')
        ]
      });
    }

    if (!time) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> Time is required. Format: 1s, 5m, 3h, 2d')
        ]
      });
    }

    const duration = ms(time);
    if (!duration || duration < 1000) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> Invalid time format. Use: s (seconds), m (minutes), h (hours), d (days)')
        ]
      });
    }

    const endTime = Date.now() + duration;

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
        .setDescription(`**Prize:** ${prize}\n**Winner(s):** ${winners}\n**Ends:** <t:${Math.floor(endTime / 1000)}:R> (<t:${Math.floor(endTime / 1000)}:F>)`)
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

      const giveawayData = new Giveaway({
        messageId: giveawayMessage.id,
        channelId: message.channel.id,
        guildId: message.guild.id,
        prize,
        winners,
        endTime: new Date(endTime),
        role: role.id,
        participants: [],
        hostId: message.author.id
      });
      
      await giveawayData.save();

      const collector = giveawayMessage.createMessageComponentCollector({
        filter: i => i.customId === 'giveaway_join',
        time: duration
      });

      collector.on('collect', async i => {
        try {
          const giveaway = await Giveaway.findOne({ messageId: i.message.id });
          if (!giveaway) return;
          
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
          
          if (giveaway.participants.includes(i.user.id)) {
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
          
          giveaway.participants.push(i.user.id);
          await giveaway.save();
          
          const updatedEmbed = EmbedBuilder.from(giveawayMessage.embeds[0])
            .spliceFields(2, 1, { name: 'Participant(s)', value: giveaway.participants.length.toString(), inline: true });
          
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
        const giveaway = await Giveaway.findOne({ messageId: giveawayMessage.id });
        if (!giveaway || giveaway.ended) return;
        
        giveaway.ended = true;
        giveaway.endedAt = new Date();
        await giveaway.save();

        if (config.giveawayCleanup.enabled) {
            const cleanup = new GiveawayCleanup();
            await cleanup.scheduleDeletion(giveaway._id);
        }
        
        let winnerIds = [];
        
        if (giveaway.participants.length > 0) {
          const participants = [...giveaway.participants];
          for (let i = participants.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [participants[i], participants[j]] = [participants[j], participants[i]];
          }
          
          winnerIds = participants.slice(0, Math.min(giveaway.winners, participants.length));
        }
        
        let winnerText;
        if (winnerIds.length === 0) {
          winnerText = 'No participants. No winners selected.';
        } else {
          winnerText = winnerIds.map(id => `<@${id}>`).join(', ');
        }
        
        const finalEmbed = new EmbedBuilder()
          .setTitle('GIVEAWAY ENDED')
          .setDescription(`**Prize:** ${giveaway.prize}\n**Winner(s):** ${giveaway.winners}\n**Ended:** <t:${Math.floor(Date.now() / 1000)}:F>`)
          .addFields(
            { name: 'Hosted by', value: `<@${giveaway.hostId}>`, inline: true },
            { name: 'Participant(s)', value: giveaway.participants.length.toString(), inline: true },
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
          
          await message.channel.send({
            content: winnerIds.length > 0 ? `Congratulations ${winnerText}!` : '',
            embeds: [announcement]
          });
        } else {
          const noWinners = new EmbedBuilder()
            .setTitle('GIVEAWAY ENDED')
            .setDescription(`The **${giveaway.prize}** giveaway ended with no participants.`)
            .setColor(0xFF0000)
            .setTimestamp();
          
          await message.channel.send({ embeds: [noWinners] });
        }
      });

    } catch (error) {
      console.error('Error creating giveaway:', error);
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> Failed to create giveaway. Please try again.')
        ]
      });
    }
  },
  
  handleComponent: async (interaction) => {
    if (interaction.customId === 'giveaway_leave') {
      try {
        const giveaway = await Giveaway.findOne({ 
          channelId: interaction.channelId,
          ended: false
        });
        
        if (!giveaway) {
          return interaction.channel.send({
            content: 'This giveaway is no longer active.',
            ephemeral: true
          });
        }
        
        if (giveaway.participants.includes(interaction.user.id)) {
          giveaway.participants = giveaway.participants.filter(id => id !== interaction.user.id);
          await giveaway.save();
          
          const giveawayMessage = await interaction.channel.messages.fetch(giveaway.messageId);
          const updatedEmbed = EmbedBuilder.from(giveawayMessage.embeds[0])
            .spliceFields(2, 1, { name: 'Participant(s)', value: giveaway.participants.length.toString(), inline: true });
          
          await giveawayMessage.edit({ embeds: [updatedEmbed] });
          
          await interaction.channel.send({
            content: 'You have left the giveaway.',
            ephemeral: true
          });
        } else {
          await interaction.channel.send({
            content: 'You are not in this giveaway.',
            ephemeral: true
          });
        }
      } catch (error) {
        console.error('Error handling leave button:', error);
        await interaction.channel.send({
          content: 'There was an error processing your request.',
          ephemeral: true
        });
      }
      
      return true;
    }
    return false;
  }
};