const mongoose = require('mongoose');

const memberInvitesSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  memberId: { type: String, required: true },
  totalInvites: { type: Number, default: 0 },
  validInvites: { type: Number, default: 0 },
  fakeInvites: { type: Number, default: 0 },
  leaveInvites: { type: Number, default: 0 },
  inviteCodes: [String],
  lastUpdated: { type: Date, default: Date.now }
});

// Create a compound index
memberInvitesSchema.index({ guildId: 1, memberId: 1 }, { unique: true });

module.exports = mongoose.model('MemberInvites', memberInvitesSchema);