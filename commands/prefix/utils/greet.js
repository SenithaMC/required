const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const config = require('../../../config');

module.exports = {
  name: 'greet',
  description: 'Set a channel for automatic welcome messages when users join the server',
  async execute(message, args) {
    const client = message.client;
    const prefix = config.prefix;
    
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('<:error:1416752161638973490> Permission Denied')
        .setDescription('You need the `Manage Channels` permission to use this command.')
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed], ephemeral: true });
    }

    // Initialize if doesn't exist
    if (!client.greetConfigs) {
      client.greetConfigs = new Map();
    }

    // Show current configuration if no args
    if (!args[0]) {
      const currentConfig = client.greetConfigs.get(message.guild.id);
      
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('⚙️ Greet Settings')
        .setDescription('Configure automatic welcome messages for new members.')
        .addFields(
          { 
            name: 'Current Configuration', 
            value: currentConfig 
              ? `**Channel:** <#${currentConfig.channelId}>\n**Message:** ${currentConfig.message}\n**Delete After:** ${currentConfig.deleteAfter}s`
              : 'Not set' 
          },
          { 
            name: 'Usage', 
            value: `\`${prefix}greet #<channel> <welcome-message> <message-timeout>\``
          },
          { 
            name: 'Example', 
            value: `\`${prefix}greet #channel Welcome message here 30\`\n- Set welcome channel, message and delete timer\n\`${prefix}greet disable\` - Disable welcome messages`
          },
          {
            name: 'Placeholders',
            value: 'Use `{user}` to ping the user, `{server}` for server name, `{memberCount}` for total members'
          }
        )
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed] });
    }

    // Handle disable
    if (args[0].toLowerCase() === 'disable') {
      const wasEnabled = client.greetConfigs.has(message.guild.id);
      client.greetConfigs.delete(message.guild.id);
      
      const embed = new EmbedBuilder()
        .setColor(wasEnabled ? 0x00FF00 : 0xFFA500)
        .setTitle(wasEnabled ? '✅ Greet Disabled' : 'ℹ️ Greet Already Disabled')
        .setDescription(wasEnabled 
          ? 'Welcome messages have been disabled for this server.' 
          : 'Welcome messages were already disabled.'
        )
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed] });
    }

    // Parse arguments
    const channel = message.mentions.channels.first();
    if (!channel) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('<:error:1416752161638973490> Channel Not Found')
        .setDescription('Please mention a valid text channel as the first argument.')
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed], ephemeral: true });
    }

    if (channel.type !== 0) { // 0 = Text Channel
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('<:error:1416752161638973490> Invalid Channel Type')
        .setDescription('Please select a text channel.')
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed], ephemeral: true });
    }

    // Remove the channel mention from args and get the remaining parts
    const remainingArgs = args.slice(1);
    if (remainingArgs.length < 2) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('<:error:1416752161638973490> Invalid Usage')
        .setDescription('Please provide both a welcome message and delete time.\nUsage: `greet #channel Welcome message here 30`')
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed], ephemeral: true });
    }

    // The last argument should be the time
    const timeArg = remainingArgs[remainingArgs.length - 1];
    const deleteAfter = parseInt(timeArg);
    
    if (isNaN(deleteAfter) || deleteAfter < 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('<:error:1416752161638973490> Invalid Time')
        .setDescription('Please provide a valid positive number for the delete time (in seconds).')
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed], ephemeral: true });
    }

    // The message is everything between channel and time
    let welcomeMessage = remainingArgs.slice(0, -1).join(' ');
    
    // Check if message contains {user} placeholder, if not, add it at the beginning
    if (!welcomeMessage.includes('{user}')) {
      welcomeMessage = `{user} ${welcomeMessage}`;
    }

    // Check if bot has permission to send messages and manage messages (for deletion)
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
        .setTitle('<:error:1416752161638973490> Missing Permissions')
        .setDescription(`I need the following permissions in ${channel}: ${permNames}`)
        .setTimestamp();
      
      return message.channel.send({ embeds: [embed], ephemeral: true });
    }

    // Save the configuration
    client.greetConfigs.set(message.guild.id, {
      channelId: channel.id,
      message: welcomeMessage,
      deleteAfter: deleteAfter
    });

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
    
    // Debug log
    console.log(`Greet config set for guild ${message.guild.id}:`, {
      channel: channel.id,
      message: welcomeMessage,
      deleteAfter: deleteAfter
    });
  }
};