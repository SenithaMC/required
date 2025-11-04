const { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../utils/db');
const config = require('../../../config');

module.exports = {
  name: 'prest',
  description: 'Reset server prefix to default',
  usage: 'prest',
  aliases: ['prefixreset', 'resetprefix', 'defaultprefix'],
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Permission Denied')
        .setDescription('You need **Administrator** permissions to reset the server prefix.')
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed] });
    }

    const currentPrefix = await db.getGuildPrefix(message.guild.id);
    const isDefault = currentPrefix === config.prefix;

    if (isDefault) {
      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('ℹ️ Prefix Already Default')
        .setDescription(`The server prefix is already set to the default: \`${config.prefix}\``)
        .addFields(
          { name: 'Current Prefix', value: `\`${currentPrefix}\``, inline: true },
          { name: 'Default Prefix', value: `\`${config.prefix}\``, inline: true },
          { name: 'Change Prefix', value: `Use \`${config.prefix}pset <prefix>\` to set a custom prefix`, inline: false }
        )
        .setTimestamp()
        .setFooter({ 
          text: `${message.client.user.username} • Prefix Management`,
          iconURL: message.client.user.displayAvatarURL()
        });

      return message.channel.send({ embeds: [embed] });
    }

    // Create confirmation embed
    const confirmEmbed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('🔄 Reset Prefix Confirmation')
      .setDescription(`Are you sure you want to reset the server prefix to default?`)
      .addFields(
        { name: 'Current Prefix', value: `\`${currentPrefix}\``, inline: true },
        { name: 'New Prefix', value: `\`${config.prefix}\``, inline: true },
        { name: 'Effect', value: `All commands will use \`${config.prefix}\` instead of \`${currentPrefix}\``, inline: false }
      )
      .setTimestamp()
      .setFooter({ 
        text: `This action cannot be undone • ${message.client.user.username}`,
        iconURL: message.client.user.displayAvatarURL()
      });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_reset')
          .setLabel('Yes, Reset Prefix')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId('cancel_reset')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❌')
      );

    const confirmationMessage = await message.channel.send({ 
      embeds: [confirmEmbed], 
      components: [row] 
    });

    const collector = confirmationMessage.createMessageComponentCollector({
      time: 30000,
      filter: (interaction) => interaction.user.id === message.author.id
    });

    collector.on('collect', async (interaction) => {
      if (interaction.customId === 'confirm_reset') {
        try {
          // Reset prefix in database
          await db.setGuildPrefix(message.guild.id, config.prefix);
          
          // Update cache if exists
          if (message.client.prefixCache) {
            message.client.prefixCache.set(message.guild.id, config.prefix);
          }

          const successEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Prefix Reset Successfully')
            .setDescription(`Server prefix has been reset to default.`)
            .addFields(
              { name: 'New Prefix', value: `\`${config.prefix}\``, inline: true },
              { name: 'Usage Example', value: `\`${config.prefix}help\``, inline: true },
              { name: 'Change Again', value: `Use \`${config.prefix}pset <prefix>\` to set a custom prefix`, inline: false }
            )
            .setTimestamp()
            .setFooter({ 
              text: `${message.client.user.username} • Prefix Management`,
              iconURL: message.client.user.displayAvatarURL()
            });

          await interaction.update({ 
            embeds: [successEmbed], 
            components: [] 
          });

          // Log the action
          console.log(`Prefix reset by ${message.author.tag} in ${message.guild.name}: ${currentPrefix} -> ${config.prefix}`);

        } catch (error) {
          console.error('Prefix reset error:', error);
          
          const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Reset Failed')
            .setDescription('An error occurred while resetting the prefix. Please try again.')
            .setTimestamp();

          await interaction.update({ 
            embeds: [errorEmbed], 
            components: [] 
          });
        }

      } else if (interaction.customId === 'cancel_reset') {
        const cancelEmbed = new EmbedBuilder()
          .setColor(0xFFFF00)
          .setTitle('🚫 Reset Cancelled')
          .setDescription('Prefix reset has been cancelled.')
          .addFields(
            { name: 'Current Prefix', value: `\`${currentPrefix}\``, inline: true },
            { name: 'Default Prefix', value: `\`${config.prefix}\``, inline: true }
          )
          .setTimestamp();

        await interaction.update({ 
          embeds: [cancelEmbed], 
          components: [] 
        });
      }
    });

    collector.on('end', (collected) => {
      if (collected.size === 0) {
        const timeoutEmbed = new EmbedBuilder()
          .setColor(0x666666)
          .setTitle('⏰ Timeout')
          .setDescription('Prefix reset confirmation timed out. Please try again if you still want to reset.')
          .setTimestamp();

        confirmationMessage.edit({ 
          embeds: [timeoutEmbed], 
          components: [] 
        }).catch(() => {});
      }
    });
  }
};
