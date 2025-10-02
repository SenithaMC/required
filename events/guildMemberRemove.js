const { Events } = require('discord.js');
const Invite = require('../models/Invite');
const MemberInvites = require('../models/MemberInvites');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    try {
      // Find the invite that brought this member
      const invite = await Invite.findOne({
        guildId: member.guild.id,
        'invitedUsers.userId': member.id,
        'invitedUsers.left': false
      });
      
      if (invite) {
        // Mark the user as left
        await Invite.updateOne(
          {
            guildId: member.guild.id,
            'invitedUsers.userId': member.id
          },
          {
            $set: {
              'invitedUsers.$.left': true,
              'invitedUsers.$.leftAt': new Date()
            }
          }
        );
        
        // Update member invites summary
        await updateMemberInvites(member.guild.id, invite.memberId);
      }
    } catch (error) {
      console.error('Error tracking member leave:', error);
    }
  },
};

// Reuse the same function from guildMemberAdd.js
async function updateMemberInvites(guildId, memberId) {
  // Same implementation as in guildMemberAdd.js
}