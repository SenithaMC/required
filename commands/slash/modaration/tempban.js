const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tempban')
        .setDescription('Temporarily ban a user from the server')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to temporarily ban')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('duration')
                .setDescription('Duration of the ban (e.g., 1d, 2h, 30m)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for the temporary ban')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option
                .setName('send_dm')
                .setDescription('Whether to send a DM to the user')
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ You do not have permission to ban members.')
                ],
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user');
        const duration = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const sendDM = interaction.options.getBoolean('send_dm') || false;

        await interaction.deferReply();

        try {
            const target = await interaction.guild.members.fetch(targetUser.id);

            const timeRegex = /^(\d+)([dDhHmM])$/;
            const match = duration.match(timeRegex);
            if (!match) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription('❌ Invalid duration format. Use format like: 1d (day), 2h (hour), 30m (minute)')
                    ]
                });
            }

            const amount = parseInt(match[1]);
            const unit = match[2].toLowerCase();
            
            let milliseconds;
            switch(unit) {
                case 'd': milliseconds = amount * 24 * 60 * 60 * 1000; break;
                case 'h': milliseconds = amount * 60 * 60 * 1000; break;
                case 'm': milliseconds = amount * 60 * 1000; break;
                default: return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription('❌ Invalid time unit. Use d, h, or m.')
                    ]
                });
            }

            const unbanTime = new Date(Date.now() + milliseconds);
            const formattedUnbanTime = `<t:${Math.floor(unbanTime.getTime() / 1000)}:F>`;

            let dmSuccess = true;
            if (sendDM) {
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('You were temporarily banned')
                        .addFields(
                            { name: 'Server', value: interaction.guild.name, inline: true },
                            { name: 'Reason', value: reason, inline: true },
                            { name: 'Duration', value: duration, inline: true },
                            { name: 'Will be unbanned', value: formattedUnbanTime, inline: true },
                            { name: 'Banned by', value: interaction.user.tag, inline: true },
                            { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                        );
                    await targetUser.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    dmSuccess = false;
                    console.log('Could not send DM to user:', dmError.message);
                }
            }

            await target.ban({ reason: `${reason} | Duration: ${duration} | Unban at: ${formattedUnbanTime}` });

            const responseEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setDescription(`🔨 Temporarily banned **${targetUser.tag}** for: ${reason}`)
                .addFields(
                    { name: 'Duration', value: duration, inline: true },
                    { name: 'Will be unbanned', value: formattedUnbanTime, inline: true }
                );

            if (sendDM && !dmSuccess) {
                responseEmbed.setFooter({ text: 'Note: Could not send DM to user (DMs might be disabled)' });
            }

            await interaction.editReply({ embeds: [responseEmbed] });

            setTimeout(async () => {
                try {
                    await interaction.guild.members.unban(targetUser.id, 'Temporary ban expired');
                    console.log(`Automatically unbanned ${targetUser.tag} after temporary ban`);
                } catch (unbanError) {
                    console.error(`Failed to unban ${targetUser.tag}:`, unbanError.message);
                }
            }, milliseconds);

        } catch (err) {
            console.error(err);
            
            if (err.code === 10007) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription('❌ User not found in this server.')
                    ]
                });
            }
            
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ Failed to ban user. Do I have permission?')
                ]
            });
        }
    }
};