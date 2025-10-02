const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  name: 'nuke',
  description: 'Delete all messages in the channel by recreating it.',
  async execute(message) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('<:error:1416752161638973490> Permission Denied')
        .setDescription('You need the `Manage Channels` permission to use this command.')
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed], ephemeral: true });
    }

    // Create confirmation buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_nuke')
          .setLabel('Confirm Nuke')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancel_nuke')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

    // Create confirmation embed
    const confirmEmbed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('⚠️ Confirm Channel Nuke')
      .setDescription('Are you sure you want to nuke this channel? This action cannot be undone!')
      .setTimestamp();

    // Send confirmation message with buttons
    const confirmMessage = await message.channel.send({ 
      embeds: [confirmEmbed], 
      components: [row],
      ephemeral: true 
    });

    // Create a collector to handle button interactions
    const filter = i => i.user.id === message.author.id;
    const collector = confirmMessage.createMessageComponentCollector({ 
      filter, 
      time: 15000 // 15 seconds to respond
    });

    collector.on('collect', async i => {
      if (i.customId === 'confirm_nuke') {
        try {
          // Disable buttons after confirmation
          row.components[0].setDisabled(true);
          row.components[1].setDisabled(true);
          
          await i.update({ 
            components: [row],
            embeds: [new EmbedBuilder()
              .setColor(0xFFFF00)
              .setTitle('🔄 Nuking Channel...')
              .setDescription('Please wait while the channel is being nuked.')
              .setTimestamp()
            ]
          });

          // Perform the nuke
          const position = message.channel.position;
          const newChannel = await message.channel.clone();
          await message.channel.delete();
          await newChannel.setPosition(position);
          
          // Send success message in the new channel
          const successEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('💣 Channel Nuked')
            .setDescription('This channel has been successfully nuked!')
            .setFooter({ text: `Nuked by ${message.author.tag}` })
            .setTimestamp();
          
          await newChannel.send({ embeds: [successEmbed] });
        } catch (error) {
          console.error(error);
          const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('<:error:1416752161638973490> Error')
            .setDescription('Failed to nuke the channel. Please try again.')
            .setTimestamp();
          
          await i.followUp({ embeds: [errorEmbed], ephemeral: true });
        }
      } else if (i.customId === 'cancel_nuke') {
        // Disable buttons after cancellation
        row.components[0].setDisabled(true);
        row.components[1].setDisabled(true);
        
        const cancelEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ Operation Cancelled')
          .setDescription('Channel nuke has been cancelled.')
          .setTimestamp();
        
        await i.update({ 
          embeds: [cancelEmbed], 
          components: [row] 
        });
      }
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        // Disable buttons when time runs out
        row.components[0].setDisabled(true);
        row.components[1].setDisabled(true);
        
        const timeoutEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('⏰ Timeout')
          .setDescription('Confirmation timed out. Please try the command again.')
          .setTimestamp();
        
        confirmMessage.edit({ 
          embeds: [timeoutEmbed], 
          components: [row] 
        });
      }
    });
  }
};