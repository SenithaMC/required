const { EmbedBuilder } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
    name: 'messages',
    description: 'Show message count for users',
    usage: 'messages [@user]',
    aliases: ['msgcount', 'messagecount'],
    
    async execute(message, args) {
        try {
            let targetUsers = [];
            
            if (args.length === 0) {
                targetUsers.push(message.author);
            } else {
                const mentionedUsers = message.mentions.users;
                
                if (mentionedUsers.size === 0) {
                    return message.channel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xFF0000)
                                .setDescription('❌ Please mention a user or use without arguments to see your own count.')
                        ]
                    });
                }
                
                targetUsers = Array.from(mentionedUsers.values());
            }

            for (const user of targetUsers) {
                try {
                    const [rows] = await db.pool.execute(
                        'SELECT message_count FROM user_messages WHERE guild_id = ? AND user_id = ?',
                        [message.guild.id, user.id]
                    );

                    const count = rows.length > 0 ? rows[0].message_count : 0;
                    
                    const member = await message.guild.members.fetch(user.id);
                    const displayName = member?.displayName || user.username;

                    const embed = new EmbedBuilder()
                        .setTitle(displayName)
                        .setDescription(`You sent a total of ${count.toLocaleString()} messages in this server.`)
                        .setColor(0x00FF00)
                        .setTimestamp();

                    await message.channel.send({ embeds: [embed] });

                } catch (error) {
                    console.error(`Error fetching message count for user ${user.id}:`, error);
                    
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription(`❌ Failed to fetch message count for ${user.tag}`)
                        .setTimestamp();
                    
                    await message.channel.send({ embeds: [errorEmbed] });
                }
            }

        } catch (error) {
            console.error('Error in messages command:', error);
            await message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ Failed to fetch message counts. Please try again.')
                ]
            });
        }
    }
};
