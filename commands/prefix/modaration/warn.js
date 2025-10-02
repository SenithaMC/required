const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const Case = require('../../../models/Case');

module.exports = {
  name: 'warn',
  description: 'Warn a user and log the case',
  usage: 'warn <@user> <reason>',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> You need the `Moderate Members` permission to warn users.')
        ]
      });
    }

    if (!message.mentions.users.size) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> Please mention a user to warn.')
            .addFields({ name: 'Usage', value: this.usage })
        ]
      });
    }

    const targetUser = message.mentions.users.first();
    const reason = args.slice(1).join(' ');

    if (!reason) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> Please provide a reason for the warning.')
            .addFields({ name: 'Usage', value: this.usage })
        ]
      });
    }

    try {
      const lastCase = await Case.findOne({ guildId: message.guild.id }).sort({ caseId: -1 });
      const caseId = lastCase ? lastCase.caseId + 1 : 1;

      const caseData = new Case({
        caseId,
        guildId: message.guild.id,
        userId: targetUser.id,
        moderatorId: message.author.id,
        type: 'WARN',
        reason
      });

      await caseData.save();

      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('⚠️ You have been warned')
          .setDescription(`You received a warning in **${message.guild.name}**`)
          .addFields(
            { name: 'Reason', value: reason },
            { name: 'Moderator', value: message.author.tag },
            { name: 'Case ID', value: `#${caseId}` }
          )
          .setColor(0xFFA500)
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (dmError) {
        console.log(`Could not send DM to ${targetUser.tag}:`, dmError.message);
      }

      const cases = await Case.find({ guildId: message.guild.id, userId: targetUser.id })
        .sort({ caseId: -1 })
        .limit(10);

      const now = Date.now();
      const last24hCount = cases.filter(c => now - c.createdAt.getTime() < 24 * 60 * 60 * 1000).length;
      const last7dCount = cases.filter(c => now - c.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000).length;
      const totalCount = cases.length;

      const casesContent = cases.map(c => {
        const date = `<t:${Math.floor(c.createdAt.getTime() / 1000)}:F>`;
        return `• ${date} \`${c.type}\` #${c.caseId} — ${c.reason}`;
      }).join('\n') || 'No previous cases.';

      const embed = new EmbedBuilder()
        .setTitle('✅ User Warned')
        .setDescription(casesContent)
        .setColor(0x00FF00)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `Query: Targeting ${targetUser.tag}` })
        .addFields(
          { name: 'Last 24 hours', value: `${last24hCount} infraction${last24hCount !== 1 ? 's' : ''}`, inline: true },
          { name: 'Last 7 days', value: `${last7dCount} infraction${last7dCount !== 1 ? 's' : ''}`, inline: true },
          { name: 'Total', value: `${totalCount} infraction${totalCount !== 1 ? 's' : ''}`, inline: true }
        )
        .setTimestamp();

      const sent = await message.channel.send({ embeds: [embed] });
      
      if (message.deletable) {
        message.delete().catch(() => {});
      }

    } catch (error) {
      console.error('Error warning user:', error);
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('<:error:1416752161638973490> There was an error warning the user.')
        ]
      });
    }
  },
};