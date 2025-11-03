const { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../utils/db');
const config = require('../../../config');

module.exports = {
  name: 'pset',
  description: 'Set server prefix',
  usage: 'pset <prefix>',
  aliases: ['prefix', 'setprefix'],
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.channel.send('❌ You need administrator permissions to change the prefix.');
    }

    if (args.length === 0) {
      return await showCurrentPrefix(message);
    }

    const newPrefix = args[0];
    
    // Validate prefix
    if (newPrefix.length > 5) {
      return message.channel.send('❌ Prefix must be 5 characters or less.');
    }

    if (newPrefix.length < 1) {
      return message.channel.send('❌ Prefix cannot be empty.');
    }

    // Check if it's the same as current prefix
    const currentPrefix = await db.getGuildPrefix(message.guild.id);
    if (newPrefix === currentPrefix) {
      return message.channel.send(`❌ The prefix is already set to \`${newPrefix}\`.`);
    }

    try {
      await db.setGuildPrefix(message.guild.id, newPrefix);
      
      // Update cache
      if (message.client.prefixCache) {
        message.client.prefixCache.set(message.guild.id, newPrefix);
      }
      
      const embed = new EmbedBuilder()
        .setTitle('✅ Prefix Updated')
        .setDescription(`Server prefix has been updated successfully.`)
        .addFields(
          { name: 'New Prefix', value: `\`${newPrefix}\``, inline: true },
          { name: 'Default Prefix', value: `\`${config.prefix}\``, inline: true },
          { name: 'Usage', value: `Both prefixes will work: \`${newPrefix}help\` and \`${config.prefix}help\``, inline: false }
        )
        .setColor(0x00AE86)
        .setTimestamp()
        .setFooter({ 
          text: `${message.client.user.username} • Prefix Settings`,
          iconURL: message.client.user.displayAvatarURL()
        });

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('test_prefix')
            .setLabel('Test Prefix')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🧪'),
          new ButtonBuilder()
            .setCustomId('reset_prefix')
            .setLabel('Reset to Default')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔄')
        );

      const reply = await message.channel.send({ 
        embeds: [embed], 
        components: [row] 
      });

      // Set up button collector
      const collector = reply.createMessageComponentCollector({
        time: 30000
      });

      collector.on('collect', async (interaction) => {
        if (interaction.customId === 'test_prefix') {
          await interaction.reply({
            content: `✅ Prefix test:\n• Custom prefix: \`${newPrefix}help\`\n• Default prefix: \`${config.prefix}help\`\nBoth should work!`,
            flags: 64
          });
        } else if (interaction.customId === 'reset_prefix') {
          await db.setGuildPrefix(message.guild.id, config.prefix);
          if (message.client.prefixCache) {
            message.client.prefixCache.set(message.guild.id, config.prefix);
          }
          
          await interaction.reply({
            content: `✅ Prefix reset to default: \`${config.prefix}\``,
            flags: 64
          });
          
          // Disable buttons after reset
          await reply.edit({ components: [] });
        }
      });

      collector.on('end', () => {
        reply.edit({ components: [] }).catch(() => {});
      });

    } catch (error) {
      console.error('Prefix set error:', error);
      message.channel.send('❌ Error updating prefix. Please try again.');
    }
  },

  async handleComponent(interaction) {
    if (interaction.customId === 'test_prefix' || interaction.customId === 'reset_prefix') {
      return true;
    }
    return false;
  }
};

async function showCurrentPrefix(message) {
  const currentPrefix = await db.getGuildPrefix(message.guild.id);
  const isDefault = currentPrefix === config.prefix;

  const embed = new EmbedBuilder()
    .setTitle('⚙️ Prefix Settings')
    .setDescription(`Current prefix for this server: \`${currentPrefix}\``)
    .addFields(
      { name: 'Current Prefix', value: `\`${currentPrefix}\``, inline: true },
      { name: 'Default Prefix', value: `\`${config.prefix}\``, inline: true },
      { name: 'Status', value: isDefault ? 'Using default prefix' : 'Using custom prefix', inline: true },
      { name: 'Usage', value: `\`${currentPrefix}help\` - Shows help menu\n\`${config.prefix}help\` - Also works (default)`, inline: false }
    )
    .setColor(0x00AE86)
    .setFooter({ 
      text: `Use "${currentPrefix}pset <prefix>" to change the prefix`,
      iconURL: message.client.user.displayAvatarURL()
    })
    .setTimestamp();

  if (!isDefault) {
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('reset_prefix_current')
          .setLabel('Reset to Default')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔄')
      );

    const reply = await message.channel.send({ 
      embeds: [embed], 
      components: [row] 
    });

    const collector = reply.createMessageComponentCollector({
      time: 30000
    });

    collector.on('collect', async (interaction) => {
      if (interaction.customId === 'reset_prefix_current') {
        await db.setGuildPrefix(message.guild.id, config.prefix);
        if (message.client.prefixCache) {
          message.client.prefixCache.set(message.guild.id, config.prefix);
        }
        
        await interaction.reply({
          content: `✅ Prefix reset to default: \`${config.prefix}\``,
          flags: 64
        });
        
        await reply.edit({ components: [] });
      }
    });

    collector.on('end', () => {
      reply.edit({ components: [] }).catch(() => {});
    });
  } else {
    await message.channel.send({ embeds: [embed] });
  }
}
