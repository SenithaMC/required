const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const Case = require('../../../models/Case');

const resetConfirmations = new Map();

module.exports = {
  name: 'creset',
  aliases: ['cases-reset'],
  description: 'Reset all cases for a user',
  usage: 'cases-reset <@user>',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> You need the `Manage Messages` permission to reset cases.')
        ]
      });
    }

    const targetUser = message.mentions.users.first();
    if (!targetUser) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> Please mention a user to reset cases for.')
            .addFields({ name: 'Usage', value: this.usage })
        ]
      });
    }

    // Check if the target user exists in the guild
    const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> That user is not in this server.')
        ]
      });
    }

    // Get the count of cases for this user
    const caseCount = await Case.countDocuments({ 
      guildId: message.guild.id, 
      userId: targetUser.id 
    });

    if (caseCount === 0) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFA500)
            .setDescription(`No cases found for ${targetUser.tag}.`)
        ]
      });
    }

    // Create confirmation buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`cases_reset_confirm_${targetUser.id}`)
          .setLabel('Confirm Reset')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cases_reset_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

    const confirmEmbed = new EmbedBuilder()
      .setTitle('⚠️ Confirm Cases Reset')
      .setDescription(`You are about to reset **${caseCount}** cases for ${targetUser.tag}.`)
      .addFields(
        { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
        { name: 'Cases to delete', value: caseCount.toString(), inline: true },
        { name: 'Warning', value: 'This action cannot be undone! All case history for this user will be permanently deleted.' }
      )
      .setColor(0xFFA500)
      .setFooter({ text: 'You have 60 seconds to confirm' });

    const confirmMessage = await message.channel.send({ 
      embeds: [confirmEmbed], 
      components: [row] 
    });

    resetConfirmations.set(confirmMessage.id, {
      targetUserId: targetUser.id,
      targetUserTag: targetUser.tag,
      caseCount,
      authorId: message.author.id,
      guildId: message.guild.id,
      expires: Date.now() + 60000
    });

    setTimeout(() => {
      if (resetConfirmations.has(confirmMessage.id)) {
        resetConfirmations.delete(confirmMessage.id);
        confirmMessage.edit({ 
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription('<:error:1416752161638973490> Cases reset confirmation timed out.')
          ],
          components: [] 
        }).catch(() => {});
      }
    }, 60000);
  },

  handleComponent: async (interaction) => {
    if (!interaction.customId.startsWith('cases_reset_')) return false;
    
    const actionData = resetConfirmations.get(interaction.message.id);
    if (!actionData) {
      return interaction.reply({
        content: 'This confirmation has expired or is invalid.',
        ephemeral: true
      });
    }

    if (interaction.user.id !== actionData.authorId) {
      return interaction.reply({
        content: 'Only the user who initiated this action can confirm it.',
        ephemeral: true
      });
    }

    if (interaction.customId === 'cases_reset_cancel') {
      resetConfirmations.delete(interaction.message.id);
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> Cases reset cancelled.')
        ],
        components: []
      });
      return true;
    }

    if (interaction.customId.startsWith('cases_reset_confirm_')) {
      await interaction.deferUpdate();
      
      try {
        // Delete all cases for the user
        const result = await Case.deleteMany({ 
          guildId: actionData.guildId, 
          userId: actionData.targetUserId 
        });

        const resultEmbed = new EmbedBuilder()
          .setTitle('✅ Cases Reset Complete')
          .setDescription(`Successfully reset ${result.deletedCount} cases for ${actionData.targetUserTag}.`)
          .setColor(0x00FF00)
          .setTimestamp();
        
        await interaction.editReply({ 
          embeds: [resultEmbed],
          components: [] 
        });
        
        resetConfirmations.delete(interaction.message.id);
        return true;
      } catch (error) {
        console.error('Error resetting cases:', error);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setDescription('<:error:1416752161638973490> There was an error resetting the cases.')
          ],
          components: []
        });
        resetConfirmations.delete(interaction.message.id);
        return true;
      }
    }
    
    return false;
  }
};

// Clean up expired confirmations periodically
setInterval(() => {
  const now = Date.now();
  for (const [messageId, data] of resetConfirmations.entries()) {
    if (now > data.expires) {
      resetConfirmations.delete(messageId);
    }
  }
}, 60000);