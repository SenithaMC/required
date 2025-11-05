const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
  name: 'greet',
  description: 'Set a channel for welcome messages when users join the server',
  async execute(message, args) {
    const client = message.client;
    
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Permission Denied')
        .setDescription('You need the `Manage Channels` permission to use this command.')
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed], ephemeral: true });
    }

    if (!args[0]) {
      let currentConfig;
      try {
        const rows = await db.executeWithRetry(
          'SELECT * FROM greet_configs WHERE guildId = ?',
          [message.guild.id]
        );
        currentConfig = rows[0];
      } catch (error) {
        console.error('Error fetching greet config:', error);
      }
      
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('⚙️ Greet Settings')
        .setDescription('Configure automatic welcome messages for new members.')
        .addFields(
          { 
            name: 'Current Configuration', 
            value: currentConfig 
              ? `**Channel:** <#${currentConfig.channelId}>\n**Message:** ${currentConfig.message}\n**Delete After:** ${currentConfig.deleteAfter}s\n**Enabled:** ${currentConfig.enabled ? 'Yes' : 'No'}`
              : 'Not set' 
          },
          { 
            name: 'Usage', 
            value: `\`greet #<channel> <welcome-message> <message-timeout>\``
          },
          { 
            name: 'Example', 
            value: `\`greet #channel Welcome message here 30\`\n- Set welcome channel, message and delete timer\n\`greet disable\` - Disable welcome messages`
          },
          {
            name: 'Placeholders',
            value: 'Use `{user}` to ping the user, `{server}` for server name, `{memberCount}` for total members'
          }
        )
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed] });
    }

    if (args[0].toLowerCase() === 'disable') {
      try {
        await db.executeWithRetry(
          'UPDATE greet_configs SET enabled = FALSE WHERE guildId = ?',
          [message.guild.id]
        );
        
        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ Greet Disabled')
          .setDescription('Welcome messages have been disabled for this server.')
          .setTimestamp();
        
        return message.channel.send({ embeds: [embed] });
      } catch (error) {
        console.error('Error disabling greet:', error);
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Error')
          .setDescription('Failed to disable greet configuration.')
          .setTimestamp();
        
        return message.channel.send({ embeds: [embed], ephemeral: true });
      }
    }

    const channel = message.mentions.channels.first();
    if (!channel) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Channel Not Found')
        .setDescription('Please mention a valid text channel as the first argument.')
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed], ephemeral: true });
    }

    if (channel.type !== 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Invalid Channel Type')
        .setDescription('Please select a text channel.')
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed], ephemeral: true });
    }

    const remainingArgs = args.slice(1);
    if (remainingArgs.length < 2) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Invalid Usage')
        .setDescription('Please provide both a welcome message and delete time.\nUsage: `greet #channel Welcome message here 30`')
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed], ephemeral: true });
    }

    const timeArg = remainingArgs[remainingArgs.length - 1];
    const deleteAfter = parseInt(timeArg);
    
    if (isNaN(deleteAfter) || deleteAfter < 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Invalid Time')
        .setDescription('Please provide a valid positive number for the delete time (in seconds).')
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed], ephemeral: true });
    }

    let welcomeMessage = remainingArgs.slice(0, -1).join(' ');
    
    if (!welcomeMessage.includes('{user}')) {
      welcomeMessage = `{user} ${welcomeMessage}`;
    }

    const botPermissions = channel.permissionsFor(message.guild.members.me);
    const requiredPerms = [PermissionsBitField.Flags.SendMessages];
    if (deleteAfter > 0) {
      requiredPerms.push(PermissionsBitField.Flags.ManageMessages);
    }

    const missingPerms = requiredPerms.filter(perm => !botPermissions.has(perm));
    if (missingPerms.length > 0) {
      const permNames = missingPerms.map(perm => {
        switch(perm) {
          case PermissionsBitField.Flags.SendMessages: return 'Send Messages';
          case PermissionsBitField.Flags.ManageMessages: return 'Manage Messages';
          default: return 'Unknown Permission';
        }
      }).join(', ');

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Missing Permissions')
        .setDescription(`I need the following permissions in ${channel}: ${permNames}`)
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed], ephemeral: true });
    }

    try {
      await db.executeWithRetry(
        `INSERT INTO greet_configs (guildId, channelId, message, deleteAfter, enabled) 
         VALUES (?, ?, ?, ?, TRUE) 
         ON DUPLICATE KEY UPDATE 
         channelId = ?, message = ?, deleteAfter = ?, enabled = TRUE`,
        [message.guild.id, channel.id, welcomeMessage, deleteAfter, channel.id, welcomeMessage, deleteAfter]
      );

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Greet Configuration Set')
        .setDescription(`Welcome messages have been configured for ${channel}`)
        .addFields(
          { name: 'Welcome Message', value: welcomeMessage.replace(/{user}/g, '@user') },
          { name: 'Delete After', value: `\`${deleteAfter} seconds\`` },
          { name: 'Disable', value: 'Use `greet disable` to turn off welcome messages.' },
        )
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });
      
      console.log(`Greet config set for guild ${message.guild.id}:`, {
        channel: channel.id,
        message: welcomeMessage,
        deleteAfter: deleteAfter
      });
    } catch (error) {
      console.error('Error saving greet configuration:', error);
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Database Error')
        .setDescription('Failed to save greet configuration to database.')
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed], ephemeral: true });
    }
  }
};
