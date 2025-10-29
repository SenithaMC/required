const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lock a channel to prevent messages')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('The channel to lock (defaults to current channel)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for locking the channel')
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ You do not have permission to manage channels.')
                ],
                ephemeral: true
            });
        }

        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const reason = interaction.options.getString('reason') || 'None';

        const everyone = interaction.guild.roles.everyone;
        const currentPerms = channel.permissionOverwrites.cache.get(everyone.id);

        if (currentPerms?.deny.has(PermissionsBitField.Flags.SendMessages)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xF2FF00)
                        .setDescription(`🔒 ${channel} is already locked.`)
                ],
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            await channel.permissionOverwrites.edit(everyone, { SendMessages: false });

            const embed = new EmbedBuilder()
                .setTitle('🔒 Channel Locked')
                .addFields(
                    { name: 'Locked by', value: `${interaction.member}`, inline: true },
                    { name: 'Reason', value: reason, inline: true }
                )
                .setColor(0xFF0000)
                .setTimestamp();

            await channel.send({ embeds: [embed] });

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription(`🔒 Locked ${channel}`)
                ]
            });
        } catch (err) {
            console.error(err);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ Failed to lock the channel. Do I have permission?')
                ]
            });
        }
    }
};