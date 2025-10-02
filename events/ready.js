const { Events } = require('discord.js');
const config = require('../config');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    for (const [guildId, guild] of client.guilds.cache) {
      try {
        const invites = await guild.invites.fetch();
        client.invites.set(guildId, new Map(invites.map(invite => [invite.code, invite.uses])));
      } catch (error) {
        console.error(`Error caching invites for guild ${guildId}:`, error);
      }
    }
    console.log(`✅ Cached invites for ${client.invites.size} guilds`);
  },
};
