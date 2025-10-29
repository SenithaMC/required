const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const config = require('../../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('restrict')
        .setDescription('Restrict all commands for non-admin members')
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Enable command restriction')
                .addRoleOption(option =>
                    option
                        .setName('exempt_roles')
                        .setDescription('Roles to exempt from restriction')
                        .setRequired(false)
                )
                .addChannelOption(option =>
                    option
                        .setName('exempt_channels')
                        .setDescription('Channels to exempt from restriction')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable command restriction')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check current restriction status')
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ You need Administrator permissions to use this command.')
                ],
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const CommandRestrict = interaction.client.dbModels.get('CommandRestrict');

        try {
            if (subcommand === 'enable') {
                const exemptRoles = interaction.options.getRole('exempt_roles');
                const exemptChannels = interaction.options.getChannel('exempt_channels');

                const roleIds = exemptRoles ? [exemptRoles.id] : [];
                const channelIds = exemptChannels ? [exemptChannels.id] : [];

                await CommandRestrict.findOneAndUpdate(
                    { guildId: interaction.guild.id },
                    { 
                        enabled: true,
                        enabledBy: interaction.user.id,
                        enabledAt: new Date(),
                        exemptRoles: roleIds,
                        exemptChannels: channelIds
                    },
                    { upsert: true, new: true }
                );

                const embed = new EmbedBuilder()
                    .setTitle('🔒 Command Restriction Enabled')
                    .setDescription('All commands are now restricted to administrators only.')
                    .addFields(
                        { name: 'Enabled by', value: `${interaction.member}`, inline: true },
                        { name: 'Status', value: '🟢 Active', inline: true }
                    )
                    .setColor(0xFF0000)
                    .setTimestamp();

                if (roleIds.length > 0 || channelIds.length > 0) {
                    embed.addFields({
                        name: 'Exemptions',
                        value: [
                            roleIds.length > 0 ? `**Roles:** ${roleIds.map(id => `<@&${id}>`).join(', ')}` : '',
                            channelIds.length > 0 ? `**Channels:** ${channelIds.map(id => `<#${id}>`).join(', ')}` : ''
                        ].filter(text => text).join('\n')
                    });
                }

                embed.setFooter({ text: 'Use /restrict disable to turn off' });

                await interaction.reply({ embeds: [embed] });

            } else if (subcommand === 'disable') {
                await CommandRestrict.findOneAndUpdate(
                    { guildId: interaction.guild.id },
                    { enabled: false }
                );

                const embed = new EmbedBuilder()
                    .setTitle('🔓 Command Restriction Disabled')
                    .setDescription('All commands are now available to all members.')
                    .addFields(
                        { name: 'Disabled by', value: `${interaction.member}`, inline: true },
                        { name: 'Status', value: '🔴 Inactive', inline: true }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });

            } else if (subcommand === 'status') {
                const restrictData = await CommandRestrict.findOne({ guildId: interaction.guild.id });
                
                const embed = new EmbedBuilder()
                    .setTitle('🔒 Command Restriction Status')
                    .setColor(restrictData?.enabled ? 0xFF0000 : 0x00FF00)
                    .addFields(
                        { name: 'Status', value: restrictData?.enabled ? '🟢 Active' : '🔴 Inactive', inline: true },
                        { name: 'Enabled by', value: restrictData?.enabled ? `<@${restrictData.enabledBy}>` : 'N/A', inline: true }
                    )
                    .setTimestamp();

                if (restrictData?.enabled && restrictData.enabledAt) {
                    embed.addFields({ 
                        name: 'Enabled at', 
                        value: `<t:${Math.floor(restrictData.enabledAt.getTime() / 1000)}:F>`, 
                        inline: true 
                    });
                }

                if (restrictData?.exemptRoles?.length > 0 || restrictData?.exemptChannels?.length > 0) {
                    embed.addFields({
                        name: 'Exemptions',
                        value: [
                            restrictData.exemptRoles?.length > 0 ? `**Roles:** ${restrictData.exemptRoles.map(id => `<@&${id}>`).join(', ')}` : '',
                            restrictData.exemptChannels?.length > 0 ? `**Channels:** ${restrictData.exemptChannels.map(id => `<#${id}>`).join(', ')}` : ''
                        ].filter(text => text).join('\n')
                    });
                }

                await interaction.reply({ embeds: [embed] });
            }
        } catch (err) {
            console.error('Restrict command error:', err);
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ An error occurred while updating command restriction settings.')
                ],
                ephemeral: true
            });
        }
    }
};