const { PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
  name: 'tag',
  description: 'Create and manage message tags',
  usage: 'tag create <name> <content> | tag send <name> | tag list | tag delete <name>',
  async execute(message, args) {
    if (!args[0]) {
      return await showTagMenu(message);
    }

    const subcommand = args[0].toLowerCase();
    
    switch (subcommand) {
      case 'create':
        await handleTagCreate(message, args.slice(1));
        break;
      case 'send':
        await handleTagSend(message, args.slice(1));
        break;
      case 'list':
        await handleTagList(message);
        break;
      case 'delete':
        await handleTagDelete(message, args.slice(1));
        break;
      case 'info':
        await handleTagInfo(message, args.slice(1));
        break;
      default:
        await handleTagSend(message, args);
        break;
    }
  },

  async handleComponent(interaction) {
    if (interaction.isStringSelectMenu() && interaction.customId === 'tag_list_select') {
      await handleTagListSelect(interaction);
    }
    
    if (interaction.isButton() && interaction.customId.startsWith('tag_delete_')) {
      await handleTagDeleteButton(interaction);
    }
    
    if (interaction.isButton() && interaction.customId === 'tag_create_button') {
      await handleTagCreateButton(interaction);
    }
  }
};

async function showTagMenu(message) {
  const embed = new EmbedBuilder()
    .setTitle('🏷️ Tag System')
    .setDescription('Create and manage message tags for quick responses.')
    .setColor(0x00AE86)
    .addFields(
      { name: '📝 Create Tag', value: '`tag create <name> <content>`', inline: true },
      { name: '📤 Send Tag', value: '`tag send <name>` or just `tag <name>`', inline: true },
      { name: '📋 List Tags', value: '`tag list`', inline: true },
      { name: '🗑️ Delete Tag', value: '`tag delete <name>`', inline: true },
      { name: 'ℹ️ Tag Info', value: '`tag info <name>`', inline: true }
    )
    .setFooter({ text: 'Tags are server-specific and can be used for quick responses' });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('tag_create_button')
        .setLabel('Create Tag')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📝'),
      new ButtonBuilder()
        .setCustomId('tag_list')
        .setLabel('View Tags')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📋')
    );

  await message.channel.send({ 
    embeds: [embed], 
    components: [row] 
  });
}

async function handleTagCreate(message, args) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    return message.channel.send('❌ You need `Manage Messages` permission to create tags.');
  }

  if (args.length < 2) {
    return message.channel.send('❌ Usage: `tag create <name> <content>`\nExample: `tag create btw by the way`');
  }

  const name = args[0].toLowerCase();
  const content = args.slice(1).join(' ');

  if (name.length > 50) {
    return message.channel.send('❌ Tag name must be 50 characters or less.');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return message.channel.send('❌ Tag name can only contain letters, numbers, hyphens, and underscores.');
  }

  if (content.length > 2000) {
    return message.channel.send('❌ Tag content must be 2000 characters or less.');
  }

  if (content.length < 1) {
    return message.channel.send('❌ Tag content cannot be empty.');
  }

  try {
    const [existingTag] = await db.executeWithRetry(
      'SELECT * FROM tags WHERE guild_id = ? AND name = ?',
      [message.guild.id, name]
    );

    if (existingTag) {
      return message.channel.send(`❌ Tag \`${name}\` already exists. Use a different name.`);
    }

    await db.executeWithRetry(
      'INSERT INTO tags (guild_id, name, content, created_by) VALUES (?, ?, ?, ?)',
      [message.guild.id, name, content, message.author.id]
    );

    const embed = new EmbedBuilder()
      .setTitle('✅ Tag Created')
      .setDescription(`Tag \`${name}\` has been created successfully.`)
      .addFields(
        { name: 'Name', value: `\`${name}\``, inline: true },
        { name: 'Content', value: content.length > 100 ? content.substring(0, 100) + '...' : content, inline: false },
        { name: 'Usage', value: `\`tag send ${name}\` or \`tag ${name}\``, inline: true }
      )
      .setColor(0x00AE86)
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });

  } catch (error) {
    console.error('Tag creation error:', error);
    message.channel.send('❌ Failed to create tag. Please try again.');
  }
}

async function handleTagSend(message, args) {
  if (!args[0]) {
    return message.channel.send('❌ Usage: `tag send <name>` or `tag <name>`');
  }

  const name = args[0].toLowerCase();

  try {
    const [tag] = await db.executeWithRetry(
      'SELECT * FROM tags WHERE guild_id = ? AND name = ?',
      [message.guild.id, name]
    );

    if (!tag) {
      return message.channel.send(`❌ Tag \`${name}\` not found. Use \`tag list\` to see available tags.`);
    }

    await db.executeWithRetry(
      'UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?',
      [tag.id]
    );

    await message.channel.send(tag.content);

    if (message.deletable) {
      await message.delete().catch(() => {});
    }

  } catch (error) {
    console.error('Tag send error:', error);
    message.channel.send('❌ Failed to send tag. Please try again.');
  }
}

async function handleTagList(message) {
  try {
    const tags = await db.executeWithRetry(
      'SELECT * FROM tags WHERE guild_id = ? ORDER BY usage_count DESC, name ASC',
      [message.guild.id]
    );

    if (tags.length === 0) {
      return message.channel.send('❌ No tags found for this server. Use `tag create <name> <content>` to create one.');
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏷️ Tags for ${message.guild.name}`)
      .setDescription(`Total tags: **${tags.length}**`)
      .setColor(0x00AE86)
      .setFooter({ text: 'Use tag send <name> to use a tag' });

    if (tags.length > 10) {
      const options = tags.slice(0, 25).map(tag => ({
        label: tag.name,
        value: tag.id.toString(),
        description: tag.content.length > 50 ? tag.content.substring(0, 50) + '...' : tag.content,
        emoji: '🏷️'
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('tag_list_select')
        .setPlaceholder('Select a tag to view info...')
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      embed.setDescription(`Total tags: **${tags.length}**\n\nSelect a tag from the dropdown below to view details:`);

      await message.channel.send({ 
        embeds: [embed], 
        components: [row] 
      });
    } else {
      tags.forEach(tag => {
        embed.addFields({
          name: `🏷️ ${tag.name} (Used ${tag.usage_count} times)`,
          value: tag.content.length > 100 ? tag.content.substring(0, 100) + '...' : tag.content,
          inline: false
        });
      });

      await message.channel.send({ embeds: [embed] });
    }

  } catch (error) {
    console.error('Tag list error:', error);
    message.channel.send('❌ Failed to retrieve tags. Please try again.');
  }
}

async function handleTagDelete(message, args) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    return message.channel.send('❌ You need `Manage Messages` permission to delete tags.');
  }

  if (!args[0]) {
    return message.channel.send('❌ Usage: `tag delete <name>`');
  }

  const name = args[0].toLowerCase();

  try {
    const [tag] = await db.executeWithRetry(
      'SELECT * FROM tags WHERE guild_id = ? AND name = ?',
      [message.guild.id, name]
    );

    if (!tag) {
      return message.channel.send(`❌ Tag \`${name}\` not found.`);
    }

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Delete Tag')
      .setDescription(`Are you sure you want to delete the tag \`${name}\`?`)
      .addFields(
        { name: 'Content', value: tag.content.length > 100 ? tag.content.substring(0, 100) + '...' : tag.content },
        { name: 'Usage Count', value: `${tag.usage_count} times`, inline: true },
        { name: 'Created By', value: `<@${tag.created_by}>`, inline: true }
      )
      .setColor(0xFF0000)
      .setTimestamp();

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`tag_delete_confirm_${tag.id}`)
          .setLabel('Delete')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️'),
        new ButtonBuilder()
          .setCustomId('tag_delete_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❌')
      );

    const reply = await message.channel.send({ 
      embeds: [embed], 
      components: [row] 
    });

    const collector = reply.createMessageComponentCollector({ 
      time: 30000 
    });

    collector.on('collect', async (interaction) => {
      if (interaction.customId === `tag_delete_confirm_${tag.id}`) {
        await db.executeWithRetry(
          'DELETE FROM tags WHERE id = ?',
          [tag.id]
        );

        await interaction.update({
          content: `✅ Tag \`${name}\` has been deleted.`,
          embeds: [],
          components: []
        });
      } else if (interaction.customId === 'tag_delete_cancel') {
        await interaction.update({
          content: '❌ Tag deletion cancelled.',
          embeds: [],
          components: []
        });
      }
    });

    collector.on('end', () => {
      reply.edit({ components: [] }).catch(() => {});
    });

  } catch (error) {
    console.error('Tag delete error:', error);
    message.channel.send('❌ Failed to delete tag. Please try again.');
  }
}

async function handleTagInfo(message, args) {
  if (!args[0]) {
    return message.channel.send('❌ Usage: `tag info <name>`');
  }

  const name = args[0].toLowerCase();

  try {
    const [tag] = await db.executeWithRetry(
      'SELECT * FROM tags WHERE guild_id = ? AND name = ?',
      [message.guild.id, name]
    );

    if (!tag) {
      return message.channel.send(`❌ Tag \`${name}\` not found.`);
    }

    const creator = await message.guild.members.fetch(tag.created_by).catch(() => null);

    const embed = new EmbedBuilder()
      .setTitle(`🏷️ Tag Info: ${tag.name}`)
      .setDescription(tag.content)
      .addFields(
        { name: 'Usage Count', value: `${tag.usage_count} times`, inline: true },
        { name: 'Created By', value: creator ? creator.user.tag : 'Unknown User', inline: true },
        { name: 'Created At', value: `<t:${Math.floor(new Date(tag.created_at).getTime() / 1000)}:R>`, inline: true }
      )
      .setColor(0x00AE86)
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });

  } catch (error) {
    console.error('Tag info error:', error);
    message.channel.send('❌ Failed to get tag info. Please try again.');
  }
}

async function handleTagListSelect(interaction) {
  await interaction.deferUpdate();
  
  const tagId = interaction.values[0];

  try {
    const [tag] = await db.executeWithRetry(
      'SELECT * FROM tags WHERE id = ?',
      [tagId]
    );

    if (!tag) {
      return await interaction.followUp({ 
        content: '❌ Tag not found.', 
        flags: 64 
      });
    }

    const creator = await interaction.guild.members.fetch(tag.created_by).catch(() => null);

    const embed = new EmbedBuilder()
      .setTitle(`🏷️ ${tag.name}`)
      .setDescription(tag.content)
      .addFields(
        { name: 'Usage Count', value: `${tag.usage_count} times`, inline: true },
        { name: 'Created By', value: creator ? creator.user.tag : 'Unknown User', inline: true },
        { name: 'Created At', value: `<t:${Math.floor(new Date(tag.created_at).getTime() / 1000)}:R>`, inline: true }
      )
      .setColor(0x00AE86)
      .setFooter({ text: 'Use "tag send name" to use this tag' });

    await interaction.followUp({ 
      embeds: [embed], 
      flags: 64 
    });

  } catch (error) {
    console.error('Tag list select error:', error);
    await interaction.followUp({ 
      content: '❌ Failed to get tag info.', 
      flags: 64 
    });
  }
}

async function handleTagDeleteButton(interaction) {
}

async function handleTagCreateButton(interaction) {
  await interaction.reply({
    content: 'To create a tag, use: `tag create <name> <content>`\nExample: `tag create btw by the way`',
    flags: 64
  });
}
