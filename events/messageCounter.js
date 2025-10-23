const db = require('../utils/db');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot) return;
        if (!message.guild) return;

        try {
            await db.pool.execute(
                `INSERT INTO user_messages (guild_id, user_id, message_count, last_message) 
                 VALUES (?, ?, 1, NOW()) 
                 ON DUPLICATE KEY UPDATE 
                 message_count = message_count + 1, 
                 last_message = NOW()`,
                [message.guild.id, message.author.id]
            );
        } catch (error) {
            console.error('Error updating message count:', error);
        }
    }
};
