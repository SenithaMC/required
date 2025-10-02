const Giveaway = require('../models/Giveaway');
const config = require('../config');

class GiveawayCleanup {
  constructor(client) {
    this.client = client;
    this.interval = null;
  }

  start() {
    if (!config.giveawayCleanup.enabled) return;
    
    this.cleanup();
    
    this.interval = setInterval(
      () => this.cleanup(),
      config.giveawayCleanup.checkInterval
    );
    
    console.log('✅ Giveaway cleanup service started');
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('⏹️  Giveaway cleanup service stopped');
    }
  }

  async cleanup() {
    try {
      const cutoffDate = new Date(Date.now() - config.giveawayCleanup.delay);
      
      const expiredGiveaways = await Giveaway.find({
        ended: true,
        endedAt: { $lt: cutoffDate }
      });
      
      if (expiredGiveaways.length === 0) return;
      
      console.log(`🗑️ Found ${expiredGiveaways.length} expired giveaways to clean up`);
      
      const result = await Giveaway.deleteMany({
        ended: true,
        endedAt: { $lt: cutoffDate }
      });
      
      console.log(`✅ Deleted ${result.deletedCount} expired giveaways`);
      
    } catch (error) {
      console.error('<:error:1416752161638973490> Error during giveaway cleanup:', error);
    }
  }

  async scheduleDeletion(giveawayId) {
    try {
      const deleteAt = new Date(Date.now() + config.giveawayCleanup.delay);
      await Giveaway.findByIdAndUpdate(giveawayId, { deleteAt });
    } catch (error) {
      console.error('Error scheduling giveaway deletion:', error);
    }
  }n
  async manualCleanup() {
    console.log('🔄 Manual giveaway cleanup triggered');
    await this.cleanup();
  }
}

module.exports = GiveawayCleanup;