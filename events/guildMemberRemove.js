const { Events } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    try {
      const invites = await db.executeWithRetry(
        'SELECT * FROM invites WHERE guildId = ?',
        [member.guild.id]
      );
      
      let foundInvite = null;
      
      for (const invite of invites) {
        const invitedUsers = JSON.parse(invite.invitedUsers || '[]');
        const userIndex = invitedUsers.findIndex(u => u.userId === member.id && !u.left);
        
        if (userIndex !== -1) {
          foundInvite = invite;
          break;
        }
      }
      
      if (foundInvite) {
        const invitedUsers = JSON.parse(foundInvite.invitedUsers || '[]');
        const updatedUsers = invitedUsers.map(user => {
          if (user.userId === member.id && !user.left) {
            return {
              ...user,
              left: true,
              leftAt: new Date()
            };
          }
          return user;
        });
        
        await db.executeWithRetry(
          'UPDATE invites SET invitedUsers = ? WHERE id = ?',
          [JSON.stringify(updatedUsers), foundInvite.id]
        );
        
        await updateMemberInvites(member.guild.id, foundInvite.memberId);
      }
    } catch (error) {
      console.error('Error tracking member leave:', error);
    }
  },
};

async function updateMemberInvites(guildId, memberId) {
  try {
    const invites = await db.executeWithRetry(
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
    
    await db.executeWithRetry(
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
