const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
  guildId: { type: String, required: true },
  prize: { type: String, required: true },
  winners: { type: Number, required: true },
  endTime: { type: Date, required: true },
  role: { type: String, default: null },
  participants: [{ type: String }],
  ended: { type: Boolean, default: false },
  endedAt: { type: Date, default: null },
  hostId: { type: String, required: true },
  deleteAt: { type: Date, default: null }
}, { timestamps: true });

giveawaySchema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Giveaway', giveawaySchema);