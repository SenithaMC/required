const { PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'everyone',
  description: 'Ghost ping every user in the server (stealth mode)',
  aliases: ['ghostping', 'massping'],
  usage: '',
  
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      const errorMsg = await message.channel.send({
        embeds: [
          {
            color: 0xFF0000,
            description: '❌ You need Manage Messages permissions to use this command.'
          }
        ]
      });
      setTimeout(() => {
        if (errorMsg.deletable) errorMsg.delete().catch(() => {});
      }, 5000);
      return;
    }

    try {
      if (message.deletable) {
        await message.delete().catch(error => {
          if (error.code !== 10008) {
            console.error('Error deleting command message:', error);
          }
        });
      }

      const members = await message.guild.members.fetch();
      
      const accessibleMembers = members.filter(member => {
        if (member.user.bot) return false;
        
        try {
          const permissions = message.channel.permissionsFor(member);
          return permissions.has(PermissionsBitField.Flags.ViewChannel);
        } catch (error) {
          return false;
        }
      });
      
      if (accessibleMembers.size === 0) return;

      const mentions = Array.from(accessibleMembers.values()).map(member => `<@${member.id}>`);
      const messageChunks = [];
      let currentChunk = '';
      
      for (const mention of mentions) {
        if ((currentChunk + mention + ' ').length > 2000) {
          messageChunks.push(currentChunk.trim());
          currentChunk = mention + ' ';
        } else {
          currentChunk += mention + ' ';
        }
      }
      
      if (currentChunk.trim().length > 0) {
        messageChunks.push(currentChunk.trim());
      }

      for (let i = 0; i < messageChunks.length; i++) {
        try {
          const pingMsg = await message.channel.send(messageChunks[i]);
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          if (pingMsg.deletable) {
            await pingMsg.delete().catch(error => {
              if (error.code !== 10008) {
                console.error('Error deleting ping message:', error);
              }
            });
          }
          
          if (i < messageChunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 800));
          }
        } catch (error) {
        }
      }
      
    } catch (error) {
    }
  }
};
