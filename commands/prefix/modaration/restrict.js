const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const config = require('../../../config');

module.exports = {
  name: 'restrict',
  description: 'Restrict all commands for non-admin members',
  aliases: ['lockcommands', 'cmdrestrict'],
  usage: '[enable/disable] [role/channel mentions]',

  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ You need Administrator permissions to use this command.')
        ]
      });
    }

    const action = args[0]?.toLowerCase();
    const CommandRestrict = message.client.dbModels.get('CommandRestrict');

    if (!action || (action !== 'enable' && action !== 'disable' && action !== 'status')) {
      const embed = new EmbedBuilder()
        .setTitle('🔒 Command Restriction')
        .setDescription('Manage command restrictions for non-admin members')
        .addFields(
          { name: 'Usage', value: `\`${config.prefix}restrict enable\` - Enable command restriction\n\`${config.prefix}restrict disable\` - Disable command restriction\n\`${config.prefix}restrict status\` - Check current status` },
          { name: 'Exemptions', value: 'You can mention roles/channels to exempt them from the restriction' }
        )
        .setColor(0x00FFFF)
        .setFooter({ text: 'Only administrators can use commands when restricted' });

      return message.channel.send({ embeds: [embed] });
    }

    try {
      if (action === 'enable') {
        const roleMentions = message.mentions.roles.map(role => role.id);
        const channelMentions = message.mentions.channels.map(channel => channel.id);

        await CommandRestrict.findOneAndUpdate(
          { guildId: message.guild.id },
          { 
            enabled: true,
            enabledBy: message.author.id,
            enabledAt: new Date(),
            exemptRoles: roleMentions,
            exemptChannels: channelMentions
          },
          { upsert: true, new: true }
        );

        const embed = new EmbedBuilder()
          .setTitle('🔒 Command Restriction Enabled')
          .setDescription('All commands are now restricted to administrators only.')
          .addFields(
            { name: 'Enabled by', value: `${message.member}`, inline: true },
            { name: 'Status', value: '🟢 Active', inline: true }
          )
          .setColor(0xFF0000)
          .setTimestamp();

        if (roleMentions.length > 0 || channelMentions.length > 0) {
          embed.addFields({
            name: 'Exemptions',
            value: [
              roleMentions.length > 0 ? `**Roles:** ${roleMentions.map(id => `<@&${id}>`).join(', ')}` : '',
              channelMentions.length > 0 ? `**Channels:** ${channelMentions.map(id => `<#${id}>`).join(', ')}` : ''
            ].filter(text => text).join('\n')
          });
        }

        embed.setFooter({ text: `Use \`${config.prefix}\` restrict disable to turn off` });

        await message.channel.send({ embeds: [embed] });

      } else if (action === 'disable') {
        await CommandRestrict.findOneAndUpdate(
          { guildId: message.guild.id },
          { enabled: false }
        );

        const embed = new EmbedBuilder()
          .setTitle('🔓 Command Restriction Disabled')
          .setDescription('All commands are now available to all members.')
          .addFields(
            { name: 'Disabled by', value: `${message.member}`, inline: true },
            { name: 'Status', value: '🔴 Inactive', inline: true }
          )
          .setColor(0x00FF00)
          .setTimestamp();

        await message.channel.send({ embeds: [embed] });

      } else if (action === 'status') {
        const restrictData = await CommandRestrict.findOne({ guildId: message.guild.id });
        
        const embed = new EmbedBuilder()
          .setTitle('🔒 Command Restriction Status')
          .setColor(restrictData?.enabled ? 0xFF0000 : 0x00FF00)
          .addFields(
            { name: 'Status', value: restrictData?.enabled ? '🟢 Active' : '🔴 Inactive', inline: true },
            { name: 'Enabled by', value: restrictData?.enabled ? `<@${restrictData.enabledBy}>` : 'N/A', inline: true }
          )
          .setTimestamp();

        if (restrictData?.enabled && restrictData.enabledAt) {
          embed.addFields({ 
            name: 'Enabled at', 
            value: `<t:${Math.floor(restrictData.enabledAt.getTime() / 1000)}:F>`, 
            inline: true 
          });
        }

        if (restrictData?.exemptRoles?.length > 0 || restrictData?.exemptChannels?.length > 0) {
          embed.addFields({
            name: 'Exemptions',
            value: [
              restrictData.exemptRoles?.length > 0 ? `**Roles:** ${restrictData.exemptRoles.map(id => `<@&${id}>`).join(', ')}` : '',
              restrictData.exemptChannels?.length > 0 ? `**Channels:** ${restrictData.exemptChannels.map(id => `<#${id}>`).join(', ')}` : ''
            ].filter(text => text).join('\n')
          });
        }

        await message.channel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error('Restrict command error:', err);
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ An error occurred while updating command restriction settings.')
        ]
      });
    }
  }
};