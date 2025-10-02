const { Events } = require('discord.js');
const Invite = require('../models/Invite');

module.exports = {
  name: Events.InviteCreate,
  async execute(invite) {
    try {
      // Check if the invite already exists
      let inviteData = await Invite.findOne({
        guildId: invite.guild.id,
        inviteCode: invite.code
      });

      if (!inviteData) {
        // Create new invite record
        inviteData = new Invite({
          guildId: invite.guild.id,
          memberId: invite.inviter.id,
          inviteCode: invite.code,
          uses: invite.uses
        });
        await inviteData.save();
      }
    } catch (error) {
      console.error('Error tracking invite creation:', error);
    }
  },
};