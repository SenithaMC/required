const { Events } = require('discord.js');
const Invite = require('../models/Invite');
const MemberInvites = require('../models/MemberInvites');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member, client) {
    const guild = member.guild;
    
    // ===== GREET FEATURE =====
    console.log(`Member joined: ${member.user.tag} in ${guild.name}`);
    
    // Check if greetConfigs exists and has the guild
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
          // Replace placeholders in the message
          let welcomeMessage = greetConfig.message
            .replace(/{user}/g, `<@${member.id}>`)
            .replace(/{server}/g, guild.name)
            .replace(/{memberCount}/g, guild.memberCount.toString());

          // Send the welcome message
          const sentMessage = await channel.send(welcomeMessage);
          console.log(`✅ Sent welcome message for ${member.user.tag} in ${guild.name}`);

          // Delete the message after the specified time if greater than 0
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
          // Remove the config if we can't send messages
          client.greetConfigs.delete(guild.id);
        }
      } else {
        // Channel doesn't exist, remove it from storage
        console.log(`Channel ${greetConfig.channelId} not found in cache, removing from greetConfigs`);
        client.greetConfigs.delete(guild.id);
      }
    } else {
      console.log(`No greet configuration set for guild ${guild.id}`);
    }

    // ===== EXISTING INVITE TRACKING CODE =====
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
          let inviteData = await Invite.findOne({
            guildId: guild.id,
            inviteCode: usedInvite.code
          });
          
          if (!inviteData) {
            inviteData = new Invite({
              guildId: guild.id,
              memberId: usedInvite.inviter.id,
              inviteCode: usedInvite.code,
              uses: usedInvite.uses
            });
          }
          
          inviteData.invitedUsers.push({
            userId: member.id,
            joinedAt: new Date()
          });
          
          inviteData.uses = usedInvite.uses;
          await inviteData.save();
          
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
    const invites = await Invite.find({ guildId, memberId });
    
    let totalInvites = 0;
    let validInvites = 0;
    let fakeInvites = 0;
    let leaveInvites = 0;
    const inviteCodes = [];
    
    for (const invite of invites) {
      totalInvites += invite.uses;
      inviteCodes.push(invite.inviteCode);
      
      for (const user of invite.invitedUsers) {
        if (user.left) {
          if (user.leftAt - user.joinedAt < 10 * 60 * 1000) {
            fakeInvites++;
          } else {
            leaveInvites++;
          }
        } else {
          validInvites++;
        }
      }
    }
    
    await MemberInvites.findOneAndUpdate(
      { guildId, memberId },
      {
        totalInvites,
        validInvites,
        fakeInvites,
        leaveInvites,
        inviteCodes,
        lastUpdated: new Date()
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error updating member invites:', error);
  }
}