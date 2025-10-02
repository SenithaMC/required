const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../../config');

module.exports = {
  name: 'purge',
  description: 'Delete multiple messages at once (max 1000).',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('<:error:1416752161638973490> Permission Denied')
        .setDescription('You need the `Manage Messages` permission to use this command.')
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed], ephemeral: true });
    }

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 1000) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('<:error:1416752161638973490> Invalid Amount')
        .setDescription('Please provide a valid number between 1 and 1000.')
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed], ephemeral: true });
    }

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_purge')
          .setLabel(`Purge ${amount} Messages`)
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancel_purge')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

    const confirmEmbed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('⚠️ Confirm Message Purge')
      .setDescription(`Are you sure you want to purge ${amount} messages? This action cannot be undone!`)
      .setTimestamp();

    const confirmMessage = await message.channel.send({ 
      embeds: [confirmEmbed], 
      components: [row],
      ephemeral: true 
    });

    const filter = i => i.user.id === message.author.id;
    const collector = confirmMessage.createMessageComponentCollector({ 
      filter, 
      time: 15000
    });

    collector.on('collect', async i => {
      if (i.customId === 'confirm_purge') {
        try {
          row.components[0].setDisabled(true);
          row.components[1].setDisabled(true);
          
          await i.update({ 
            components: [row],
            embeds: [new EmbedBuilder()
              .setColor(0xFFFF00)
              .setTitle('🔄 Purging Messages...')
              .setDescription(`Deleting ${amount} messages. Please wait.`)
              .setTimestamp()
            ]
          });

          let deletedCount = 0;
          let remaining = amount;
          
          while (remaining > 0) {
            const batchSize = Math.min(remaining, 100);
            const messages = await message.channel.messages.fetch({ limit: batchSize });
            
            const deletableMessages = messages.filter(msg => 
              Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000
            );
            
            if (deletableMessages.size === 0) break;
            
            await message.channel.bulkDelete(deletableMessages, true);
            deletedCount += deletableMessages.size;
            remaining -= deletableMessages.size;
            
            if (remaining > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          const resultEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Purge Complete')
            .setDescription(`Successfully deleted ${deletedCount} messages!`)
            .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();
          
          await i.channel.send({ 
            embeds: [resultEmbed],
            components: [] 
          });
        } catch (error) {
          console.error(error);
          const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('<:error:1416752161638973490> Error')
            .setDescription('Failed to delete messages. Some messages may be too old to bulk delete.')
            .setTimestamp();
          
          await i.channel.send({ 
            embeds: [errorEmbed],
            components: [], 
            ephemeral: true
          });
        }
      } else if (i.customId === 'cancel_purge') {
        row.components[0].setDisabled(true);
        row.components[1].setDisabled(true);
        
        const cancelEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ Operation Cancelled')
          .setDescription('Message purge has been cancelled.')
          .setTimestamp();
        
        await i.update({ 
          embeds: [cancelEmbed], 
          components: [row], 
          ephemeral: true
        });
      }
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        row.components[0].setDisabled(true);
        row.components[1].setDisabled(true);
        
        const timeoutEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('⏰ Timeout')
          .setDescription('Confirmation timed out. Please try the command again.')
          .setTimestamp();
        
        confirmMessage.edit({ 
          embeds: [timeoutEmbed], 
          components: [row], 
          ephemeral: true
        });
      }
    });
  }
};
