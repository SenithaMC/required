const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
  name: 'review',
  description: 'Create a review for a service',
  usage: 'review <service> <rating/5> <description>',
  async execute(message, args) {
    const [reviewChannel] = await db.executeWithRetry(
      'SELECT * FROM review_channels WHERE guild_id = ?',
      [message.guild.id]
    );

    if (!reviewChannel) {
      return message.channel.send('❌ No review channel set. Please use `rchannel <channel>` to set one first.');
    }

    if (args.length >= 3) {
      return await handleTraditionalReview(message, args, reviewChannel);
    }

    await showReviewMenu(message, reviewChannel);
  },

  async handleComponent(interaction) {
    if (interaction.isStringSelectMenu() && interaction.customId === 'review_service_select') {
      await handleServiceSelect(interaction);
    }
    
    if (interaction.isModalSubmit() && interaction.customId.startsWith('review_modal_')) {
      await handleReviewModal(interaction);
    }
  }
};

async function showReviewMenu(message, reviewChannel) {
  const embed = new EmbedBuilder()
    .setTitle('📝 Create a Review')
    .setDescription('Choose a service to review from the dropdown below, or use the traditional command: `review <service> <rating/5> <description>`')
    .setColor(0x00AE86)
    .addFields(
      { name: 'Review Channel', value: `<#${reviewChannel.channel_id}>`, inline: true },
      { name: 'Rating System', value: '1-5 ⭐ rating', inline: true }
    )
    .setFooter({ text: 'Your review will be posted anonymously in the review channel' });

  const services = [
    { label: 'Customer Support', value: 'customer_support', emoji: '🤝' },
    { label: 'Product Quality', value: 'product_quality', emoji: '🎁' },
    { label: 'Delivery Service', value: 'delivery_service', emoji: '🚚' },
    { label: 'Technical Support', value: 'technical_support', emoji: '💻' },
    { label: 'Sales Service', value: 'sales_service', emoji: '💼' },
    { label: 'Community Management', value: 'community_management', emoji: '👥' },
    { label: 'Custom Service', value: 'custom_service', emoji: '✨' }
  ];

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('review_service_select')
    .setPlaceholder('Select a service to review...')
    .addOptions(services);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await message.channel.send({ 
    embeds: [embed], 
    components: [row] 
  });
}

async function handleServiceSelect(interaction) {
  const selectedService = interaction.values[0];
  
  const modal = new ModalBuilder()
    .setCustomId(`review_modal_${selectedService}`)
    .setTitle('Create Review');

  const ratingInput = new TextInputBuilder()
    .setCustomId('rating_input')
    .setLabel('Rating (1-5 stars)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter a number from 1 to 5')
    .setMaxLength(1)
    .setRequired(true);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('description_input')
    .setLabel('Review Description')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Tell us about your experience...')
    .setMaxLength(1000)
    .setRequired(true);

  if (selectedService === 'custom_service') {
    const serviceNameInput = new TextInputBuilder()
      .setCustomId('service_name_input')
      .setLabel('Service Name')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter the name of the service')
      .setMaxLength(100)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(serviceNameInput),
      new ActionRowBuilder().addComponents(ratingInput),
      new ActionRowBuilder().addComponents(descriptionInput)
    );
  } else {
    modal.addComponents(
      new ActionRowBuilder().addComponents(ratingInput),
      new ActionRowBuilder().addComponents(descriptionInput)
    );
  }

  await interaction.showModal(modal);
}

async function handleReviewModal(interaction) {
  await interaction.deferReply({ flags: 64 });
  
  const selectedService = interaction.customId.replace('review_modal_', '');
  const rating = parseInt(interaction.fields.getTextInputValue('rating_input'));
  const description = interaction.fields.getTextInputValue('description_input');
  let serviceName = interaction.fields.getTextInputValue('service_name_input');

  if (isNaN(rating) || rating < 1 || rating > 5) {
    return await interaction.editReply('❌ Please provide a valid rating between 1 and 5.');
  }

  const serviceDisplayNames = {
    'customer_support': 'Customer Support',
    'product_quality': 'Product Quality',
    'delivery_service': 'Delivery Service',
    'technical_support': 'Technical Support',
    'sales_service': 'Sales Service',
    'community_management': 'Community Management',
    'custom_service': serviceName || 'Custom Service'
  };

  const serviceBought = serviceDisplayNames[selectedService] || 'Unknown Service';

  try {
    const [reviewChannel] = await db.executeWithRetry(
      'SELECT * FROM review_channels WHERE guild_id = ?',
      [interaction.guild.id]
    );

    if (!reviewChannel) {
      return await interaction.editReply('❌ Review channel not found. Please set it up again.');
    }

    await db.executeWithRetry(
      'INSERT INTO reviews (guild_id, user_id, service_bought, rating, description) VALUES (?, ?, ?, ?, ?)',
      [interaction.guild.id, interaction.user.id, serviceBought, rating, description]
    );

    const reviewEmbed = await createReviewEmbed(serviceBought, rating, description);

    const channel = interaction.guild.channels.cache.get(reviewChannel.channel_id);
    if (channel) {
      await channel.send({ embeds: [reviewEmbed] });
    }

    await interaction.editReply('✅ Your review has been submitted and posted!');

  } catch (error) {
    console.error('Review submission error:', error);
    await interaction.editReply('❌ Failed to submit review. Please try again.');
  }
}

async function handleTraditionalReview(message, args, reviewChannel) {
  const serviceBought = args[0];
  const rating = parseInt(args[1]);
  const description = args.slice(2).join(' ');

  if (isNaN(rating) || rating < 1 || rating > 5) {
    return message.channel.send('❌ Please provide a valid rating between 1 and 5.');
  }

  if (description.length < 5) {
    return message.channel.send('❌ Please provide a more detailed description (at least 5 characters).');
  }

  try {
    await db.executeWithRetry(
      'INSERT INTO reviews (guild_id, user_id, service_bought, rating, description) VALUES (?, ?, ?, ?, ?)',
      [message.guild.id, message.author.id, serviceBought, rating, description]
    );

    const reviewEmbed = await createReviewEmbed(serviceBought, rating, description);

    const channel = message.guild.channels.cache.get(reviewChannel.channel_id);
    if (channel) {
      await channel.send({ embeds: [reviewEmbed] });
    }

    message.channel.send('✅ Your review has been submitted and posted!');

  } catch (error) {
    console.error('Traditional review error:', error);
    message.channel.send('❌ Failed to submit review. Please try again.');
  }
}

async function createReviewEmbed(service, rating, description) {
  const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  
  const embed = new EmbedBuilder()
    .setTitle(`📝 New Review: ${service}`)
    .setDescription(description)
    .addFields(
      { name: 'Rating', value: `${stars} (${rating}/5)`, inline: true },
      { name: 'Service', value: service, inline: true }
    )
    .setColor(getRatingColor(rating))
    .setTimestamp()
    .setFooter({ text: 'Thank you for your feedback! 💫' });

  return embed;
}

function getRatingColor(rating) {
  switch (rating) {
    case 5: return 0x00FF00;
    case 4: return 0x90EE90;
    case 3: return 0xFFFF00;
    case 2: return 0xFFA500;
    case 1: return 0xFF0000;
    default: return 0x808080;
  }
}