const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'ping',
  description: 'Check bot latency.',
  options: [],
  async execute(interaction) {
    const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
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
    
    await interaction.editReply({ content: null, embeds: [embed] });
  }
};
