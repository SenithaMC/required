const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const massActionCache = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('massban')
        .setDescription('Ban all members with a specific role')
        .addRoleOption(option =>
            option
                .setName('role')
                .setDescription('The role to mass ban')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for the mass ban')
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ You need the `Ban Members` permission to use this command.')
                ],
                ephemeral: true
            });
        }

        const targetRole = interaction.options.getRole('role');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (targetRole.id === interaction.guild.id) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ You cannot mass ban the @everyone role.')
                ],
                ephemeral: true
            });
        }

        const members = targetRole.members;
        
        if (members.size === 0) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFFA500)
                        .setDescription(`No members found with the role ${targetRole.name}.`)
                ],
                ephemeral: true
            });
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`massban_confirm_${targetRole.id}`)
                    .setLabel('Confirm Mass Ban')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('massban_cancel')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Mass Ban Confirmation')
            .setDescription(`You are about to ban **${members.size}** members with the role ${targetRole.name}.`)
            .addFields(
                { name: 'Reason', value: reason },
                { name: 'Warning', value: 'This action cannot be undone!' }
            )
            .setColor(0xFFA500)
            .setFooter({ text: 'You have 60 seconds to confirm' });

        await interaction.reply({ 
            embeds: [confirmEmbed], 
            components: [row] 
        });

        const confirmMessage = await interaction.fetchReply();

        massActionCache.set(confirmMessage.id, {
            type: 'massban',
            roleId: targetRole.id,
            reason,
            authorId: interaction.user.id,
            guildId: interaction.guild.id,
            expires: Date.now() + 60000
        });

        setTimeout(() => {
            if (massActionCache.has(confirmMessage.id)) {
                massActionCache.delete(confirmMessage.id);
                interaction.editReply({ 
                    components: [] 
                }).catch(() => {});
            }
        }, 60000);
    },

    handleComponent: async (interaction) => {
        if (!interaction.customId.startsWith('massban_')) return false;
        
        const actionData = massActionCache.get(interaction.message.id);
        if (!actionData) {
            return interaction.reply({
                content: 'This mass action has expired or is invalid.',
                ephemeral: true
            });
        }

        if (interaction.user.id !== actionData.authorId) {
            return interaction.reply({
                content: 'Only the user who initiated this action can confirm it.',
                ephemeral: true
            });
        }

        if (interaction.customId === 'massban_cancel') {
            massActionCache.delete(interaction.message.id);
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ Mass ban cancelled.')
                ],
                components: []
            });
            return true;
        }

        if (interaction.customId.startsWith('massban_confirm_')) {
            await interaction.deferUpdate();
            
            const guild = interaction.client.guilds.cache.get(actionData.guildId);
            const targetRole = guild.roles.cache.get(actionData.roleId);
            
            if (!targetRole) {
                massActionCache.delete(interaction.message.id);
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription('❌ The role for this mass action no longer exists.')
                    ],
                    components: []
                });
                return true;
            }

            const members = targetRole.members;
            
            const progressEmbed = new EmbedBuilder()
                .setTitle('🔄 Processing Mass Ban')
                .setDescription(`Banning ${members.size} members...`)
                .setColor(0x0099FF);
            
            await interaction.editReply({ 
                embeds: [progressEmbed], 
                components: [] 
            });

            let successful = 0;
            let failed = 0;
            let dmFailed = 0;

            for (const member of members.values()) {
                try {
                    if (member.id === interaction.client.user.id || 
                        member.roles.highest.position >= interaction.member.roles.highest.position) {
                        failed++;
                        continue;
                    }
                    
                    try {
                        const dmEmbed = new EmbedBuilder()
                            .setTitle('🔨 You have been banned')
                            .setDescription(`You were banned from **${guild.name}**`)
                            .addFields(
                                { name: 'Reason', value: actionData.reason },
                                { name: 'Moderator', value: interaction.user.tag },
                                { name: 'Type', value: 'Mass ban (role-based)' }
                            )
                            .setColor(0xFF0000)
                            .setTimestamp();

                        await member.send({ embeds: [dmEmbed] });
                    } catch (dmError) {
                        dmFailed++;
                    }
                    
                    await member.ban({ 
                        reason: `Mass ban: ${actionData.reason} | Moderator: ${interaction.user.tag}` 
                    });
                    successful++;
                } catch (error) {
                    failed++;
                }
            }
            
            const resultEmbed = new EmbedBuilder()
                .setTitle('✅ Mass Ban Complete')
                .setDescription(`Banned ${successful} members with the role ${targetRole.name}.`)
                .addFields(
                    { name: 'Successful', value: successful.toString(), inline: true },
                    { name: 'Failed', value: failed.toString(), inline: true },
                    { name: 'DM Failed', value: dmFailed.toString(), inline: true },
                    { name: 'Reason', value: actionData.reason }
                )
                .setColor(0x00FF00)
                .setTimestamp();
            
            await interaction.editReply({ embeds: [resultEmbed] });
            
            massActionCache.delete(interaction.message.id);
            return true;
        }
        
        return false;
    }
};

setInterval(() => {
    const now = Date.now();
    for (const [messageId, data] of massActionCache.entries()) {
        if (now > data.expires) {
            massActionCache.delete(messageId);
        }
    }
}, 60000);