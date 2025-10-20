const config = require('../config');
const db = require('./db');

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
      
      const [expiredGiveaways] = await db.pool.execute(
        'SELECT * FROM giveaways WHERE ended = TRUE AND endedAt < ?',
        [cutoffDate]
      );
      
      if (expiredGiveaways.length === 0) return;
      
      console.log(`🗑️ Found ${expiredGiveaways.length} expired giveaways to clean up`);
      
      const [result] = await db.pool.execute(
        'DELETE FROM giveaways WHERE ended = TRUE AND endedAt < ?',
        [cutoffDate]
      );
      
      console.log(`✅ Deleted ${result.affectedRows} expired giveaways`);
      
    } catch (error) {
      console.error('❌ Error during giveaway cleanup:', error);
    }
  }

  async scheduleDeletion(giveawayId) {
    try {
      const deleteAt = new Date(Date.now() + config.giveawayCleanup.delay);
      await db.pool.execute(
        'UPDATE giveaways SET deleteAt = ? WHERE id = ?',
        [deleteAt, giveawayId]
      );
    } catch (error) {
      console.error('Error scheduling giveaway deletion:', error);
    }
  }

  async manualCleanup() {
    console.log('🔄 Manual giveaway cleanup triggered');
    await this.cleanup();
  }
}

module.exports = GiveawayCleanup;