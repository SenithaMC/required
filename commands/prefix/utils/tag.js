const db = require('../../utils/db');

module.exports = {
  name: 'tag',
  description: 'Create or send tags',
  async execute(message, args) {
    if (args.length < 2) {
      return message.channel.send('❌ Usage: `b!tag <create|send> <name> [content]`');
    }

    const action = args[0].toLowerCase();
    const name = args[1].toLowerCase();

    if (action === 'create') {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return message.channel.send('❌ You need permission to manage messages to create tags.');
      }

      const content = args.slice(2).join(' ');
      if (!content) {
        return message.channel.send('❌ Please provide tag content.');
      }

      try {
        await db.executeWithRetry(
          'INSERT INTO tags (guild_id, name, content, created_by) VALUES (?, ?, ?, ?)',
          [message.guild.id, name, content, message.author.id]
        );

        message.channel.send(`✅ Tag "${name}" created successfully!`);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          message.channel.send('❌ A tag with that name already exists.');
        } else {
          console.error('Tag create error:', error);
          message.channel.send('❌ Error creating tag.');
        }
      }
    } else if (action === 'send') {
      try {
        const [tag] = await db.executeWithRetry(
          'SELECT * FROM tags WHERE guild_id = ? AND name = ?',
          [message.guild.id, name]
        );

        if (!tag) {
          return message.channel.send('❌ Tag not found.');
        }

        // Update usage count
        await db.executeWithRetry(
          'UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?',
          [tag.id]
        );

        message.channel.send(tag.content);
      } catch (error) {
        console.error('Tag send error:', error);
        message.channel.send('❌ Error sending tag.');
      }
    } else {
      message.channel.send('❌ Usage: `b!tag <create|send> <name> [content]`');
    }
  }
};