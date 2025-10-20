const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const massActionCache = new Map();

module.exports = {
  name: 'masskick',
  aliases: ['mkick'],
  description: 'Kick all members with a specific role',
  usage: 'masskick <@role> [reason]',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ You need the `Kick Members` permission to use this command.')
        ]
      });
    }

    if (!message.mentions.roles.size) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ Please mention a role to mass kick.')
            .addFields({ name: 'Usage', value: this.usage })
        ]
      });
    }

    const targetRole = message.mentions.roles.first();
    const reason = args.slice(1).join(' ') || 'No reason provided';

    if (targetRole.id === message.guild.id) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ You cannot mass kick the @everyone role.')
        ]
      });
    }

    const members = targetRole.members;
    
    if (members.size === 0) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFA500)
            .setDescription(`No members found with the role ${targetRole.name}.`)
        ]
      });
    }

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`masskick_confirm_${targetRole.id}`)
          .setLabel('Confirm Mass Kick')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('masskick_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

    const confirmEmbed = new EmbedBuilder()
      .setTitle('⚠️ Mass Kick Confirmation')
      .setDescription(`You are about to kick **${members.size}** members with the role ${targetRole.name}.`)
      .addFields(
        { name: 'Reason', value: reason },
        { name: 'Warning', value: 'This action cannot be undone!' }
      )
      .setColor(0xFFA500)
      .setFooter({ text: 'You have 60 seconds to confirm' });

    const confirmMessage = await message.channel.send({ 
      embeds: [confirmEmbed], 
      components: [row] 
    });

    massActionCache.set(confirmMessage.id, {
      type: 'masskick',
      roleId: targetRole.id,
      reason,
      authorId: message.author.id,
      guildId: message.guild.id,
      expires: Date.now() + 60000
    });

    setTimeout(() => {
      if (massActionCache.has(confirmMessage.id)) {
        massActionCache.delete(confirmMessage.id);
        confirmMessage.edit({ 
          components: [] 
        }).catch(() => {});
      }
    }, 60000);
  },

  handleComponent: async (interaction) => {
    if (!interaction.customId.startsWith('masskick_')) return false;
    
    const actionData = massActionCache.get(interaction.message.id);
    if (!actionData) {
      return interaction.channel.send({
        content: 'This mass action has expired or is invalid.',
        ephemeral: true
      });
    }

    if (interaction.user.id !== actionData.authorId) {
      return interaction.channel.send({
        content: 'Only the user who initiated this action can confirm it.',
        ephemeral: true
      });
    }

    if (interaction.customId === 'masskick_cancel') {
      massActionCache.delete(interaction.message.id);
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ Mass kick cancelled.')
        ],
        components: []
      });
      return true;
    }

    if (interaction.customId.startsWith('masskick_confirm_')) {
      await interaction.deferUpdate();
      
      const guild = interaction.client.guilds.cache.get(actionData.guildId);
      const targetRole = guild.roles.cache.get(actionData.roleId);
      
      if (!targetRole) {
        massActionCache.delete(interaction.message.id);
        await interaction.editchannel.send({
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
        .setTitle('🔄 Processing Mass Kick')
        .setDescription(`Kicking ${members.size} members...`)
        .setColor(0x0099FF);
      
      await interaction.editchannel.send({ 
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
              .setTitle('🚪 You have been kicked')
              .setDescription(`You were kicked from **${guild.name}**`)
              .addFields(
                { name: 'Reason', value: actionData.reason },
                { name: 'Moderator', value: interaction.user.tag },
                { name: 'Type', value: 'Mass kick (role-based)' }
              )
              .setColor(0xFF0000)
              .setTimestamp();

            await member.send({ embeds: [dmEmbed] });
          } catch (dmError) {
            dmFailed++;
          }
          
          await member.kick(`Mass kick: ${actionData.reason} | Moderator: ${interaction.user.tag}`);
          successful++;
        } catch (error) {
          failed++;
        }
      }
      
      const resultEmbed = new EmbedBuilder()
        .setTitle('✅ Mass Kick Complete')
        .setDescription(`Kicked ${successful} members with the role ${targetRole.name}.`)
        .addFields(
          { name: 'Successful', value: successful.toString(), inline: true },
          { name: 'Failed', value: failed.toString(), inline: true },
          { name: 'DM Failed', value: dmFailed.toString(), inline: true },
          { name: 'Reason', value: actionData.reason }
        )
        .setColor(0x00FF00)
        .setTimestamp();
      
      await interaction.editchannel.send({ embeds: [resultEmbed] });
      
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