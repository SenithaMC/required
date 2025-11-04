const { 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
  name: 'tsetup',
  description: 'Set up the ticket system with categories',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.channel.send('❌ You need administrator permissions to set up tickets.');
    }

    try {
      const categories = await db.executeWithRetry(
        'SELECT * FROM ticket_categories WHERE guild_id = ?',
        [message.guild.id]
      );

      const config = require('../../../config');

      const embed = new EmbedBuilder()
        .setTitle('Ticket System Setup')
        .setDescription(`Manage your ticket categories here.\n\nUse \`${config.prefix}tsend\` to send the ticket panel to a channel after setting up categories.`)
        .setColor(0x00AE86)
        .addFields(
          { 
            name: 'Current Categories', 
            value: categories.length > 0 ? 
              categories.map(cat => `${cat.emoji} **${cat.name}** - ${cat.description || 'No description'}${cat.category_id ? `` : ''}`).join('\n\n') : 
              'No categories set up' 
          }
        );

      const row1 = new ActionRowBuilder();

      row1.addComponents(
        new ButtonBuilder()
          .setCustomId('add_category')
          .setLabel('Add Category')
          .setStyle(ButtonStyle.Success)
          .setEmoji('➕')
      );

      if (categories.length > 0) {
        row1.addComponents(
          new ButtonBuilder()
            .setCustomId('remove_category')
            .setLabel('Remove Category')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
        );
      }

      const setupMessage = await message.channel.send({ 
        embeds: [embed], 
        components: [row1] 
      });

      const collector = setupMessage.createMessageComponentCollector({ 
        time: 300000
      });

      collector.on('collect', async (interaction) => {
        if (interaction.user.id !== message.author.id) {
          return interaction.reply({ 
            content: '❌ This setup is not for you.', 
            flags: 64
          });
        }

        if (interaction.customId === 'add_category') {
          const modal = new ModalBuilder()
            .setCustomId('add_category_modal')
            .setTitle('Add Ticket Category');

          const nameInput = new TextInputBuilder()
            .setCustomId('category_name')
            .setLabel('Category Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., Support, Report, General')
            .setMaxLength(50)
            .setRequired(true);

          const descriptionInput = new TextInputBuilder()
            .setCustomId('category_description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Describe what this ticket category is for')
            .setMaxLength(200)
            .setRequired(true);

          const emojiInput = new TextInputBuilder()
            .setCustomId('category_emoji')
            .setLabel('Emoji')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('🎫 (leave empty for default)')
            .setMaxLength(10)
            .setRequired(false);

          const categoryIdInput = new TextInputBuilder()
            .setCustomId('category_id')
            .setLabel('Category ID (Optional)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Channel ID for ticket category (optional)')
            .setMaxLength(20)
            .setRequired(false);

          const firstActionRow = new ActionRowBuilder().addComponents(nameInput);
          const secondActionRow = new ActionRowBuilder().addComponents(descriptionInput);
          const thirdActionRow = new ActionRowBuilder().addComponents(emojiInput);
          const fourthActionRow = new ActionRowBuilder().addComponents(categoryIdInput);

          modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);

          await interaction.showModal(modal).catch(error => {
            console.error('Error showing modal:', error);
            interaction.reply({ 
              content: '❌ Failed to open modal. Please try again.', 
              flags: 64
            });
          });

        } else if (interaction.customId === 'remove_category') {
          const categories = await db.executeWithRetry(
            'SELECT * FROM ticket_categories WHERE guild_id = ?',
            [interaction.guild.id]
          );

          if (categories.length === 0) {
            return interaction.reply({ 
              content: '❌ No categories to remove.', 
              flags: 64
            });
          }

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('remove_category_select')
            .setPlaceholder('Select categories to remove')
            .setMinValues(1)
            .setMaxValues(categories.length)
            .addOptions(
              categories.map(cat => ({
                label: cat.name.length > 25 ? cat.name.substring(0, 25) : cat.name,
                value: cat.id.toString(),
                description: cat.description ? (cat.description.substring(0, 50) + (cat.description.length > 50 ? '...' : '')) : 'No description',
                emoji: cat.emoji || '🎫'
              }))
            );

          const row = new ActionRowBuilder().addComponents(selectMenu);

          await interaction.reply({
            content: 'Select categories to remove:',
            components: [row],
            flags: 64
          });
        }
      });

      collector.on('end', () => {
        setupMessage.edit({ components: [] }).catch(console.error);
      });

    } catch (error) {
      console.error('Ticket setup error:', error);
      message.channel.send('❌ Error setting up ticket system.');
    }
  },

  async handleComponent(interaction) {
    if (interaction.isModalSubmit()) {
      return await this.handleModalSubmit(interaction);
    }
    return false;
  },

  async handleModalSubmit(interaction) {
    try {
      if (interaction.customId === 'add_category_modal') {
        await interaction.deferReply({ flags: 64 });
        
        const name = interaction.fields.getTextInputValue('category_name');
        const description = interaction.fields.getTextInputValue('category_description');
        const emoji = interaction.fields.getTextInputValue('category_emoji') || '🎫';
        const categoryId = interaction.fields.getTextInputValue('category_id') || null;

        if (!name.trim()) {
          return await interaction.editReply({ 
            content: '❌ Category name cannot be empty.' 
          });
        }
        if (categoryId) {
          const categoryChannel = interaction.guild.channels.cache.get(categoryId);
          if (!categoryChannel) {
            return await interaction.editReply({ 
              content: '❌ Category ID is invalid. Please provide a valid channel ID.' 
            });
          }
        }

        await db.executeWithRetry(
          'INSERT INTO ticket_categories (guild_id, name, description, emoji, category_id) VALUES (?, ?, ?, ?, ?)',
          [interaction.guild.id, name.trim(), description.trim(), emoji.trim(), categoryId]
        );

        await interaction.editReply({ 
          content: `✅ Category "${name}" added successfully!${categoryId ? ` Tickets will be created in category: ${categoryId}` : ''}` 
        });

        return true;
      }
    } catch (error) {
      console.error('Modal submit error:', error);
      
      let errorMessage = '❌ Error adding category. Please try again.';
      if (error.code === 'ER_DUP_ENTRY') {
        errorMessage = '❌ A category with that name already exists.';
      } else if (error.code === 'ER_BAD_FIELD_ERROR') {
        errorMessage = '❌ Database column missing. Please restart the bot.';
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
      return true;
    }
    return false;
  }
};