const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nuke')
        .setDescription('Delete all messages in the channel by recreating it'),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels)) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Permission Denied')
                .setDescription('You need the `Manage Channels` permission to use this command.')
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_nuke')
                    .setLabel('Confirm Nuke')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_nuke')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

        const confirmEmbed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('⚠️ Confirm Channel Nuke')
            .setDescription('Are you sure you want to nuke this channel? This action cannot be undone!')
            .setTimestamp();

        const confirmMessage = await interaction.reply({ 
            embeds: [confirmEmbed], 
            components: [row],
            ephemeral: true,
            fetchReply: true
        });

        const filter = i => i.user.id === interaction.user.id;
        const collector = confirmMessage.createMessageComponentCollector({ 
            filter, 
            time: 15000
        });

        collector.on('collect', async i => {
            if (i.customId === 'confirm_nuke') {
                try {
                    row.components[0].setDisabled(true);
                    row.components[1].setDisabled(true);
                    
                    await i.update({ 
                        components: [row],
                        embeds: [new EmbedBuilder()
                            .setColor(0xFFFF00)
                            .setTitle('🔄 Nuking Channel...')
                            .setDescription('Please wait while the channel is being nuked.')
                            .setTimestamp()
                        ]
                    });

                    const position = interaction.channel.position;
                    const newChannel = await interaction.channel.clone();
                    await interaction.channel.delete();
                    await newChannel.setPosition(position);
                    
                    const successEmbed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('💣 Channel Nuked')
                        .setDescription('This channel has been successfully nuked!')
                        .setFooter({ text: `Nuked by ${interaction.user.tag}` })
                        .setTimestamp();
                    
                    await newChannel.send({ embeds: [successEmbed] });
                } catch (error) {
                    console.error(error);
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Error')
                        .setDescription('Failed to nuke the channel. Please try again.')
                        .setTimestamp();
                    
                    await i.followUp({ embeds: [errorEmbed], ephemeral: true });
                }
            } else if (i.customId === 'cancel_nuke') {
                row.components[0].setDisabled(true);
                row.components[1].setDisabled(true);
                
                const cancelEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Operation Cancelled')
                    .setDescription('Channel nuke has been cancelled.')
                    .setTimestamp();
                
                await i.update({ 
                    embeds: [cancelEmbed], 
                    components: [row] 
                });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                row.components[0].setDisabled(true);
                row.components[1].setDisabled(true);
                
                const timeoutEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('⏰ Timeout')
                    .setDescription('Confirmation timed out. Please try the command again.')
                    .setTimestamp();
                
                interaction.editReply({ 
                    embeds: [timeoutEmbed], 
                    components: [row] 
                }).catch(() => {});
            }
        });
    }
};