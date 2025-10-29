const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock a channel to allow messages')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('The channel to unlock (defaults to current channel)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for unlocking the channel')
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ You need the `Manage Channels` permission to unlock channels.')
                ],
                ephemeral: true
            });
        }

        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const reason = interaction.options.getString('reason') || 'None';

        const everyone = interaction.guild.roles.everyone;
        const currentPerms = channel.permissionOverwrites.cache.get(everyone.id);

        if (!currentPerms || !currentPerms.deny.has(PermissionsBitField.Flags.SendMessages)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setDescription(`🔓 ${channel} is already unlocked.`)
                ],
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            await channel.permissionOverwrites.edit(everyone, { SendMessages: null });

            const embed = new EmbedBuilder()
                .setTitle('🔓 Channel Unlocked')
                .addFields(
                    { name: 'Unlocked by', value: `${interaction.member}`, inline: true },
                    { name: 'Reason', value: reason, inline: true }
                )
                .setColor(0x00FF00)
                .setTimestamp();

            await channel.send({ embeds: [embed] });

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setDescription(`🔓 Unlocked ${channel}`)
                ]
            });
        } catch (error) {
            console.error('Error unlocking channel:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ Failed to unlock the channel. Do I have permission?')
                ]
            });
        }
    }
};