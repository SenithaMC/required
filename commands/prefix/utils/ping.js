const { EmbedBuilder } = require('discord.js');
module.exports = {
  name: 'ping',
  description: 'Check bot latency.',
  async execute(message) {
    const sent = await message.channel.send('🏓 Pinging...');
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const wsPing = message.client.ws.ping;
    const shardId = message.guild ? message.guild.shardId : 0;
    const embed = new EmbedBuilder()
      .setColor(0x00FFE7)
      .setDescription('Average websocket latency: ' + `\`${wsPing}ms\``)
      .addFields(
        { name: 'API Latency', value: `\`${wsPing}ms\``, inline: true },
        { name: 'Message Latency', value: `\`${latency}ms\``, inline: true }
      )
      .setTimestamp();
    sent.edit({ content: null, embeds: [embed], flags: 1 << 6  });
  }
};