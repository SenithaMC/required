const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Unmute a user in the server')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to unmute')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for unmuting')
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ You need the **Manage Roles** permission to use this command.')
                ],
                ephemeral: true
            });
        }

        if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ I need the **Moderate Members** permission to unmute users.')
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
                            .setDescription('❌ You cannot unmute yourself.')
                    ]
                });
            }

            if (target.id === interaction.client.user.id) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription('❌ I cannot unmute myself.')
                    ]
                });
            }

            if (!target.isCommunicationDisabled()) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFFA500)
                            .setDescription(`❌ ${target.user.tag} is not currently muted.`)
                    ]
                });
            }

            await target.timeout(null, reason);

            const unmuteEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🔊 User Unmuted')
                .addFields(
                    {
                        name: 'User',
                        value: `${target.user.tag} (${target.id})`,
                        inline: true
                    },
                    {
                        name: 'Reason',
                        value: reason,
                        inline: false
                    },
                    {
                        name: 'Moderator',
                        value: interaction.user.tag,
                        inline: true
                    }
                )
                .setTimestamp();

            await interaction.editReply({
                embeds: [unmuteEmbed]
            });

        } catch (error) {
            console.error('Error in unmute command:', error);
            
            let errorDescription = '❌ An error occurred while trying to unmute the user.';
            
            if (error.code === 50013) {
                errorDescription = '❌ I do not have permission to unmute this user. Please check my role position.';
            } else if (error.code === 50035) {
                errorDescription = '❌ Invalid user or user cannot be unmuted.';
            }
            
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription(errorDescription)
                ]
            });
        }
    }
};