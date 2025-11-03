const { PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
  name: 'rchannel',
  description: 'Set the channel where reviews will be posted',
  usage: 'rchannel <channel>',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.channel.send('❌ You need administrator permissions to use this command.');
    }

    if (!args[0]) {
      return await showCurrentChannel(message);
    }

    let channel;

    const channelMention = args[0].match(/<#(\d+)>/);
    if (channelMention) {
      channel = message.guild.channels.cache.get(channelMention[1]);
    } else {
      channel = message.guild.channels.cache.find(
        c => c.name === args[0] || c.id === args[0]
      );
    }

    if (!channel) {
      return message.channel.send('❌ Channel not found. Please mention a channel or provide a valid channel ID/name.');
    }

    if (channel.type !== 0) {
      return message.channel.send('❌ Please select a text channel.');
    }

    try {
      const permissions = channel.permissionsFor(message.guild.members.me);
      if (!permissions.has(PermissionsBitField.Flags.SendMessages) || 
          !permissions.has(PermissionsBitField.Flags.EmbedLinks) ||
          !permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return message.channel.send(`❌ I need \`Send Messages\`, \`Embed Links\`, and \`Manage Messages\` permissions in ${channel} to post and manage reviews.`);
      }

      await db.executeWithRetry(
        `INSERT INTO review_channels (guild_id, channel_id) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE channel_id = ?`,
        [message.guild.id, channel.id, channel.id]
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ Review Channel Set')
        .setDescription(`Reviews will now be posted in ${channel}`)
        .addFields(
          { name: 'Channel', value: `${channel}`, inline: true },
          { name: 'Channel ID', value: `\`${channel.id}\``, inline: true }
        )
        .setColor(0x00AE86)
        .setTimestamp();

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('test_review_channel')
            .setLabel('Test Review')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🧪'),
          new ButtonBuilder()
            .setCustomId('view_review_stats')
            .setLabel('View Stats')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📊')
        );

      const reply = await message.channel.send({ 
        embeds: [embed], 
        components: [row] 
      });

      const collector = reply.createMessageComponentCollector({ 
        time: 60000 
      });

      collector.on('collect', async (interaction) => {
        if (interaction.customId === 'test_review_channel') {
          await handleTestReview(interaction, channel);
        } else if (interaction.customId === 'view_review_stats') {
          await handleViewStats(interaction);
        }
      });

      collector.on('end', () => {
        reply.edit({ components: [] }).catch(() => {});
      });

    } catch (error) {
      console.error('rchannel command error:', error);
      message.channel.send('❌ Failed to set review channel. Please try again.');
    }
  },

  async handleComponent(interaction) {
    if (interaction.customId === 'test_review_channel') {
      await handleTestReview(interaction);
    } else if (interaction.customId === 'view_review_stats') {
      await handleViewStats(interaction);
    }
  }
};

async function showCurrentChannel(message) {
  try {
    const [currentChannel] = await db.executeWithRetry(
      'SELECT * FROM review_channels WHERE guild_id = ?',
      [message.guild.id]
    );

    if (!currentChannel) {
      return message.channel.send('❌ No review channel set. Use `rchannel <channel>` to set one.');
    }

    const embed = new EmbedBuilder()
      .setTitle('📝 Current Review Channel')
      .setDescription(`Current review channel: <#${currentChannel.channel_id}>`)
      .addFields(
        { name: 'Channel ID', value: `\`${currentChannel.channel_id}\``, inline: true },
        { name: 'Set At', value: `<t:${Math.floor(new Date(currentChannel.created_at).getTime() / 1000)}:R>`, inline: true }
      )
      .setColor(0x00AE86);

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('change_review_channel')
          .setLabel('Change Channel')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔧')
      );

    const reply = await message.channel.send({ 
      embeds: [embed], 
      components: [row] 
    });

    const collector = reply.createMessageComponentCollector({ 
      time: 30000 
    });

    collector.on('collect', async (interaction) => {
      if (interaction.customId === 'change_review_channel') {
        await interaction.reply({
          content: 'To change the review channel, use `rchannel <new-channel>`',
          flags: 64
        });
      }
    });

    collector.on('end', () => {
      reply.edit({ components: [] }).catch(() => {});
    });

  } catch (error) {
    console.error('Error showing current channel:', error);
    message.channel.send('❌ Error retrieving review channel settings.');
  }
}

async function handleTestReview(interaction, channel = null) {
  await interaction.deferReply({ flags: 64 });

  try {
    const targetChannel = channel || interaction.channel;
    const [reviewChannel] = await db.executeWithRetry(
      'SELECT * FROM review_channels WHERE guild_id = ?',
      [interaction.guild.id]
    );

    if (!reviewChannel) {
      return await interaction.editReply('❌ No review channel set.');
    }

    const testEmbed = new EmbedBuilder()
      .setTitle('🧪 Test Review')
      .setDescription('This is a test review to confirm the review channel is working properly.')
      .addFields(
        { name: 'Rating', value: '⭐⭐⭐⭐⭐ (5/5)', inline: true },
        { name: 'Service', value: 'Test Service', inline: true },
        { name: 'Note', value: 'This test review will auto-delete in 2 minutes', inline: false }
      )
      .setColor(0x00FF00)
      .setTimestamp()
      .setFooter({ text: 'Test review - this will not be saved in the database' });

    const reviewChannelObj = interaction.guild.channels.cache.get(reviewChannel.channel_id);
    if (reviewChannelObj) {
      const testMessage = await reviewChannelObj.send({ embeds: [testEmbed] });
      
      setTimeout(async () => {
        try {
          await testMessage.delete();
          console.log(`✅ Test review auto-deleted in guild: ${interaction.guild.name}`);
        } catch (deleteError) {
          if (deleteError.code === 10008) {
            console.log('Test review message already deleted');
          } else {
            console.error('Error deleting test review:', deleteError);
          }
        }
      }, 2 * 60 * 1000);

      await interaction.editReply(`✅ Test review sent to ${reviewChannelObj}! It will auto-delete in 2 minutes.`);

    } else {
      await interaction.editReply('❌ Review channel not found. It may have been deleted.');
    }

  } catch (error) {
    console.error('Test review error:', error);
    await interaction.editReply('❌ Failed to send test review. Check bot permissions.');
  }
}

async function handleViewStats(interaction) {
  await interaction.deferReply({ flags: 64 });

  try {
    const [stats] = await db.executeWithRetry(
      `SELECT 
        COUNT(*) as total_reviews,
        AVG(rating) as average_rating,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
       FROM reviews 
       WHERE guild_id = ?`,
      [interaction.guild.id]
    );

    const [reviewChannel] = await db.executeWithRetry(
      'SELECT * FROM review_channels WHERE guild_id = ?',
      [interaction.guild.id]
    );

    const embed = new EmbedBuilder()
      .setTitle('📊 Review Statistics')
      .setColor(0x00AE86)
      .setTimestamp();

    if (stats.total_reviews > 0) {
      const avgRating = parseFloat(stats.average_rating).toFixed(1);
      const stars = '⭐'.repeat(Math.round(avgRating)) + '☆'.repeat(5 - Math.round(avgRating));
      
      embed.setDescription(`**Overall Rating:** ${stars} (${avgRating}/5)`)
        .addFields(
          { name: 'Total Reviews', value: `**${stats.total_reviews}** reviews`, inline: true },
          { name: 'Average Rating', value: `**${avgRating}** / 5`, inline: true },
          { name: '\u200B', value: '\u200B', inline: true },
          { name: '⭐ 5 Stars', value: `**${stats.five_star}** reviews`, inline: true },
          { name: '⭐ 4 Stars', value: `**${stats.four_star}** reviews`, inline: true },
          { name: '⭐ 3 Stars', value: `**${stats.three_star}** reviews`, inline: true },
          { name: '⭐ 2 Stars', value: `**${stats.two_star}** reviews`, inline: true },
          { name: '⭐ 1 Star', value: `**${stats.one_star}** reviews`, inline: true }
        );
    } else {
      embed.setDescription('No reviews have been submitted yet.');
    }

    if (reviewChannel) {
      embed.addFields(
        { name: 'Review Channel', value: `<#${reviewChannel.channel_id}>`, inline: true }
      );
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Review stats error:', error);
    await interaction.editReply('❌ Error retrieving review statistics.');
  }
}