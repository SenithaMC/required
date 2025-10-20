const { PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'notify',
  description: 'Send DM notifications to users, roles, or all members',
  aliases: ['dm', 'message', 'alert'],
  usage: '<user|role|ALL> <message>',
  
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ You need Manage Messages permissions to use this command.')
        ]
      }).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 5000);
      });
    }

    if (args.length < 2) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ Usage: `notify <user|role|ALL> <message>`\nExamples:\n`notify @user Hello!`\n`notify @role Important update!`\n`notify ALL Server maintenance!`')
        ]
      }).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 8000);
      });
    }

    try {
      if (message.deletable) {
        await message.delete().catch(() => {});
      }

      const targetArg = args[0];
      const notificationMessage = args.slice(1).join(' ');
      let targetUsers = [];
      let targetDescription = '';

      if (targetArg === 'ALL') {
        const members = await message.guild.members.fetch();
        targetUsers = members.filter(member => 
          !member.user.bot && 
          member.user.id !== message.author.id
        ).map(member => member.user);
        
        targetDescription = `all ${targetUsers.length} server members`;
      }
      else if (targetArg.startsWith('<@&') && targetArg.endsWith('>')) {
        const roleId = targetArg.replace(/[<@&>]/g, '');
        const role = await message.guild.roles.fetch(roleId).catch(() => null);
        
        if (!role) {
          return message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription('❌ Role not found.')
            ]
          }).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 5000);
          });
        }

        const members = await message.guild.members.fetch();
        targetUsers = members.filter(member => 
          !member.user.bot && 
          member.roles.cache.has(role.id) &&
          member.user.id !== message.author.id
        ).map(member => member.user);
        
        targetDescription = `${targetUsers.length} members with role ${role.name}`;
      }
      else {
        let targetUser;

        if (targetArg.startsWith('<@') && targetArg.endsWith('>')) {
          const userId = targetArg.replace(/[<@!>]/g, '');
          targetUser = await message.client.users.fetch(userId).catch(() => null);
        } 
        else if (/^\d+$/.test(targetArg)) {
          targetUser = await message.client.users.fetch(targetArg).catch(() => null);
        }
        else {
          const member = await message.guild.members.fetch({ 
            query: targetArg, 
            limit: 1 
          }).then(members => members.first());
          targetUser = member?.user;
        }

        if (!targetUser) {
          return message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription('❌ User not found. Please mention a valid user, role, or use ALL.')
            ]
          }).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 5000);
          });
        }

        if (targetUser.bot) {
          return message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription('❌ Cannot send notifications to bots.')
            ]
          }).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 5000);
          });
        }

        targetUsers = [targetUser];
        targetDescription = targetUser.tag;
      }

      if (targetUsers.length === 0) {
        return message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFFFF00)
              .setDescription('⚠️ No users found to notify.')
          ]
        }).then(msg => {
          setTimeout(() => msg.delete().catch(() => {}), 5000);
        });
      }

      const channelLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}`;
      
      const dmEmbed = new EmbedBuilder()
        .setTitle('<:10180purpleenvelope:1425521153090257038> You\'ve got a new notification!')
        .setColor(0x00AE86)
        .setDescription(`> ${notificationMessage}`)
        .addFields(
          {
            name: '<:mc_discord:1416526717157244958> Sent from',
            value: `**${channelLink}**`,
            inline: true
          },
          {
            name: '<:role_member:1410645006271774891> Sent by',
            value: `${message.author}`,
            inline: true
          }
        )
        .setThumbnail(message.guild.iconURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({
          text: `You can reply to this by messaging ${message.author.tag} directly`,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        });

      let successCount = 0;
      let failedCount = 0;

      for (const user of targetUsers) {
        try {
          await user.send({ embeds: [dmEmbed] });
          successCount++;
          
          if (targetUsers.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (dmError) {
          failedCount++;
        }
      }

      let confirmationText = `✅ Notifications sent:\n**Target:** ${targetDescription}\n**Success:** ${successCount}`;
      
      if (failedCount > 0) {
        confirmationText += `\n**Failed:** (DMs disabled or blocked)`;
      }

      const confirmMsg = await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(failedCount > 0 ? 0xFFFF00 : 0x00FF00)
            .setDescription(confirmationText)
            .addFields(
              { name: 'Message', value: notificationMessage.substring(0, 1024) }
            )
        ]
      });

      setTimeout(async () => {
        if (confirmMsg.deletable) {
          await confirmMsg.delete().catch(() => {});
        }
      }, 8000);

    } catch (error) {
      console.error('Error in notify command:', error);
      
      const errorMsg = await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ An error occurred while processing the command.')
        ]
      });

      setTimeout(async () => {
        if (errorMsg.deletable) {
          await errorMsg.delete().catch(() => {});
        }
      }, 5000);
    }
  }
};