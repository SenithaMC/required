const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('greroll')
    .setDescription('Reroll winners for a giveaway')
    .addStringOption(option =>
      option
        .setName('message_id')
        .setDescription('The message ID of the giveaway to reroll')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('winners')
        .setDescription('Number of winners to select (default: 1)')
        .setMinValue(1)
        .setMaxValue(50)
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ You need the `Manage Messages` permission to reroll giveaways.')
        ],
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const messageId = interaction.options.getString('message_id');
    const winnersCount = interaction.options.getInteger('winners') || 1;

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
      
      if (!giveaway.ended) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription('❌ This giveaway is still running. Use `/gend` to end it first.')
          ]
        });
      }
      
      const participants = JSON.parse(giveaway.participants || '[]');
      
      if (participants.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription('❌ No participants in this giveaway to reroll.')
          ]
        });
      }

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
          { name: 'Rerolled by', value: interaction.user.toString(), inline: false }
        )
        .setColor(0x00FF00)
        .setTimestamp();

      await interaction.editReply({ embeds: [rerollEmbed] });

      try {
        const giveawayMessage = await interaction.channel.messages.fetch(messageId);
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
            .setDescription('❌ Failed to reroll giveaway. Please try again.')
        ]
      });
    }
  }
};