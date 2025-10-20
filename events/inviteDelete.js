const { Events } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  name: Events.InviteDelete,
  async execute(invite) {
    try {
      await db.executeWithRetry(
        'DELETE FROM invites WHERE guildId = ? AND inviteCode = ?',
        [invite.guild.id, invite.code]
      );
    } catch (error) {
      console.error('Error tracking invite deletion:', error);
    }
  },
};