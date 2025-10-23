const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
    name: 'rmsg',
    description: 'Reset message counters for users, roles, or entire server',
    usage: 'rmsg [@user/@role]',
    aliases: ['resetmessages', 'clearmessages'],
    
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ You need the `Manage Messages` permission to reset message counters.')
                ]
            });
        }

        try {
            const mentionedUsers = message.mentions.users;
            const mentionedRoles = message.mentions.roles;
            
            let resetCount = 0;
            let description = '';

            if (mentionedUsers.size > 0) {
                const userIds = Array.from(mentionedUsers.keys());
                
                for (const userId of userIds) {
                    const [result] = await db.pool.execute(
                        'DELETE FROM user_messages WHERE guild_id = ? AND user_id = ?',
                        [message.guild.id, userId]
                    );
                    resetCount += result.affectedRows;
                }
                
                description = `✅ Reset message counts for **${mentionedUsers.size}** user(s)`;
                
            } else if (mentionedRoles.size > 0) {
                const role = mentionedRoles.first();
                const members = role.members;
                
                for (const [memberId, member] of members) {
                    const [result] = await db.pool.execute(
                        'DELETE FROM user_messages WHERE guild_id = ? AND user_id = ?',
                        [message.guild.id, memberId]
                    );
                    resetCount += result.affectedRows;
                }
                
                description = `✅ Reset message counts for **${members.size}** members with role **${role.name}**`;
                
            } else {
                const [result] = await db.pool.execute(
                    'DELETE FROM user_messages WHERE guild_id = ?',
                    [message.guild.id]
                );
                resetCount = result.affectedRows;
                description = `✅ Reset all message counters for this server (**${resetCount}** users)`;
            }

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setDescription(description)
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Error in rmsg command:', error);
            await message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ Failed to reset message counters. Please try again.')
                ]
            });
        }
    }
};
