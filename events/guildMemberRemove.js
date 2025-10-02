const { Events } = require('discord.js');
const Invite = require('../models/Invite');
const MemberInvites = require('../models/MemberInvites');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    try {
      const invite = await Invite.findOne({
        guildId: member.guild.id,
        'invitedUsers.userId': member.id,
        'invitedUsers.left': false
      });
      
      if (invite) {
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
        
        await updateMemberInvites(member.guild.id, invite.memberId);
      }
    } catch (error) {
      console.error('Error tracking member leave:', error);
    }
  },
};

async function updateMemberInvites(guildId, memberId) {
}
