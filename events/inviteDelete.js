const { Events } = require('discord.js');
const Invite = require('../models/Invite');

module.exports = {
  name: Events.InviteDelete,
  async execute(invite) {
    try {
      await Invite.findOneAndDelete({
        guildId: invite.guild.id,
        inviteCode: invite.code
      });
    } catch (error) {
      console.error('Error tracking invite deletion:', error);
    }
  },

};
