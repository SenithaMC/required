const { PermissionsBitField, EmbedBuilder, WebhookClient } = require('discord.js');
const db = require('../../../utils/db');

module.exports = {
    name: 'bcreate',
    description: 'Create a comprehensive backup of server data',
    usage: 'bcreate <name>',
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.channel.send('❌ You need administrator permissions to create backups.');
        }

        const name = args.join(' ');
        if (!name) {
            return message.channel.send('❌ Please provide a name for the backup. Usage: `bcreate <name>`');
        }

        if (name.length > 255) {
            return message.channel.send('❌ Backup name must be less than 255 characters.');
        }

        try {
            const loadingMsg = await message.channel.send('🔄 Creating comprehensive server backup with messages... This may take several minutes.');

            const [mysqlData, serverStructure, channelMessages] = await Promise.all([
                gatherGuildData(message.guild.id),
                gatherServerStructure(message.guild),
                gatherChannelMessages(message.guild)
            ]);

            const backupData = {
                mysql_data: mysqlData,
                server_structure: serverStructure,
                channel_messages: channelMessages,
                backup_metadata: {
                    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
                    guild_id: message.guild.id,
                    guild_name: message.guild.name,
                    backup_version: '3.0',
                    total_size: JSON.stringify(serverStructure).length + JSON.stringify(channelMessages).length,
                    message_count: Object.values(channelMessages).reduce((acc, curr) => acc + curr.messages.length, 0)
                }
            };

            await db.executeWithRetry(
                'INSERT INTO backups (guild_id, name, data) VALUES (?, ?, ?)',
                [message.guild.id, name, JSON.stringify(backupData)]
            );

            await updateBackupSettings(message.guild.id);
            await cleanupOldBackups(message.guild.id);

            const embed = new EmbedBuilder()
                .setTitle('✅ Backup Created Successfully')
                .setColor(0x00FF00)
                .addFields(
                    { name: 'Backup Name', value: name, inline: true },
                    { name: 'Server', value: message.guild.name, inline: true },
                    { name: 'Roles Backed Up', value: serverStructure.roles.length.toString(), inline: true },
                    { name: 'Channels Backed Up', value: serverStructure.channels.length.toString(), inline: true },
                    { name: 'Categories Backed Up', value: serverStructure.categories.length.toString(), inline: true },
                    { name: 'Emojis Backed Up', value: serverStructure.emojis.length.toString(), inline: true },
                    { name: 'Messages Backed Up', value: backupData.backup_metadata.message_count.toString(), inline: true },
                    { name: 'Channels with Messages', value: Object.keys(channelMessages).length.toString(), inline: true }
                )
                .setFooter({ text: `Backup ID: ${message.guild.id}-${Date.now()}` })
                .setTimestamp();

            await loadingMsg.edit({ content: null, embeds: [embed] });
            
        } catch (error) {
            console.error('Backup creation error:', error);
            message.channel.send('❌ Error creating comprehensive backup. Please try again.');
        }
    }
};

async function gatherServerStructure(guild) {
    console.log(`🔄 Gathering server structure for: ${guild.name}`);
    
    const serverData = {
        guild_info: await getGuildInfo(guild),
        roles: await getRolesData(guild),
        channels: await getChannelsData(guild),
        categories: await getCategoriesData(guild),
        emojis: await getEmojisData(guild),
        members: await getMembersData(guild),
        bans: await getBansData(guild)
    };

    return serverData;
}

async function gatherChannelMessages(guild) {
    console.log(`📝 Gathering messages for guild: ${guild.name}`);
    const channelMessages = {};
    let totalMessages = 0;

    const textChannels = guild.channels.cache.filter(channel => 
        channel.type === 0 &&
        channel.viewable &&
        channel.permissionsFor(guild.client.user).has(PermissionsBitField.Flags.ReadMessageHistory)
    );

    for (const [channelId, channel] of textChannels) {
        try {
            console.log(`📥 Fetching messages from #${channel.name}`);
            const messages = await channel.messages.fetch({ limit: 50 });
            const messageData = [];

            for (const [messageId, message] of messages) {
                if (message.system) continue;
                if (!message.content && message.embeds.length === 0 && message.attachments.size === 0) continue;

                const messageObj = {
                    id: message.id,
                    content: message.content,
                    author: {
                        id: message.author.id,
                        username: message.author.username,
                        discriminator: message.author.discriminator,
                        bot: message.author.bot,
                        avatar: message.author.displayAvatarURL({ format: 'png', size: 128 })
                    },
                    timestamp: message.createdAt.toISOString(),
                    edited_timestamp: message.editedAt ? message.editedAt.toISOString() : null,
                    attachments: [],
                    embeds: [],
                    reactions: []
                };

                if (message.attachments.size > 0) {
                    for (const [attachmentId, attachment] of message.attachments) {
                        messageObj.attachments.push({
                            id: attachment.id,
                            name: attachment.name,
                            url: attachment.url,
                            proxy_url: attachment.proxyURL,
                            size: attachment.size,
                            height: attachment.height,
                            width: attachment.width,
                            content_type: attachment.contentType
                        });
                    }
                }

                if (message.embeds.length > 0) {
                    for (const embed of message.embeds) {
                        const embedData = {
                            title: embed.title,
                            description: embed.description,
                            url: embed.url,
                            timestamp: embed.timestamp,
                            color: embed.color,
                            fields: embed.fields?.map(field => ({
                                name: field.name,
                                value: field.value,
                                inline: field.inline
                            })) || [],
                            author: embed.author ? {
                                name: embed.author.name,
                                url: embed.author.url,
                                icon_url: embed.author.iconURL
                            } : null,
                            image: embed.image ? { url: embed.image.url } : null,
                            thumbnail: embed.thumbnail ? { url: embed.thumbnail.url } : null,
                            footer: embed.footer ? {
                                text: embed.footer.text,
                                icon_url: embed.footer.iconURL
                            } : null
                        };
                        messageObj.embeds.push(embedData);
                    }
                }

                if (message.reactions.cache.size > 0) {
                    for (const [reactionId, reaction] of message.reactions.cache) {
                        messageObj.reactions.push({
                            emoji: reaction.emoji.id ? {
                                id: reaction.emoji.id,
                                name: reaction.emoji.name,
                                animated: reaction.emoji.animated
                            } : {
                                name: reaction.emoji.name
                            },
                            count: reaction.count
                        });
                    }
                }

                messageData.push(messageObj);
            }

            if (messageData.length > 0) {
                channelMessages[channelId] = {
                    channel_id: channelId,
                    channel_name: channel.name,
                    messages: messageData.reverse()
                };
                totalMessages += messageData.length;
                console.log(`✅ Backed up ${messageData.length} messages from #${channel.name}`);
            }

            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.error(`❌ Failed to fetch messages from #${channel.name}:`, error.message);
        }
    }

    console.log(`📊 Total messages backed up: ${totalMessages} from ${Object.keys(channelMessages).length} channels`);
    return channelMessages;
}

async function getGuildInfo(guild) {
    return {
        name: guild.name,
        id: guild.id,
        description: guild.description,
        created: guild.createdAt.toISOString().slice(0, 19).replace('T', ' '),
        owner_id: guild.ownerId,
        member_count: guild.memberCount,
        features: guild.features,
        verification_level: guild.verificationLevel,
        explicit_content_filter: guild.explicitContentFilter,
        default_message_notifications: guild.defaultMessageNotifications,
        mfa_level: guild.mfaLevel,
        premium_tier: guild.premiumTier,
        premium_subscription_count: guild.premiumSubscriptionCount,
        preferred_locale: guild.preferredLocale,
        afk_timeout: guild.afkTimeout,
        afk_channel_id: guild.afkChannelId,
        system_channel_id: guild.systemChannelId,
        rules_channel_id: guild.rulesChannelId,
        public_updates_channel_id: guild.publicUpdatesChannelId,
        vanity_url_code: guild.vanityURLCode,
        banner: guild.bannerURL({ size: 4096 }),
        icon: guild.iconURL({ size: 4096 }),
        splash: guild.splashURL({ size: 4096 }),
        discovery_splash: guild.discoverySplashURL({ size: 4096 })
    };
}

async function getRolesData(guild) {
    const roles = [];
    
    for (const [roleId, role] of guild.roles.cache) {
        if (role.id === guild.id || role.managed) continue;
        
        roles.push({
            id: role.id,
            name: role.name,
            color: role.color,
            hoist: role.hoist,
            position: role.position,
            permissions: role.permissions.bitfield.toString(),
            mentionable: role.mentionable,
            created: role.createdAt.toISOString().slice(0, 19).replace('T', ' ')
        });
    }
    
    return roles.sort((a, b) => b.position - a.position);
}

async function getChannelsData(guild) {
    const channels = [];
    
    for (const [channelId, channel] of guild.channels.cache) {
        const channelData = {
            id: channel.id,
            name: channel.name,
            type: channel.type,
            position: channel.position,
            parent_id: channel.parentId,
            created: channel.createdAt.toISOString().slice(0, 19).replace('T', ' ')
        };

        switch (channel.type) {
            case 0:
                channelData.topic = channel.topic;
                channelData.nsfw = channel.nsfw;
                channelData.rate_limit_per_user = channel.rateLimitPerUser;
                break;
            case 2:
                channelData.bitrate = channel.bitrate;
                channelData.user_limit = channel.userLimit;
                break;
            case 4:
                channelData.children = guild.channels.cache
                    .filter(c => c.parentId === channel.id)
                    .map(c => c.id);
                break;
            case 5:
                channelData.topic = channel.topic;
                channelData.nsfw = channel.nsfw;
                break;
            case 13:
                channelData.bitrate = channel.bitrate;
                channelData.user_limit = channel.userLimit;
                break;
            case 15:
                channelData.topic = channel.topic;
                channelData.nsfw = channel.nsfw;
                channelData.rate_limit_per_user = channel.rateLimitPerUser;
                break;
        }

        channelData.permission_overwrites = [];
        for (const [overwriteId, overwrite] of channel.permissionOverwrites.cache) {
            channelData.permission_overwrites.push({
                id: overwriteId,
                type: overwrite.type,
                allow: overwrite.allow.bitfield.toString(),
                deny: overwrite.deny.bitfield.toString()
            });
        }

        channels.push(channelData);
    }
    
    return channels;
}

async function getCategoriesData(guild) {
    const categories = [];
    
    for (const [channelId, channel] of guild.channels.cache.filter(c => c.type === 4)) {
        categories.push({
            id: channel.id,
            name: channel.name,
            position: channel.position,
            created: channel.createdAt.toISOString().slice(0, 19).replace('T', ' '),
            children: guild.channels.cache
                .filter(c => c.parentId === channel.id)
                .map(c => ({
                    id: c.id,
                    name: c.name,
                    type: c.type
                }))
        });
    }
    
    return categories.sort((a, b) => a.position - b.position);
}

async function getEmojisData(guild) {
    const emojis = [];
    
    for (const [emojiId, emoji] of guild.emojis.cache) {
        emojis.push({
            id: emoji.id,
            name: emoji.name,
            animated: emoji.animated,
            url: emoji.url,
            created: emoji.createdAt?.toISOString().slice(0, 19).replace('T', ' '),
            managed: emoji.managed,
            available: emoji.available,
            requires_colons: emoji.requiresColons
        });
    }
    
    return emojis;
}

async function getMembersData(guild) {
    const members = [];
    
    await guild.members.fetch({ limit: 1000 });
    
    for (const [memberId, member] of guild.members.cache) {
        members.push({
            id: member.id,
            username: member.user.username,
            discriminator: member.user.discriminator,
            display_name: member.displayName,
            bot: member.user.bot,
            joined: member.joinedAt?.toISOString().slice(0, 19).replace('T', ' '),
            roles: member.roles.cache
                .filter(role => role.id !== guild.id)
                .map(role => role.id),
            premium_since: member.premiumSince?.toISOString().slice(0, 19).replace('T', ' '),
            pending: member.pending,
            permissions: member.permissions.bitfield.toString()
        });
    }
    
    return members;
}

async function getBansData(guild) {
    const bans = [];
    
    try {
        const banList = await guild.bans.fetch();
        for (const [userId, ban] of banList) {
            bans.push({
                user_id: userId,
                reason: ban.reason
            });
        }
    } catch (error) {
        console.log('No permission to fetch bans or error:', error.message);
    }
    
    return bans;
}

async function gatherGuildData(guildId) {
    const backupData = {
        guild_info: {
            id: guildId,
            backup_created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
            backup_version: '3.0'
        },
        settings: {},
        data: {}
    };

    try {
        const [guildSettings] = await db.executeWithRetry(
            'SELECT * FROM guilds WHERE guild_id = ?',
            [guildId]
        );
        backupData.settings.guild_settings = guildSettings || {};

        const cases = await db.executeWithRetry(
            `SELECT *, 
             DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s') as createdAt,
             DATE_FORMAT(expiresAt, '%Y-%m-%d %H:%i:%s') as expiresAt 
             FROM cases WHERE guildId = ?`,
            [guildId]
        );
        backupData.data.cases = cases;

        const userMessages = await db.executeWithRetry(
            `SELECT *, 
             DATE_FORMAT(last_message, '%Y-%m-%d %H:%i:%s') as last_message 
             FROM user_messages WHERE guild_id = ?`,
            [guildId]
        );
        backupData.data.user_messages = userMessages;

        const afkData = await db.executeWithRetry(
            `SELECT *, 
             DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s') as createdAt 
             FROM afk WHERE guildId = ?`,
            [guildId]
        );
        backupData.data.afk = afkData;

        const [commandRestrict] = await db.executeWithRetry(
            'SELECT * FROM command_restrict WHERE guildId = ?',
            [guildId]
        );
        backupData.settings.command_restrict = commandRestrict || {};

        const giveaways = await db.executeWithRetry(
            `SELECT *, 
             DATE_FORMAT(endTime, '%Y-%m-%d %H:%i:%s') as endTime,
             DATE_FORMAT(endedAt, '%Y-%m-%d %H:%i:%s') as endedAt,
             DATE_FORMAT(deleteAt, '%Y-%m-%d %H:%i:%s') as deleteAt,
             DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s') as createdAt,
             DATE_FORMAT(updatedAt, '%Y-%m-%d %H:%i:%s') as updatedAt
             FROM giveaways WHERE guildId = ?`,
            [guildId]
        );
        backupData.data.giveaways = giveaways;

        const invites = await db.executeWithRetry(
            'SELECT * FROM invites WHERE guildId = ?',
            [guildId]
        );
        backupData.data.invites = invites;

        const memberInvites = await db.executeWithRetry(
            'SELECT * FROM member_invites WHERE guildId = ?',
            [guildId]
        );
        backupData.data.member_invites = memberInvites;

        const [greetConfig] = await db.executeWithRetry(
            'SELECT * FROM greet_configs WHERE guildId = ?',
            [guildId]
        );
        backupData.settings.greet_configs = greetConfig || {};

        const tickets = await db.executeWithRetry(
            `SELECT *, 
             DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at,
             DATE_FORMAT(closed_at, '%Y-%m-%d %H:%i:%s') as closed_at
             FROM tickets WHERE guild_id = ?`,
            [guildId]
        );
        backupData.data.tickets = tickets;

        const ticketPanels = await db.executeWithRetry(
            'SELECT * FROM ticket_panels WHERE guild_id = ?',
            [guildId]
        );
        backupData.settings.ticket_panels = ticketPanels;

        const ticketCategories = await db.executeWithRetry(
            'SELECT * FROM ticket_categories WHERE guild_id = ?',
            [guildId]
        );
        backupData.settings.ticket_categories = ticketCategories;

        const tags = await db.executeWithRetry(
            `SELECT *, 
             DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at
             FROM tags WHERE guild_id = ?`,
            [guildId]
        );
        backupData.data.tags = tags;

        const reviews = await db.executeWithRetry(
            `SELECT *, 
             DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at
             FROM reviews WHERE guild_id = ?`,
            [guildId]
        );
        backupData.data.reviews = reviews;

        const [reviewChannel] = await db.executeWithRetry(
            'SELECT * FROM review_channels WHERE guild_id = ?',
            [guildId]
        );
        backupData.settings.review_channels = reviewChannel || {};

        const [transcriptChannel] = await db.executeWithRetry(
            'SELECT * FROM transcript_channels WHERE guild_id = ?',
            [guildId]
        );
        backupData.settings.transcript_channels = transcriptChannel || {};

        const [backupSettings] = await db.executeWithRetry(
            'SELECT * FROM backup_settings WHERE guild_id = ?',
            [guildId]
        );
        backupData.settings.backup_settings = backupSettings || {};

    } catch (error) {
        console.error('Error gathering guild data:', error);
        throw error;
    }

    return backupData;
}

async function updateBackupSettings(guildId) {
    try {
        await db.executeWithRetry(
            `INSERT INTO backup_settings (guild_id, last_backup) 
             VALUES (?, NOW()) 
             ON DUPLICATE KEY UPDATE last_backup = NOW()`,
            [guildId]
        );
    } catch (error) {
        console.error('Error updating backup settings:', error);
    }
}

async function cleanupOldBackups(guildId) {
    try {
        const [settings] = await db.executeWithRetry(
            'SELECT keep_amount FROM backup_settings WHERE guild_id = ?',
            [guildId]
        );

        const keepAmount = settings?.keep_amount || 10;

        await db.executeWithRetry(
            `DELETE FROM backups 
             WHERE guild_id = ? 
             AND id NOT IN (
                 SELECT id FROM (
                     SELECT id FROM backups 
                     WHERE guild_id = ? 
                     ORDER BY created_at DESC 
                     LIMIT ?
                 ) AS recent_backups
             )`,
            [guildId, guildId, keepAmount]
        );

    } catch (error) {
        console.error('Error cleaning up old backups:', error);
    }
}