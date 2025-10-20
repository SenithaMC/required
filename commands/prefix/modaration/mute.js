const { PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'mute',
  description: 'Mute a user in the server',
  aliases: ['silence'],
  usage: '<@user> <duration> [reason]',
  
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return message.channel.send({
        embeds: [
          {
            color: 0xFF0000,
            description: '❌ You need the **Moderate Members** permission to use this command.'
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

    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return message.channel.send({
        embeds: [
          {
            color: 0xFF0000,
            description: '❌ I need the **Moderate Members** permission to mute users.'
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
            description: '❌ Please mention a valid user to mute.\n**Usage:** `;mute @user <duration> [reason]`\n**Example:** `;mute @user 30m Spamming`'
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
            description: '❌ You cannot mute yourself.'
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
            description: '❌ I cannot mute myself.'
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
    if (target.roles.highest.position >= message.guild.members.me.roles.highest.position) {
      return message.channel.send({
        embeds: [
          {
            color: 0xFF0000,
            description: '❌ I cannot mute this user because their highest role is higher than or equal to my highest role.'
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

    if (!args[1]) {
      return message.channel.send({
        embeds: [
          {
            color: 0xFF0000,
            description: '❌ Please provide a valid duration.\n**Format:** `1m`, `2h`, `3d`\n**Examples:** `30m`, `2h`, `1d`\n**Usage:** `;mute @user <duration> [reason]`'
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

    let duration = 0;
    let reason = 'No reason provided';
    
    const durationArgs = args.slice(1);
    
    const durationArg = durationArgs[0];
    const durationMatch = durationArg.match(/^(\d+)(m|h|d)$/);
    
    if (!durationMatch) {
      return message.channel.send({
        embeds: [
          {
            color: 0xFF0000,
            description: '❌ Invalid duration format.\n**Valid formats:** `1m` (minutes), `2h` (hours), `3d` (days)\n**Examples:** `30m`, `2h`, `1d`\n**Maximum:** 28 days'
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

    const amount = parseInt(durationMatch[1]);
    const unit = durationMatch[2];
    
    switch (unit) {
      case 'm':
        duration = amount * 60 * 1000;
        break;
      case 'h':
        duration = amount * 60 * 60 * 1000;
        break;
      case 'd':
        duration = amount * 24 * 60 * 60 * 1000;
        break;
    }
    
    reason = durationArgs.slice(1).join(' ') || reason;

    if (duration > 28 * 24 * 60 * 60 * 1000) {
      return message.channel.send({
        embeds: [
          {
            color: 0xFF0000,
            description: '❌ Mute duration cannot exceed 28 days.'
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

    if (duration < 60 * 1000) {
      return message.channel.send({
        embeds: [
          {
            color: 0xFF0000,
            description: '❌ Mute duration must be at least 1 minute.'
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

      await target.timeout(duration, reason);

      const durationFormatted = formatDuration(duration);

      const muteEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🔇 User Muted')
        .addFields(
          {
            name: 'User',
            value: `${target.user.tag} (${target.id})`,
            inline: true
          },
          {
            name: 'Duration',
            value: durationFormatted,
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
        embeds: [muteEmbed]
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
      console.error('Error in mute command:', error);
      
      let errorDescription = '❌ An error occurred while trying to mute the user.';
      
      if (error.code === 50013) {
        errorDescription = '❌ I do not have permission to mute this user. Please check my role position.';
      } else if (error.code === 50035) {
        errorDescription = '❌ Invalid duration or user cannot be muted.';
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

function formatDuration(ms) {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(' ');
}