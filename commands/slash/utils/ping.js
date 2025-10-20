const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency.'),
  
  async execute(interaction) {
    await interaction.deferReply();
    
    const sent = await interaction.fetchReply();
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const wsPing = interaction.client.ws.ping;
    
    const embed = new EmbedBuilder()
      .setColor(0x00FFE7)
      .setDescription('Average websocket latency: ' + `\`${wsPing}ms\``)
      .addFields(
        { name: 'API Latency', value: `\`${wsPing}ms\``, inline: true },
        { name: 'Message Latency', value: `\`${latency}ms\``, inline: true }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  }
};
