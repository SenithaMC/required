const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('../../../utils/db');
const GiveawayCleanup = require('../../../utils/giveawayCleanup');
const config = require('../../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gend')
    .setDescription('End a giveaway immediately')
    .addStringOption(option =>
      option
        .setName('message_id')
        .setDescription('The message ID of the giveaway to end')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('winners')
        .setDescription('Number of winners to select (optional)')
        .setMinValue(1)
        .setMaxValue(50)
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ You need the `Manage Messages` permission to end giveaways.')
        ],
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const messageId = interaction.options.getString('message_id');
    const winnersCount = interaction.options.getInteger('winners');

    try {
      const [giveawayRows] = await db.pool.execute(
        'SELECT * FROM giveaways WHERE messageId = ?',
        [messageId]
      );
      
      if (giveawayRows.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription('❌ Could not find a giveaway with that message ID.')
          ]
        });
      }
      
      const giveaway = giveawayRows[0];
      
      if (giveaway.ended) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription('❌ This giveaway has already ended.')
          ]
        });
      }
      
      const finalWinnersCount = winnersCount || giveaway.winners;
      const participants = JSON.parse(giveaway.participants || '[]');
      
      const winners = [];
      const availableParticipants = [...participants];
      
      for (let i = 0; i < Math.min(finalWinnersCount, participants.length); i++) {
        const randomIndex = Math.floor(Math.random() * availableParticipants.length);
        winners.push(availableParticipants[randomIndex]);
        availableParticipants.splice(randomIndex, 1);
      }
      
      const winnerText = winners.length > 0 
        ? winners.map(winner => `<@${winner}>`).join(', ')
        : 'No participants';
      
      await db.pool.execute(
        'UPDATE giveaways SET ended = TRUE, endedAt = ? WHERE messageId = ?',
        [new Date(), messageId]
      );

      if (config.giveawayCleanup.enabled) {
        const cleanup = new GiveawayCleanup();
        await cleanup.scheduleDeletion(giveaway.id);
      }

      const endedEmbed = new EmbedBuilder()
        .setTitle('GIVEAWAY ENDED')
        .setDescription(`**Prize:** ${giveaway.prize}\n**Winner(s):** ${finalWinnersCount}\n**Ended:** <t:${Math.floor(Date.now() / 1000)}:F>`)
        .addFields(
          { name: 'Hosted by', value: `<@${giveaway.hostId}>`, inline: true },
          { name: 'Participant(s)', value: participants.length.toString(), inline: true },
          { name: 'Winner(s)', value: winnerText, inline: false },
          { name: 'Ended by', value: interaction.user.toString(), inline: true }
        )
        .setColor(0xFFA500)
        .setFooter({ text: 'Giveaway has ended' })
        .setTimestamp();

      const giveawayMessage = await interaction.channel.messages.fetch(messageId);
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
            { name: 'Ended by', value: interaction.user.toString(), inline: false }
          )
          .setColor(0x00FF00)
          .setTimestamp();
        
        await interaction.channel.send({
          content: winners.length > 0 ? `Congratulations ${winnerText}!` : '',
          embeds: [announcement]
        });
      } else {
        const noWinners = new EmbedBuilder()
          .setTitle('GIVEAWAY ENDED EARLY')
          .setDescription(`The **${giveaway.prize}** giveaway was ended early with no participants.`)
          .setColor(0xFF0000)
          .setTimestamp();
        
        await interaction.channel.send({ embeds: [noWinners] });
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00FF00)
            .setDescription('✅ Giveaway ended successfully!')
        ]
      });

    } catch (error) {
      console.error('Error ending giveaway:', error);
      if (error.code === 10008) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription('❌ Could not find a giveaway with that message ID.')
          ]
        });
      }
      
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ Failed to end giveaway. Please try again.')
        ]
      });
    }
  }
};