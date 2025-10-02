module.exports = {
  prefix: ';',
  token: 'YOUR-BOT-TOKEN',
  mongoURI: 'YOUR-MONDOFB-URI',
  client_id: 'YOUR-BOT-ID',
  bot_name: 'LWKY',
  commandCooldown: '10', // in seconds
  giveawayCleanup: {
    enabled: true,
    delay: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    checkInterval: 60 * 60 * 1000 // Check every hour
  }
};
