const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('notify')
        .setDescription('Send DM notifications to users, roles, or all members')
        .addStringOption(option =>
            option
                .setName('target')
                .setDescription('User, role, or ALL to notify')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('The notification message to send')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ You need Manage Messages permissions to use this command.')
                ],
                ephemeral: true
            });
        }

        const targetArg = interaction.options.getString('target');
        const notificationMessage = interaction.options.getString('message');

        await interaction.deferReply({ ephemeral: true });

        try {
            let targetUsers = [];
            let targetDescription = '';

            if (targetArg.toUpperCase() === 'ALL') {
                const members = await interaction.guild.members.fetch();
                targetUsers = members.filter(member => 
                    !member.user.bot && 
                    member.user.id !== interaction.user.id
                ).map(member => member.user);
                
                targetDescription = `all ${targetUsers.length} server members`;
            }
            else if (targetArg.startsWith('<@&') && targetArg.endsWith('>')) {
                const roleId = targetArg.replace(/[<@&>]/g, '');
                const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
                
                if (!role) {
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xFF0000)
                                .setDescription('❌ Role not found.')
                        ]
                    });
                }

                const members = await interaction.guild.members.fetch();
                targetUsers = members.filter(member => 
                    !member.user.bot && 
                    member.roles.cache.has(role.id) &&
                    member.user.id !== interaction.user.id
                ).map(member => member.user);
                
                targetDescription = `${targetUsers.length} members with role ${role.name}`;
            }
            else {
                let targetUser;

                if (targetArg.startsWith('<@') && targetArg.endsWith('>')) {
                    const userId = targetArg.replace(/[<@!>]/g, '');
                    targetUser = await interaction.client.users.fetch(userId).catch(() => null);
                } 
                else if (/^\d+$/.test(targetArg)) {
                    targetUser = await interaction.client.users.fetch(targetArg).catch(() => null);
                }
                else {
                    const member = await interaction.guild.members.fetch({ 
                        query: targetArg, 
                        limit: 1 
                    }).then(members => members.first());
                    targetUser = member?.user;
                }

                if (!targetUser) {
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xFF0000)
                                .setDescription('❌ User not found. Please mention a valid user, role, or use ALL.')
                        ]
                    });
                }

                if (targetUser.bot) {
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xFF0000)
                                .setDescription('❌ Cannot send notifications to bots.')
                        ]
                    });
                }

                targetUsers = [targetUser];
                targetDescription = targetUser.tag;
            }

            if (targetUsers.length === 0) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFFFF00)
                            .setDescription('⚠️ No users found to notify.')
                    ]
                });
            }

            const channelLink = `https://discord.com/channels/${interaction.guild.id}/${interaction.channel.id}`;
            
            const dmEmbed = new EmbedBuilder()
                .setTitle('<:10180purpleenvelope:1425521153090257038> You\'ve got a new notification!')
                .setColor(0x00AE86)
                .setDescription(`> ${notificationMessage}`)
                .addFields(
                    {
                        name: '<:mc_discord:1416526717157244958> Sent from',
                        value: `**${channelLink}**`,
                        inline: true
                    },
                    {
                        name: '<:role_member:1410645006271774891> Sent by',
                        value: `${interaction.user}`,
                        inline: true
                    }
                )
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({
                    text: `You can reply to this by messaging ${interaction.user.tag} directly`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                });

            let successCount = 0;
            let failedCount = 0;

            for (const user of targetUsers) {
                try {
                    await user.send({ embeds: [dmEmbed] });
                    successCount++;
                    
                    if (targetUsers.length > 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (dmError) {
                    failedCount++;
                }
            }

            let confirmationText = `✅ Notifications sent:\n**Target:** ${targetDescription}\n**Success:** ${successCount}`;
            
            if (failedCount > 0) {
                confirmationText += `\n**Failed:** ${failedCount} (DMs disabled or blocked)`;
            }

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(failedCount > 0 ? 0xFFFF00 : 0x00FF00)
                        .setDescription(confirmationText)
                        .addFields(
                            { name: 'Message', value: notificationMessage.substring(0, 1024) }
                        )
                ]
            });

        } catch (error) {
            console.error('Error in notify command:', error);
            
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ An error occurred while processing the command.')
                ]
            });
        }
    }
};