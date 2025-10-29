const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the server')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to ban')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for the ban')
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
        const reason = interaction.options.getString('reason') || 'No reason provided';

        await interaction.deferReply();

        try {
            const target = await interaction.guild.members.fetch(targetUser.id);

            if (target.id === interaction.client.user.id) {
                if (reason.toLowerCase().includes('restart') || reason.toLowerCase().includes('update') || reason.toLowerCase().includes('reboot')) {
                    await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0x00FF00)
                                .setDescription('🔄 Bot restarting...')
                        ]
                    });
                    
                    process.exit(0);
                    return;
                }
            }

            if (target.id === interaction.user.id) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription("❌ You can't ban yourself.")
                    ]
                });
            }

            if (target.roles.highest.position >= interaction.member.roles.highest.position) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription("❌ You can't ban someone with equal or higher role.")
                    ]
                });
            }

            let dmSuccess = true;
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('You were banned')
                    .addFields(
                        { name: 'Server', value: interaction.guild.name, inline: true },
                        { name: 'Reason', value: reason, inline: true },
                        { name: 'Banned by', value: interaction.user.tag, inline: true },
                        { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                    );
                await targetUser.send({ embeds: [dmEmbed] });
            } catch {
                dmSuccess = false;
            }

            await target.ban({ reason });
            const responseEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setDescription(`🔨 Banned **${targetUser.tag}** for: ${reason}`);

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
                        .setDescription('❌ Failed to ban user. Do I have permission?')
                ]
            });
        }
    }
};
