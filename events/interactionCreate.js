const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  PermissionFlagsBits 
} = require('discord.js');
const db = require('../utils/db');
const BackupLoader = require('../utils/backupLoader');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction, client);
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction, client);
      return;
    }

    if (await handleBackupSystem(interaction, client)) return;

    if (await handleTicketSystem(interaction)) return;

    if (await handleReviewSystem(interaction, client)) return;

    if (await handleTagSystem(interaction, client)) return;

    if (await handlePsetSystem(interaction, client)) return;

    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      console.log(`🔘 Component interaction (unhandled): ${interaction.customId} by ${interaction.user.tag}`);
    }
  }
};

async function handlePsetSystem(interaction, client) {
  if (interaction.isButton() && (
    interaction.customId === 'test_prefix' ||
    interaction.customId === 'reset_prefix' ||
    interaction.customId === 'reset_prefix_current'
  )) {
    const psetCommand = client.prefixCommands.get('pset');
    if (psetCommand && psetCommand.handleComponent) {
      await psetCommand.handleComponent(interaction);
      return true;
    }
  }
  return false;
}

async function handleSlashCommand(interaction, client) {
  const command = client.slashCommands.get(interaction.commandName);
  
  if (!command) return;
  
  try {
    console.log(`➡️ Slash command: ${interaction.commandName} by ${interaction.user.tag}`);
    await command.execute(interaction);
  } catch (error) {
    console.error(`Slash command error: ${interaction.commandName}`, error);
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ 
        content: '❌ There was an error executing this command.', 
        flags: 64
      });
    } else {
      await interaction.reply({ 
        content: '❌ There was an error executing this command.', 
        flags: 64
      });
    }
  }
}

async function handleModalSubmit(interaction, client) {
  console.log(`📝 Modal submitted: ${interaction.customId} by ${interaction.user.tag}`);
  
  try {
    let handled = false;
    for (const [commandName, command] of client.prefixCommands) {
      if (command.handleComponent && typeof command.handleComponent === 'function') {
        const result = await command.handleComponent(interaction);
        if (result) {
          handled = true;
          break;
        }
      }
    }
    
    if (!handled) {
      console.log(`❌ No handler found for modal: ${interaction.customId}`);
      if (!interaction.replied) {
        await interaction.reply({ 
          content: '❌ This modal is no longer active.', 
          flags: 64
        });
      }
    }
  } catch (error) {
    console.error('Modal submission error:', error);
    if (!interaction.replied) {
      await interaction.reply({ 
        content: '❌ There was an error processing your submission.', 
        flags: 64
      });
    }
  }
}

async function handleTicketSystem(interaction) {
  if (interaction.isStringSelectMenu() && interaction.customId === 'create_ticket_category') {
    await handleTicketCategorySelect(interaction);
    return true;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'remove_category_select') {
    await handleRemoveCategorySelect(interaction);
    return true;
  }

  if (interaction.isButton() && (interaction.customId.startsWith('close_ticket_') || interaction.customId.startsWith('claim_ticket_'))) {
    await handleTicketButtons(interaction);
    return true;
  }

  return false;
}

async function handleReviewSystem(interaction, client) {
  if (interaction.isStringSelectMenu() && interaction.customId === 'review_service_select') {
    const reviewCommand = client.prefixCommands.get('review');
    if (reviewCommand && reviewCommand.handleComponent) {
      await reviewCommand.handleComponent(interaction);
      return true;
    }
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('review_modal_')) {
    const reviewCommand = client.prefixCommands.get('review');
    if (reviewCommand && reviewCommand.handleComponent) {
      await reviewCommand.handleComponent(interaction);
      return true;
    }
  }

  if (interaction.isButton() && (
    interaction.customId === 'test_review_channel' || 
    interaction.customId === 'view_review_stats' ||
    interaction.customId === 'change_review_channel'
  )) {
    const rchannelCommand = client.prefixCommands.get('rchannel');
    if (rchannelCommand && rchannelCommand.handleComponent) {
      await rchannelCommand.handleComponent(interaction);
      return true;
    }
  }

  return false;
}

async function handleTagSystem(interaction, client) {
  if (interaction.isStringSelectMenu() && interaction.customId === 'tag_list_select') {
    const tagCommand = client.prefixCommands.get('tag');
    if (tagCommand && tagCommand.handleComponent) {
      await tagCommand.handleComponent(interaction);
      return true;
    }
  }

  if (interaction.isButton() && (
    interaction.customId.startsWith('tag_delete_') ||
    interaction.customId === 'tag_create_button' ||
    interaction.customId === 'tag_list'
  )) {
    const tagCommand = client.prefixCommands.get('tag');
    if (tagCommand && tagCommand.handleComponent) {
      await tagCommand.handleComponent(interaction);
      return true;
    }
  }

  return false;
}

async function handleTicketCategorySelect(interaction) {
  console.log(`🎫 Ticket category selected by ${interaction.user.tag}`);
  
  await interaction.deferReply({ flags: 64 });
  
  try {
    const categoryId = interaction.values[0];
    
    const [category] = await db.executeWithRetry(
      'SELECT * FROM ticket_categories WHERE id = ? AND guild_id = ?',
      [categoryId, interaction.guild.id]
    );

    if (!category) {
      return await interaction.editReply({ 
        content: '❌ Category not found.' 
      });
    }

    const [panelConfig] = await db.executeWithRetry(
      'SELECT * FROM ticket_panels WHERE guild_id = ?',
      [interaction.guild.id]
    );

    if (!panelConfig) {
      return await interaction.editReply({ 
        content: '❌ Ticket system not set up. Please run tsetup first.' 
      });
    }

    const ticketId = `T${Date.now().toString().slice(-6)}`;
    
    let categoryChannel = null;
    if (category.category_id) {
      categoryChannel = interaction.guild.channels.cache.get(category.category_id);
    }
    if (!categoryChannel && panelConfig.category_id) {
      categoryChannel = interaction.guild.channels.cache.get(panelConfig.category_id);
    }
    if (!categoryChannel) {
      categoryChannel = interaction.channel.parent;
    }

    const username = interaction.user.username.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().substring(0, 20);
    
    const ticketChannel = await interaction.guild.channels.create({
      name: `ticket-${username}`,
      type: 0,
      parent: categoryChannel,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
      ],
    });

    if (panelConfig.support_roles) {
      try {
        const supportRoles = JSON.parse(panelConfig.support_roles);
        for (const roleId of supportRoles) {
          const role = interaction.guild.roles.cache.get(roleId);
          if (role) {
            await ticketChannel.permissionOverwrites.create(role, {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true
            });
          }
        }
      } catch (error) {
        console.error('Error adding support roles:', error);
      }
    }

    await db.executeWithRetry(
      'INSERT INTO tickets (guild_id, user_id, channel_id, ticket_id, category) VALUES (?, ?, ?, ?, ?)',
      [interaction.guild.id, interaction.user.id, ticketChannel.id, ticketId, category.name]
    );

    const ticketEmbed = new EmbedBuilder()
      .setTitle(`Ticket ${ticketId} - ${category.name}`)
      .setDescription(`Hello ${interaction.user}! Support will be with you shortly.\n\n**Category:** ${category.name}\n${category.description ? `**Description:** ${category.description}\n\n` : ''}Please describe your issue and our team will assist you.`)
      .setColor(0x00AE86)
      .setTimestamp();

    const closeButton = new ButtonBuilder()
      .setCustomId(`close_ticket_${ticketChannel.id}`)
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒');

    const claimButton = new ButtonBuilder()
      .setCustomId(`claim_ticket_${ticketChannel.id}`)
      .setLabel('Claim Ticket')
      .setStyle(ButtonStyle.Success)
      .setEmoji('👆');

    const row = new ActionRowBuilder().addComponents(claimButton, closeButton);

    await ticketChannel.send({ 
      content: `${interaction.user} ${panelConfig.support_roles ? `<@&${JSON.parse(panelConfig.support_roles)[0]}>` : ''}`,
      embeds: [ticketEmbed],
      components: [row]
    });

    await interaction.editReply({ 
      content: `✅ Ticket created: ${ticketChannel}` 
    });

  } catch (error) {
    console.error('Ticket creation error:', error);
    
    let errorMessage = '❌ Error creating ticket. Please try again.';
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      errorMessage = '❌ Database schema mismatch. Please contact bot administrator.';
    }
    
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ 
        content: errorMessage 
      });
    } else {
      await interaction.reply({ 
        content: errorMessage,
        flags: 64
      });
    }
  }
}

async function handleRemoveCategorySelect(interaction) {
  console.log(`🗑️ Remove category selected by ${interaction.user.tag}`);
  
  await interaction.deferReply({ flags: 64 });
  
  try {
    const categoryIds = interaction.values;

    for (const categoryId of categoryIds) {
      await db.executeWithRetry(
        'DELETE FROM ticket_categories WHERE id = ? AND guild_id = ?',
        [categoryId, interaction.guild.id]
      );
    }

    await interaction.editReply({ 
      content: `✅ ${categoryIds.length} category(s) removed successfully!` 
    });

  } catch (error) {
    console.error('Remove category error:', error);
    await interaction.editReply({ 
      content: '❌ Error removing categories.' 
    });
  }
}

async function handleTicketButtons(interaction) {
  console.log(`🔘 Ticket button: ${interaction.customId} by ${interaction.user.tag}`);
  
  await interaction.deferReply({ flags: 64 });
  
  if (interaction.customId.startsWith('close_ticket_')) {
    await handleCloseTicket(interaction);
  } else if (interaction.customId.startsWith('claim_ticket_')) {
    await handleClaimTicket(interaction);
  }
}

async function handleCloseTicket(interaction) {
  const channelId = interaction.customId.replace('close_ticket_', '');
  const ticketChannel = interaction.guild.channels.cache.get(channelId);
  
  if (!ticketChannel) {
    return await interaction.editReply({ 
      content: '❌ Ticket channel not found or already deleted.' 
    });
  }

  const [ticket] = await db.executeWithRetry(
    'SELECT * FROM tickets WHERE channel_id = ? AND status = "open"',
    [channelId]
  );

  if (!ticket) {
    return await interaction.editReply({ 
      content: '❌ Open ticket not found in database.' 
    });
  }

  try {
    await db.executeWithRetry(
      'UPDATE tickets SET status = "closed", closed_at = NOW() WHERE channel_id = ?',
      [channelId]
    );

    try {
      const creator = await interaction.guild.members.fetch(ticket.user_id);
      const dmEmbed = new EmbedBuilder()
        .setTitle(`Ticket Closed - ${ticket.ticket_id}`)
        .setDescription(`Your ticket in ${interaction.guild.name} has been closed.`)
        .addFields(
          { name: 'Closed by', value: interaction.user.tag, inline: true },
          { name: 'Category', value: ticket.category || 'General', inline: true }
        )
        .setColor(0xFF0000)
        .setTimestamp();

      await creator.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.log('Note: Could not send DM to ticket creator (user may have DMs disabled)');
    }

    try {
      const messages = await ticketChannel.messages.fetch({ limit: 10 });
      const ticketMessage = messages.find(msg => 
        msg.components.length > 0 && 
        msg.embeds.length > 0 &&
        msg.embeds[0].title?.includes('Ticket')
      );
      
      if (ticketMessage) {
        await ticketMessage.edit({ components: [] });
      }
    } catch (msgError) {
      console.log('Could not remove buttons from ticket message:', msgError.message);
    }

    const closeMessage = await ticketChannel.send('✅ Ticket closed. This channel will be deleted in 5 seconds.');
    setTimeout(async () => {
      try {
        await ticketChannel.delete();
      } catch (deleteError) {
        console.log('Could not delete ticket channel:', deleteError.message);
      }
    }, 5000);

    await interaction.editReply({ 
      content: '✅ Ticket closed successfully.' 
    });

  } catch (error) {
    console.error('Ticket close error:', error);
    await interaction.editReply({ 
      content: '❌ Error closing ticket.' 
    });
  }
}

async function handleClaimTicket(interaction) {
  const channelId = interaction.customId.replace('claim_ticket_', '');
  const ticketChannel = interaction.guild.channels.cache.get(channelId);
  
  if (!ticketChannel) {
    return await interaction.editReply({ 
      content: '❌ Ticket channel not found or has been deleted.' 
    });
  }

  const [ticket] = await db.executeWithRetry(
    'SELECT * FROM tickets WHERE channel_id = ? AND status = "open"',
    [channelId]
  );

  if (!ticket) {
    return await interaction.editReply({ 
      content: '❌ Open ticket not found. It may have been closed.' 
    });
  }

  if (ticket.claimed_by) {
    const claimer = await interaction.guild.members.fetch(ticket.claimed_by).catch(() => null);
    return await interaction.editReply({ 
      content: `❌ This ticket is already claimed by ${claimer ? claimer.user.tag : 'another staff member'}.` 
    });
  }

  try {
    await db.executeWithRetry(
      'UPDATE tickets SET claimed_by = ? WHERE channel_id = ?',
      [interaction.user.id, channelId]
    );

    await ticketChannel.setName(`claimed-${ticketChannel.name}`);

    const claimEmbed = new EmbedBuilder()
      .setDescription(`🎯 This ticket has been claimed by ${interaction.user}`)
      .setColor(0x00FF00)
      .setTimestamp();

    await ticketChannel.send({ embeds: [claimEmbed] });

    await interaction.editReply({ 
      content: '✅ Ticket claimed successfully!' 
    });

  } catch (error) {
    console.error('Ticket claim error:', error);
    await interaction.editReply({ 
      content: '❌ Error claiming ticket.' 
    });
  }
}

async function handleBackupSystem(interaction, client) {
  if (interaction.isStringSelectMenu() && (
    interaction.customId === 'bview_select' ||
    interaction.customId === 'bload_select' || 
    interaction.customId === 'bdel_select'
  )) {
    await handleBackupActionSelect(interaction, client);
    return true;
  }

  if (interaction.isButton() && (
    interaction.customId.startsWith('bload_confirm_') ||
    interaction.customId.startsWith('bdel_confirm_') ||
    interaction.customId === 'bload_cancel' ||
    interaction.customId === 'bdel_cancel'
  )) {
    await handleBackupConfirmation(interaction, client);
    return true;
  }

  return false;
}

async function handleBackupActionSelect(interaction, client) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: 64 });
  }

  const backupId = interaction.values[0];
  const action = interaction.customId.replace('_select', '');

  try {
    const [backup] = await db.executeWithRetry(
      'SELECT * FROM backups WHERE id = ? AND guild_id = ?',
      [backupId, interaction.guild.id]
    );

    if (!backup) {
      return await interaction.editReply({ 
        content: '❌ Backup not found.'
      });
    }

    if (action === 'bview') {
      const backupData = JSON.parse(backup.data);
      const embed = new EmbedBuilder()
        .setTitle(`📊 Backup: ${backup.name}`)
        .setColor(0x3498DB)
        .addFields(
          { name: 'Backup ID', value: `\`${backup.id}\``, inline: true },
          { name: 'Created', value: new Date(backup.created_at).toLocaleString(), inline: true },
          { name: 'Data Size', value: `${Math.round(JSON.stringify(backupData).length / 1024)} KB`, inline: true }
        );

      if (backupData.server_structure) {
        const server = backupData.server_structure;
        embed.addFields(
          { name: '🎭 Roles', value: server.roles?.length.toString() || '0', inline: true },
          { name: '📁 Channels', value: server.channels?.length.toString() || '0', inline: true },
          { name: '😊 Emojis', value: server.emojis?.length.toString() || '0', inline: true }
        );
      }

      await interaction.editReply({ embeds: [embed] });

    } else if (action === 'bload' || action === 'bdel') {
      const actionName = action === 'bload' ? 'Load' : 'Delete';
      const color = action === 'bload' ? 0xF39C12 : 0xE74C3C;
      
      const embed = new EmbedBuilder()
        .setTitle(`Confirm ${actionName} Backup`)
        .setDescription(`You are about to **${actionName.toLowerCase()}** the backup:\n**${backup.name}**`)
        .setColor(color)
        .addFields(
          { name: 'Backup ID', value: `\`${backup.id}\``, inline: true },
          { name: 'Created', value: new Date(backup.created_at).toLocaleString(), inline: true },
          { name: 'Data Size', value: `${Math.round(JSON.stringify(JSON.parse(backup.data)).length / 1024)} KB`, inline: true }
        )
        .setFooter({ text: `This action cannot be undone!` });

      const confirmButton = new ButtonBuilder()
        .setCustomId(`${action}_confirm_${backup.id}`)
        .setLabel(`Yes, ${actionName.toLowerCase()} this backup`)
        .setStyle(action === 'bload' ? ButtonStyle.Success : ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder()
        .setCustomId(`${action}_cancel`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

      await interaction.editReply({ 
        embeds: [embed], 
        components: [row]
      });
    }

  } catch (error) {
    console.error('Backup action error:', error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ 
        content: '❌ Error processing backup action.'
      });
    } else {
      await interaction.reply({ 
        content: '❌ Error processing backup action.', 
        flags: 64 
      });
    }
  }
}

async function handleBackupConfirmation(interaction, client) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
    }

    if (interaction.customId.endsWith('_cancel')) {
        await interaction.editReply({
            content: '❌ Action cancelled.',
            embeds: [],
            components: []
        });
        return;
    }

    const parts = interaction.customId.split('_');
    const action = parts[0];
    const backupId = parts[2];

    try {
        if (action === 'bdel') {
            await db.executeWithRetry(
                'DELETE FROM backups WHERE id = ? AND guild_id = ?',
                [backupId, interaction.guild.id]
            );

            await interaction.editReply({
                content: '✅ Backup deleted successfully.',
                embeds: [],
                components: []
            });

        } else if (action === 'bload') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.editReply({
                    content: '❌ You need administrator permissions to load backups.',
                    embeds: [],
                    components: []
                });
            }

            const loadingEmbed = new EmbedBuilder()
                .setTitle('🔄 Loading Backup')
                .setDescription('Starting backup restoration process...')
                .setColor(0xF39C12)
                .setTimestamp();

            try {
                await interaction.editReply({
                    embeds: [loadingEmbed],
                    components: []
                });
            } catch (error) {
                if (error.code === 10008) {
                    await interaction.followUp({ 
                        embeds: [loadingEmbed],
                        ephemeral: false
                    });
                } else {
                    throw error;
                }
            }

            const backupLoader = new BackupLoader(client);
            await backupLoader.loadBackup(interaction, backupId);
        }

    } catch (error) {
        console.error('Backup confirmation error:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Backup Restoration Failed')
            .setDescription(`Error: ${error.message}`)
            .setColor(0xFF0000)
            .setTimestamp();

        try {
            await interaction.editReply({
                embeds: [errorEmbed],
                components: []
            });
        } catch (editError) {
            if (editError.code === 10008) {
                await interaction.followUp({ 
                    embeds: [errorEmbed],
                    ephemeral: false
                });
            } else {
                console.error('Could not send error message:', editError);
            }
        }
    }
}
