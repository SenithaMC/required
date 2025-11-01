const { EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
  name: 'review',
  description: 'Submit a review',
  async execute(message, args) {
    if (args.length < 3) {
      return message.channel.send('❌ Usage: `b!review <service> <rating/5> <description>`');
    }

    const service = args[0];
    const rating = parseInt(args[1]);
    const description = args.slice(2).join(' ');

    if (isNaN(rating) || rating < 1 || rating > 5) {
      return message.channel.send('❌ Rating must be a number between 1 and 5.');
    }

    try {
      // Save review to database
      await db.executeWithRetry(
        'INSERT INTO reviews (guild_id, user_id, service_bought, rating, description) VALUES (?, ?, ?, ?, ?)',
        [message.guild.id, message.author.id, service, rating, description]
      );

      // Get review channel
      const [reviewChannel] = await db.executeWithRetry(
        'SELECT channel_id FROM review_channels WHERE guild_id = ?',
        [message.guild.id]
      );

      if (reviewChannel) {
        const channel = message.guild.channels.cache.get(reviewChannel.channel_id);
        if (channel) {
          const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
          const embed = new EmbedBuilder()
            .setTitle(`Review: ${service}`)
            .setDescription(description)
            .addFields(
              { name: 'Rating', value: `${stars} (${rating}/5)`, inline: true },
              { name: 'Reviewed By', value: message.author.tag, inline: true }
            )
            .setColor(0xFFD700)
            .setTimestamp();

          await channel.send({ embeds: [embed] });
        }
      }

      message.channel.send('✅ Review submitted successfully!');
    } catch (error) {
      console.error('Review error:', error);
      message.channel.send('❌ Error submitting review.');
    }
  }
};