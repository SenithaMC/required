const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
  caseId: { type: Number, required: true },
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  moderatorId: { type: String, required: true },
  type: { 
    type: String, 
    required: true,
    enum: ['WARN', 'MUTE', 'KICK', 'BAN', 'UNMUTE', 'UNBAN', 'NOTE']
  },
  reason: { type: String, required: true },
  duration: { type: Number, default: null }, // For temporary actions
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null } // For automatic expiration
});

// Create a compound index for efficient querying
caseSchema.index({ guildId: 1, userId: 1 });
caseSchema.index({ guildId: 1, caseId: 1 }, { unique: true });

module.exports = mongoose.model('Case', caseSchema);