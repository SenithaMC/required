const mongoose = require('mongoose');
const config = require('../config');

const guildSchema = new mongoose.Schema({
  guild_id: { type: String, required: true, unique: true },
  prefix: { type: String, default: config.prefix }
}, { timestamps: true });

const Guild = mongoose.model('Guild', guildSchema);

async function waitForConnection() {
  if (mongoose.connection.readyState === 1) return;
  return new Promise((resolve, reject) => {
    if (mongoose.connection.readyState === 1) return resolve();
    
    mongoose.connection.on('connected', resolve);
    mongoose.connection.on('error', reject);
    
    setTimeout(() => reject(new Error('Connection timeout')), 10000);
  });
}

async function getGuild(guildId) {
  try {
    await waitForConnection();
    let guild = await Guild.findOne({ guild_id: guildId });
    if (!guild) {
      guild = await createGuild(guildId);
    }
    return guild;
  } catch (error) {
    console.error('Error getting guild:', error);
    return { guild_id: guildId, prefix: config.prefix };
  }
}

async function createGuild(guildId) {
  try {
    await waitForConnection();
    const guild = new Guild({ guild_id: guildId });
    await guild.save();
    return guild;
  } catch (error) {
    console.error('Error creating guild:', error);
    throw error;
  }
}

async function getGuildPrefix(guildId) {
  try {
    await waitForConnection();
    const guild = await Guild.findOne({ guild_id: guildId });
    return guild ? guild.prefix : config.prefix;
  } catch (error) {
    console.error('Error getting guild prefix:', error);
    return config.prefix;
  }
}

async function setGuildPrefix(guildId, prefix) {
  try {
    await waitForConnection();
    await Guild.findOneAndUpdate(
      { guild_id: guildId },
      { $set: { prefix } },
      { upsert: true }
    );
    return true;
  } catch (error) {
    console.error('Error setting guild prefix:', error);
    return false;
  }
}

module.exports = {
  getGuild,
  createGuild,
  getGuildPrefix,
  setGuildPrefix,
  Guild
};