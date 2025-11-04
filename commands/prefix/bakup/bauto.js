const { PermissionsBitField } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
    name: 'bauto',
    description: 'Set automatic backup settings - interval/amount or toggle on/off',
    usage: 'bauto <interval> <amount> OR bauto <on/off>',
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.channel.send('❌ You need administrator permissions to change backup settings.');
        }

        if (args.length === 0) {
            const [settings] = await db.executeWithRetry(
                'SELECT * FROM backup_settings WHERE guild_id = ?',
                [message.guild.id]
            );
            
            if (!settings) {
                return message.channel.send('🔧 Automatic Backup Settings: **Disabled**\nUse `bauto <hours> <amount>` to enable and configure.');
            }
            
            const status = settings.enabled ? '✅ Enabled' : '❌ Disabled';
            return message.channel.send(
                `🔧 Automatic Backup Settings:\n${status}\n⏰ Interval: ${settings.interval_hours} hours\n💾 Keep: ${settings.keep_amount} backups\n📅 Last backup: ${settings.last_backup || 'Never'}`
            );
        }

        if (args.length === 1) {
            const state = args[0].toLowerCase();
            
            if (state !== 'on' && state !== 'off') {
                return message.channel.send('❌ Please provide either `on`/`off` or an interval and amount.');
            }

            try {
                const enabled = state === 'on' ? 1 : 0;
                await db.executeWithRetry(
                    `INSERT INTO backup_settings (guild_id, enabled) 
                     VALUES (?, ?) 
                     ON DUPLICATE KEY UPDATE enabled = ?`,
                    [message.guild.id, enabled, enabled]
                );

                await message.channel.send(`✅ Automatic backups turned **${state}**.`);

            } catch (error) {
                console.error('Backup toggle error:', error);
                message.channel.send('❌ Error updating backup settings.');
            }
            return;
        }

        if (args.length === 2) {
            const hours = parseInt(args[0]);
            const amount = parseInt(args[1]);

            if (!hours || isNaN(hours) || hours < 1 || hours > 720) {
                return message.channel.send('❌ Please provide a valid interval between 1 and 720 hours (30 days).');
            }

            if (!amount || isNaN(amount) || amount < 1 || amount > 50) {
                return message.channel.send('❌ Please provide a valid backup count between 1 and 50.');
            }

            try {
                await db.executeWithRetry(
                    `INSERT INTO backup_settings (guild_id, interval_hours, keep_amount, enabled) 
                     VALUES (?, ?, ?, 1) 
                     ON DUPLICATE KEY UPDATE interval_hours = ?, keep_amount = ?, enabled = 1`,
                    [message.guild.id, hours, amount, hours, amount]
                );

                await message.channel.send(
                    `✅ Automatic backups configured and enabled:\n` +
                    `⏰ Interval: ${hours} hours\n` +
                    `💾 Keep count: ${amount} backups\n` +
                    `📝 Next backup: ${hours === 1 ? 'in 1 hour' : `in ${hours} hours`}`
                );

            } catch (error) {
                console.error('Backup auto configuration error:', error);
                message.channel.send('❌ Error configuring automatic backups.');
            }
            return;
        }

        message.channel.send('❌ Invalid usage. Use `bauto <interval> <amount>` or `bauto <on/off>`');
    }
};