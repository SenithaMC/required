const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const Giveaway = require('../../../models/Giveaway');
const GiveawayCleanup = require('../../../utils/giveawayCleanup');
const config = require('../../../config');

module.exports = {
  name: 'greroll',
  description: 'Reroll winners for a giveaway',
  usage: 'greroll <message-id> [winners]',
  aliases: ['giveawayreroll', 'gwreroll'],
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> You need the `Manage Messages` permission to reroll giveaways.')
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
              { name: 'Usage', value: 'greroll <message-id> [winners]' },
              { name: 'Example', value: 'greroll 123456789012345678 2' }
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
      
      if (!giveaway.ended) {
        return message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription('<:error:1416752161638973490> This giveaway is still running. Use `gend` to end it first.')
          ]
        });
      }
      
      if (giveaway.participants.length === 0) {
        return message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription('<:error:1416752161638973490> No participants in this giveaway to reroll.')
          ]
        });
      }

      const participants = [...giveaway.participants];
      const newWinners = [];
      const availableParticipants = [...participants];
      
      for (let i = 0; i < Math.min(winnersCount, participants.length); i++) {
        const randomIndex = Math.floor(Math.random() * availableParticipants.length);
        newWinners.push(availableParticipants[randomIndex]);
        availableParticipants.splice(randomIndex, 1);
      }
      
      const winnerText = newWinners.map(winner => `<@${winner}>`).join(', ');

      const rerollEmbed = new EmbedBuilder()
        .setTitle('GIVEAWAY REROLL')
        .setDescription(`New winners for the **${giveaway.prize}** giveaway!`)
        .addFields(
          { name: 'Prize', value: giveaway.prize, inline: true },
          { name: 'New Winner(s)', value: winnerText, inline: true },
          { name: 'Rerolled by', value: message.author.toString(), inline: false }
        )
        .setColor(0x00FF00)
        .setTimestamp();

      await message.channel.send({ embeds: [rerollEmbed] });

      try {
        const giveawayMessage = await message.channel.messages.fetch(messageId);
        const updatedEmbed = EmbedBuilder.from(giveawayMessage.embeds[0])
          .addFields(
            { name: 'Rerolled', value: `Yes (${newWinners.length} new winners)`, inline: true }
          );
        
        await giveawayMessage.edit({ embeds: [updatedEmbed] });
      } catch (error) {
        console.log('Could not update original giveaway message:', error.message);
      }

    } catch (error) {
      console.error('Error rerolling giveaway:', error);
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
            .setDescription('<:error:1416752161638973490> Failed to reroll giveaway. Please try again.')
        ]
      });
    }
  },
};