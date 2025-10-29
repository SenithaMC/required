const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user from the server')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to kick')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for the kick')
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.KickMembers)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ You do not have permission to kick members.')
                ],
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        await interaction.deferReply();

        try {
            const target = await interaction.guild.members.fetch(targetUser.id);

            if (target.id === interaction.user.id) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription("❌ You can't kick yourself.")
                    ]
                });
            }

            if (target.roles.highest.position >= interaction.member.roles.highest.position) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription("❌ You can't kick someone with equal or higher role.")
                    ]
                });
            }

            let dmSuccess = true;
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('You were kicked')
                    .addFields(
                        { name: 'Server', value: interaction.guild.name, inline: true },
                        { name: 'Reason', value: reason, inline: true },
                        { name: 'Kicked by', value: interaction.user.tag, inline: true },
                        { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                    );
                await targetUser.send({ embeds: [dmEmbed] });
            } catch {
                dmSuccess = false;
            }

            await target.kick(reason);
            const responseEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setDescription(`✅ Kicked **${targetUser.tag}** for: ${reason}`);

            if (!dmSuccess) {
                responseEmbed.setFooter({ text: 'Note: Could not DM the user (DMs might be disabled).' });
            }

            await interaction.editReply({ embeds: [responseEmbed] });
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
                        .setDescription('❌ Failed to kick user. Do I have permission?')
                ]
            });
        }
    }
};