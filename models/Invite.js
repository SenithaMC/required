const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  memberId: { type: String, required: true },
  inviteCode: { type: String, required: true },
  uses: { type: Number, default: 0 },
  fakeUses: { type: Number, default: 0 }, // For tracking leaves shortly after joining
  invitedUsers: [{ 
    userId: String,
    joinedAt: { type: Date, default: Date.now },
    left: { type: Boolean, default: false },
    leftAt: Date
  }],
  createdAt: { type: Date, default: Date.now }
});

// Create a compound index for better query performance
inviteSchema.index({ guildId: 1, memberId: 1 });
inviteSchema.index({ guildId: 1, inviteCode: 1 }, { unique: true });

module.exports = mongoose.model('Invite', inviteSchema);