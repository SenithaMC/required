const { Events } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member, client) {
    const guild = member.guild;
    
    console.log(`Member joined: ${member.user.tag} in ${guild.name}`);
    
    if (!client.greetConfigs) {
      client.greetConfigs = new Map();
      console.log('Initialized client.greetConfigs in guildMemberAdd event');
    }
    
    const greetConfig = client.greetConfigs.get(guild.id);
    console.log(`Greet config for guild ${guild.id}:`, greetConfig);
    
    if (greetConfig) {
      const channel = guild.channels.cache.get(greetConfig.channelId);
      console.log(`Found channel:`, channel ? channel.name : 'Not found');
      
      if (channel) {
        try {
          let welcomeMessage = greetConfig.message
            .replace(/{user}/g, `<@${member.id}>`)
            .replace(/{server}/g, guild.name)
            .replace(/{memberCount}/g, guild.memberCount.toString());

          const sentMessage = await channel.send(welcomeMessage);
          console.log(`✅ Sent welcome message for ${member.user.tag} in ${guild.name}`);

          if (greetConfig.deleteAfter > 0) {
            setTimeout(async () => {
              try {
                await sentMessage.delete();
                console.log(`🗑️ Deleted welcome message for ${member.user.tag} after ${greetConfig.deleteAfter}s`);
              } catch (deleteError) {
                console.error('Failed to delete welcome message:', deleteError);
              }
            }, greetConfig.deleteAfter * 1000);
          }
        } catch (error) {
          console.error('❌ Failed to send welcome message:', error);
          client.greetConfigs.delete(guild.id);
        }
      } else {
        console.log(`Channel ${greetConfig.channelId} not found in cache, removing from greetConfigs`);
        client.greetConfigs.delete(guild.id);
      }
    } else {
      console.log(`No greet configuration set for guild ${guild.id}`);
    }

    try {
      const newInvites = await guild.invites.fetch();
      const oldInvites = client.invites.get(guild.id) || new Map();

      let usedInvite;
      for (const [code, invite] of newInvites) {
        const oldUses = oldInvites.get(code) || 0;
        if (invite.uses > oldUses) {
          usedInvite = invite;
          break;
        }
      }
      
      if (usedInvite && usedInvite.inviter) {
        try {
          const [inviteRows] = await db.pool.execute(
            'SELECT * FROM invites WHERE guildId = ? AND inviteCode = ?',
            [guild.id, usedInvite.code]
          );
          
          let inviteData = inviteRows[0];
          
          if (!inviteData) {
            await db.pool.execute(
              'INSERT INTO invites (guildId, memberId, inviteCode, uses, invitedUsers) VALUES (?, ?, ?, ?, ?)',
              [guild.id, usedInvite.inviter.id, usedInvite.code, usedInvite.uses, JSON.stringify([])]
            );
            
            const [newInviteRows] = await db.pool.execute(
              'SELECT * FROM invites WHERE guildId = ? AND inviteCode = ?',
              [guild.id, usedInvite.code]
            );
            inviteData = newInviteRows[0];
          }
          
          const invitedUsers = JSON.parse(inviteData.invitedUsers || '[]');
          invitedUsers.push({
            userId: member.id,
            joinedAt: new Date(),
            left: false
          });
          
          await db.pool.execute(
            'UPDATE invites SET uses = ?, invitedUsers = ? WHERE id = ?',
            [usedInvite.uses, JSON.stringify(invitedUsers), inviteData.id]
          );
          
          await updateMemberInvites(guild.id, usedInvite.inviter.id);
          
        } catch (error) {
          console.error('Error tracking member join:', error);
        }
      }
      
      client.invites.set(guild.id, new Map(newInvites.map(invite => [invite.code, invite.uses])));
    } catch (error) {
      console.error('Error in invite tracking:', error);
    }
  },
};

async function updateMemberInvites(guildId, memberId) {
  try {
    const [invites] = await db.pool.execute(
      'SELECT * FROM invites WHERE guildId = ? AND memberId = ?',
      [guildId, memberId]
    );
    
    let totalInvites = 0;
    let validInvites = 0;
    let fakeInvites = 0;
    let leaveInvites = 0;
    const inviteCodes = [];
    
    for (const invite of invites) {
      totalInvites += invite.uses;
      inviteCodes.push(invite.inviteCode);
      
      const invitedUsers = JSON.parse(invite.invitedUsers || '[]');
      for (const user of invitedUsers) {
        if (user.left) {
          if (user.leftAt && new Date(user.leftAt) - new Date(user.joinedAt) < 10 * 60 * 1000) {
            fakeInvites++;
          } else {
            leaveInvites++;
          }
        } else {
          validInvites++;
        }
      }
    }
    
    await db.pool.execute(
      `INSERT INTO member_invites (guildId, memberId, totalInvites, validInvites, fakeInvites, leaveInvites, inviteCodes) 
       VALUES (?, ?, ?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       totalInvites = ?, validInvites = ?, fakeInvites = ?, leaveInvites = ?, inviteCodes = ?, lastUpdated = CURRENT_TIMESTAMP`,
      [
        guildId, memberId, totalInvites, validInvites, fakeInvites, leaveInvites, JSON.stringify(inviteCodes),
        totalInvites, validInvites, fakeInvites, leaveInvites, JSON.stringify(inviteCodes)
      ]
    );
  } catch (error) {
    console.error('Error updating member invites:', error);
  }
}