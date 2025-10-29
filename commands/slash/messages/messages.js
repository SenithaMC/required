const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('messages')
        .setDescription('Show message count for users')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to check message count for')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;

            await interaction.deferReply();

            try {
                const [rows] = await db.pool.execute(
                    'SELECT message_count FROM user_messages WHERE guild_id = ? AND user_id = ?',
                    [interaction.guild.id, targetUser.id]
                );

                const count = rows.length > 0 ? rows[0].message_count : 0;
                
                const member = await interaction.guild.members.fetch(targetUser.id);
                const displayName = member?.displayName || targetUser.username;

                const embed = new EmbedBuilder()
                    .setTitle(`${displayName}'s Message Count`)
                    .setDescription(`Sent a total of **${count.toLocaleString()}** messages in this server.`)
                    .setColor(0x00FF00)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error(`Error fetching message count for user ${targetUser.id}:`, error);
                
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(`❌ Failed to fetch message count for ${targetUser.tag}`)
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [errorEmbed] });
            }

        } catch (error) {
            console.error('Error in messages command:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ Failed to fetch message counts. Please try again.')
                ]
            });
        }
    }
};
