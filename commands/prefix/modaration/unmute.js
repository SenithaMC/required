const { PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'unmute',
  description: 'Unmute a user in the server',
  aliases: ['unsilence'],
  usage: '<@user> [reason]',
  
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return message.channel.send({
        embeds: [
          {
            color: 0xFF0000,
            description: '❌ You need the **Manage Roles** permission to use this command.'
          }
        ]
      }).then(msg => {
        setTimeout(async () => {
          try {
            if (msg.deletable) await msg.delete().catch(() => {});
          } catch (error) {
          }
        }, 5000);
      });
    }

    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.channel.send({
        embeds: [
          {
            color: 0xFF0000,
            description: '❌ I need the **Moderate Members** permission to unmute users.'
          }
        ]
      }).then(msg => {
        setTimeout(async () => {
          try {
            if (msg.deletable) await msg.delete().catch(() => {});
          } catch (error) {
          }
        }, 5000);
      });
    }

    const target = message.mentions.members.first() || 
                   message.guild.members.cache.get(args[0]);
    
    if (!target) {
      return message.channel.send({
        embeds: [
          {
            color: 0xFF0000,
            description: '❌ Please mention a valid user to unmute.\n**Usage:** `;unmute @user [reason]`\n**Example:** `;unmute @user Apology accepted`'
          }
        ]
      }).then(msg => {
        setTimeout(async () => {
          try {
            if (msg.deletable) await msg.delete().catch(() => {});
          } catch (error) {
          }
        }, 5000);
      });
    }

    if (target.id === message.author.id) {
      return message.channel.send({
        embeds: [
          {
            color: 0xFF0000,
            description: '❌ You cannot unmute yourself.'
          }
        ]
      }).then(msg => {
        setTimeout(async () => {
          try {
            if (msg.deletable) await msg.delete().catch(() => {});
          } catch (error) {
          }
        }, 5000);
      });
    }

    if (target.id === message.client.user.id) {
      return message.channel.send({
        embeds: [
          {
            color: 0xFF0000,
            description: '❌ I cannot unmute myself.'
          }
        ]
      }).then(msg => {
        setTimeout(async () => {
          try {
            if (msg.deletable) await msg.delete().catch(() => {});
          } catch (error) {
          }
        }, 5000);
      });
    }

    if (!target.isCommunicationDisabled()) {
      return message.channel.send({
        embeds: [
          {
            color: 0xFFA500,
            description: `❌ ${target.user.tag} is not currently muted.`
          }
        ]
      }).then(msg => {
        setTimeout(async () => {
          try {
            if (msg.deletable) await msg.delete().catch(() => {});
          } catch (error) {
          }
        }, 5000);
      });
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    try {
      try {
        if (message.deletable) {
          await message.delete().catch(error => {
            if (error.code !== 10008) {
              console.log('Non-critical error deleting message:', error.message);
            }
          });
        }
      } catch (error) {
      }

      await target.timeout(null, reason);

      const unmuteEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🔊 User Unmuted')
        .addFields(
          {
            name: 'User',
            value: `${target.user.tag} (${target.id})`,
            inline: true
          },
          {
            name: 'Reason',
            value: reason,
            inline: false
          },
          {
            name: 'Moderator',
            value: message.author.tag,
            inline: true
          }
        )
        .setTimestamp();

      const sentMsg = await message.channel.send({
        embeds: [unmuteEmbed]
      });

      setTimeout(async () => {
        try {
          if (sentMsg.deletable) {
            await sentMsg.delete().catch(error => {
              if (error.code !== 10008) {
                console.log('Error deleting confirmation:', error.message);
              }
            });
          }
        } catch (error) {
        }
      }, 10000);

    } catch (error) {
      console.error('Error in unmute command:', error);
      
      let errorDescription = '❌ An error occurred while trying to unmute the user.';
      
      if (error.code === 50013) {
        errorDescription = '❌ I do not have permission to unmute this user. Please check my role position.';
      } else if (error.code === 50035) {
        errorDescription = '❌ Invalid user or user cannot be unmuted.';
      }
      
      const errorMsg = await message.channel.send({
        embeds: [
          {
            color: 0xFF0000,
            description: errorDescription
          }
        ]
      });
      
      setTimeout(async () => {
        try {
          if (errorMsg.deletable) {
            await errorMsg.delete().catch(error => {
              if (error.code !== 10008) {
                console.log('Error deleting error message:', error.message);
              }
            });
          }
        } catch (error) {
        }
      }, 5000);
    }
  }
};