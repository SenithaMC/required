const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete multiple messages at once (max 1000)')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Number of messages to delete (1-1000)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(1000)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Permission Denied')
                .setDescription('You need the `Manage Messages` permission to use this command.')
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const amount = interaction.options.getInteger('amount');

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_purge')
                    .setLabel(`Purge ${amount} Messages`)
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_purge')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

        const confirmEmbed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('⚠️ Confirm Message Purge')
            .setDescription(`Are you sure you want to purge ${amount} messages? This action cannot be undone!`)
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
            if (i.customId === 'confirm_purge') {
                try {
                    row.components[0].setDisabled(true);
                    row.components[1].setDisabled(true);
                    
                    await i.update({ 
                        components: [row],
                        embeds: [new EmbedBuilder()
                            .setColor(0xFFFF00)
                            .setTitle('🔄 Purging Messages...')
                            .setDescription(`Deleting ${amount} messages. Please wait.`)
                            .setTimestamp()
                        ]
                    });

                    let deletedCount = 0;
                    let remaining = amount;
                    
                    while (remaining > 0) {
                        const batchSize = Math.min(remaining, 100);
                        const messages = await interaction.channel.messages.fetch({ limit: batchSize });
                        
                        const deletableMessages = messages.filter(msg => 
                            Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000
                        );
                        
                        if (deletableMessages.size === 0) break;
                        
                        await interaction.channel.bulkDelete(deletableMessages, true);
                        deletedCount += deletableMessages.size;
                        remaining -= deletableMessages.size;
                        
                        if (remaining > 0) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                    
                    const resultEmbed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('✅ Purge Complete')
                        .setDescription(`Successfully deleted ${deletedCount} messages!`)
                        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                        .setTimestamp();
                    
                    await i.followUp({ 
                        embeds: [resultEmbed],
                        components: [] 
                    });
                } catch (error) {
                    console.error(error);
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Error')
                        .setDescription('Failed to delete messages. Some messages may be too old to bulk delete.')
                        .setTimestamp();
                    
                    await i.followUp({ 
                        embeds: [errorEmbed],
                        ephemeral: true
                    });
                }
            } else if (i.customId === 'cancel_purge') {
                row.components[0].setDisabled(true);
                row.components[1].setDisabled(true);
                
                const cancelEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Operation Cancelled')
                    .setDescription('Message purge has been cancelled.')
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