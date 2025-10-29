const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mute a user in the server')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to mute')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('duration')
                .setDescription('Duration of the mute (e.g., 30m, 2h, 1d)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for the mute')
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ You need the **Moderate Members** permission to use this command.')
                ],
                ephemeral: true
            });
        }

        if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ I need the **Moderate Members** permission to mute users.')
                ],
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user');
        const durationString = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        await interaction.deferReply();

        try {
            const target = await interaction.guild.members.fetch(targetUser.id);

            if (target.id === interaction.user.id) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription('❌ You cannot mute yourself.')
                    ]
                });
            }

            if (target.id === interaction.client.user.id) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription('❌ I cannot mute myself.')
                    ]
                });
            }

            if (target.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription('❌ I cannot mute this user because their highest role is higher than or equal to my highest role.')
                    ]
                });
            }

            const durationMatch = durationString.match(/^(\d+)(m|h|d)$/);
            
            if (!durationMatch) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription('❌ Invalid duration format.\n**Valid formats:** `1m` (minutes), `2h` (hours), `3d` (days)\n**Examples:** `30m`, `2h`, `1d`\n**Maximum:** 28 days')
                    ]
                });
            }

            const amount = parseInt(durationMatch[1]);
            const unit = durationMatch[2];
            
            let duration = 0;
            switch (unit) {
                case 'm':
                    duration = amount * 60 * 1000;
                    break;
                case 'h':
                    duration = amount * 60 * 60 * 1000;
                    break;
                case 'd':
                    duration = amount * 24 * 60 * 60 * 1000;
                    break;
            }
            
            if (duration > 28 * 24 * 60 * 60 * 1000) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription('❌ Mute duration cannot exceed 28 days.')
                    ]
                });
            }

            if (duration < 60 * 1000) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription('❌ Mute duration must be at least 1 minute.')
                    ]
                });
            }

            await target.timeout(duration, reason);

            const durationFormatted = formatDuration(duration);

            const muteEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🔇 User Muted')
                .addFields(
                    {
                        name: 'User',
                        value: `${target.user.tag} (${target.id})`,
                        inline: true
                    },
                    {
                        name: 'Duration',
                        value: durationFormatted,
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
                embeds: [muteEmbed]
            });

        } catch (error) {
            console.error('Error in mute command:', error);
            
            let errorDescription = '❌ An error occurred while trying to mute the user.';
            
            if (error.code === 50013) {
                errorDescription = '❌ I do not have permission to mute this user. Please check my role position.';
            } else if (error.code === 50035) {
                errorDescription = '❌ Invalid duration or user cannot be muted.';
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

function formatDuration(ms) {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.join(' ');
}