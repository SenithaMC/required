const { Events } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  name: Events.InviteCreate,
  async execute(invite) {
    try {
      const existingInvites = await db.executeWithRetry(
        'SELECT * FROM invites WHERE guildId = ? AND inviteCode = ?',
        [invite.guild.id, invite.code]
      );

      if (existingInvites.length === 0) {
        await db.executeWithRetry(
          'INSERT INTO invites (guildId, memberId, inviteCode, uses, invitedUsers) VALUES (?, ?, ?, ?, ?)',
          [invite.guild.id, invite.inviter.id, invite.code, invite.uses, JSON.stringify([])]
        );
      }
    } catch (error) {
      console.error('Error tracking invite creation:', error);
    }
  },
};