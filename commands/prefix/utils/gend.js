const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const Giveaway = require('../../../models/Giveaway');
const GiveawayCleanup = require('../../../utils/giveawayCleanup');
const config = require('../../../config');

module.exports = {
  name: 'gend',
  description: 'End a giveaway immediately',
  usage: 'gend <message-id> [winners]',
  aliases: ['giveawayend', 'gwend'],
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> You need the `Manage Messages` permission to end giveaways.')
        ]
      });
    }

    if (!args[0]) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> Please provide a message ID of the giveaway.')
            .addFields(
              { name: 'Usage', value: 'gend <message-id> [winners]' },
              { name: 'Example', value: 'gend 123456789012345678 3' }
            )
        ]
      });
    }

    const messageId = args[0];
    let winnersCount = 1;

    if (args[1] && !isNaN(args[1])) {
      winnersCount = parseInt(args[1]);
      if (winnersCount < 1) winnersCount = 1;
    }

    try {
      const giveaway = await Giveaway.findOne({ messageId });
      
      if (!giveaway) {
        return message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription('<:error:1416752161638973490> Could not find a giveaway with that message ID.')
          ]
        });
      }
      
      if (giveaway.ended) {
        return message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription('<:error:1416752161638973490> This giveaway has already ended.')
          ]
        });
      }
      
      const finalWinnersCount = args[1] ? winnersCount : giveaway.winners;
      
      const winners = [];
      const availableParticipants = [...giveaway.participants];
      
      for (let i = 0; i < Math.min(finalWinnersCount, giveaway.participants.length); i++) {
        const randomIndex = Math.floor(Math.random() * availableParticipants.length);
        winners.push(availableParticipants[randomIndex]);
        availableParticipants.splice(randomIndex, 1);
      }
      
      const winnerText = winners.length > 0 
        ? winners.map(winner => `<@${winner}>`).join(', ')
        : 'No participants';
      
      giveaway.ended = true;
      giveaway.endedAt = new Date();
      await giveaway.save();

      if (config.giveawayCleanup.enabled) {
      const cleanup = new GiveawayCleanup();
      await cleanup.scheduleDeletion(giveaway._id);
      }

      const endedEmbed = new EmbedBuilder()
        .setTitle('GIVEAWAY ENDED')
        .setDescription(`**Prize:** ${giveaway.prize}\n**Winner(s):** ${finalWinnersCount}\n**Ended:** <t:${Math.floor(Date.now() / 1000)}:F>`)
        .addFields(
          { name: 'Hosted by', value: `<@${giveaway.hostId}>`, inline: true },
          { name: 'Participant(s)', value: giveaway.participants.length.toString(), inline: true },
          { name: 'Winner(s)', value: winnerText, inline: false },
          { name: 'Ended by', value: message.author.toString(), inline: true }
        )
        .setColor(0xFFA500)
        .setFooter({ text: 'Giveaway has ended' })
        .setTimestamp();

      const giveawayMessage = await message.channel.messages.fetch(messageId);
      await giveawayMessage.edit({
        embeds: [endedEmbed],
        components: []
      });

      if (winners.length > 0) {
        const announcement = new EmbedBuilder()
          .setTitle('GIVEAWAY ENDED EARLY')
          .setDescription(`The giveaway for **${giveaway.prize}** has been ended early!`)
          .addFields(
            { name: 'Winner(s)', value: winnerText, inline: false },
            { name: 'Prize', value: giveaway.prize, inline: true },
            { name: 'Ended by', value: message.author.toString(), inline: false }
          )
          .setColor(0x00FF00)
          .setTimestamp();
        
        await message.channel.send({
          content: winners.length > 0 ? `Congratulations ${winnerText}!` : '',
          embeds: [announcement]
        });
      } else {
        const noWinners = new EmbedBuilder()
          .setTitle('GIVEAWAY ENDED EARLY')
          .setDescription(`The **${giveaway.prize}** giveaway was ended early with no participants.`)
          .setColor(0xFF0000)
          .setTimestamp();
        
        await message.channel.send({ embeds: [noWinners] });
      }

    } catch (error) {
      console.error('Error ending giveaway:', error);
      if (error.code === 10008) {
        return message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription('<:error:1416752161638973490> Could not find a giveaway with that message ID.')
          ]
        });
      }
      
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> Failed to end giveaway. Please try again.')
        ]
      });
    }
  },
};