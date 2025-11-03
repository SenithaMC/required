const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const config = require('../../../config');
const db = require('../../../utils/db');

module.exports = {
  name: 'help',
  description: 'List all commands or get info about a specific command',
  usage: 'help [command]',
  aliases: ['h', 'commands'],

  async execute(message, args) {
    const isStaff = message.member.permissions.has(PermissionsBitField.Flags.ManageMessages);
    const guildPrefix = await db.getGuildPrefix(message.guild.id);
    const prefix = guildPrefix || config.prefix;

    const commandDatabase = {
        kick: {
            name: 'kick',
            description: 'Kick a user from the server',
            usage: `${prefix}kick <user> [reason]`,
            category: 'Moderation',
            aliases: [],
            staffOnly: true,
            details: 'Removes a user from the server. They can rejoin with another invitation.'
        },
        ban: {
            name: 'ban',
            description: 'Ban a user from the server',
            usage: `${prefix}ban <user> [reason]`,
            category: 'Moderation',
            aliases: [],
            staffOnly: true,
            details: 'Permanently removes a user from the server. Banned users cannot rejoin unless unbanned.'
        },
        tempban: {
            name: 'tempban',
            description: 'Temporarily ban a user',
            usage: `${prefix}tempban <user> <duration> [reason]`,
            category: 'Moderation',
            aliases: ['tban'],
            staffOnly: true,
            details: 'Temporarily bans a user. Duration format: 1d, 2h, 30m, etc.'
        },
        lock: {
            name: 'lock',
            description: 'Lock a channel',
            usage: `${prefix}lock [channel] [reason]`,
            category: 'Moderation',
            aliases: [],
            staffOnly: true,
            details: 'Locks a channel to prevent members from sending messages.'
        },
        unlock: {
            name: 'unlock',
            description: 'Unlock a channel',
            usage: `${prefix}unlock [channel]`,
            category: 'Moderation',
            aliases: [],
            staffOnly: true,
            details: 'Unlocks a previously locked channel.'
        },
        massban: {
            name: 'massban',
            description: 'Ban all members with a specific role',
            usage: `${prefix}massban <role> [reason]`,
            category: 'Moderation',
            aliases: ['mban'],
            staffOnly: true,
            details: 'Bans every member who has the specified role. Use with caution.'
        },
        masskick: {
            name: 'masskick',
            description: 'Kick all members with a specific role',
            usage: `${prefix}masskick <role> [reason]`,
            category: 'Moderation',
            aliases: ['mkick'],
            staffOnly: true,
            details: 'Kicks every member who has the specified role.'
        },
        warn: {
            name: 'warn',
            description: 'Issue a warning to a member',
            usage: `${prefix}warn <user> <reason>`,
            category: 'Moderation',
            aliases: [],
            staffOnly: true,
            details: 'Sends a warning to the user and logs it for moderation tracking.'
        },
        mute: {
            name: 'mute',
            description: 'Mute a user in the server',
            usage: `${prefix}mute <user> <duration> [reason]`,
            category: 'Moderation',
            aliases: ['silence'],
            staffOnly: true,
            details: 'Temporarily mutes a user for specified duration.'
        },
        restrict: {
            name: 'restrict',
            description: 'Restrict commands for non-admin members',
            usage: `${prefix}restrict [enable/disable] [role/channel]`,
            category: 'Moderation',
            aliases: [],
            staffOnly: true,
            details: 'Restricts bot commands to administrators only with exemptions.'
        },
        everyone: {
            name: 'everyone',
            description: 'Ghost ping every user in the server',
            usage: `${prefix}everyone`,
            category: 'Moderation',
            aliases: ['ghostping', 'massping'],
            staffOnly: true,
            details: 'Sends a ghost ping to every human member without confirmation.'
        },

        cases: {
            name: 'cases',
            description: 'View all cases for a user',
            usage: `${prefix}cases [user]`,
            category: 'Cases',
            aliases: ['warnings'],
            staffOnly: true,
            details: 'Shows all recorded moderation cases for the specified user.'
        },
        cremove: {
            name: 'cremove',
            description: 'Reset all cases for a user',
            usage: `${prefix}cremove <user>`,
            category: 'Cases',
            aliases: ['unwarn', 'removecase'],
            staffOnly: true,
            details: 'Completely clears all recorded cases for the specified user.'
        },

        ping: {
            name: 'ping',
            description: 'Check the bot\'s latency',
            usage: `${prefix}ping`,
            category: 'Utility',
            aliases: [],
            staffOnly: false,
            details: 'Shows the bot\'s current latency and API response time.'
        },
        help: {
            name: 'help',
            description: 'Show command information',
            usage: `${prefix}help [command]`,
            category: 'Utility',
            aliases: ['h', 'commands'],
            staffOnly: false,
            details: 'Displays information about available commands or specific command details.'
        },
        purge: {
            name: 'purge',
            description: 'Delete multiple messages',
            usage: `${prefix}purge <amount>`,
            category: 'Utility',
            aliases: ['clear'],
            staffOnly: true,
            details: 'Deletes a specified number of recent messages in a channel.'
        },
        nuke: {
            name: 'nuke',
            description: 'Completely clear a channel',
            usage: `${prefix}nuke`,
            category: 'Utility',
            aliases: [],
            staffOnly: true,
            details: 'Wipes the entire channel by recreating it.'
        },
        notify: {
            name: 'notify',
            description: 'Send DM notifications',
            usage: `${prefix}notify <user|role|ALL> <message>`,
            category: 'Utility',
            aliases: ['dm', 'message', 'alert'],
            staffOnly: true,
            details: 'Sends direct messages to users, roles, or all server members.'
        },
        calculate: {
            name: 'calculate',
            description: 'Perform mathematical calculations',
            usage: `${prefix}calculate <expression>`,
            category: 'Utility',
            aliases: ['calc', 'math'],
            staffOnly: false,
            details: 'Evaluates mathematical expressions with +, -, *, /, %, ^, √, etc.'
        },

        invites: {
            name: 'invites',
            description: 'Check invite statistics',
            usage: `${prefix}invites [user]`,
            category: 'Invites',
            aliases: [],
            staffOnly: false,
            details: 'Displays invite statistics including valid, left, and fake invites.'
        },
        inviter: {
            name: 'inviter',
            description: 'See who invited a user',
            usage: `${prefix}inviter [user]`,
            category: 'Invites',
            aliases: [],
            staffOnly: false,
            details: 'Shows the member who invited a user and their invite stats.'
        },
        invitecodes: {
            name: 'invitecodes',
            description: 'List invite codes by user',
            usage: `${prefix}invitecodes [user]`,
            category: 'Invites',
            aliases: ['icodes'],
            staffOnly: false,
            details: 'Displays all invite codes created by a user with usage statistics.'
        },
        leaderboard: {
            name: 'leaderboard',
            description: 'View invite leaderboard',
            usage: `${prefix}leaderboard [page]`,
            category: 'Invites',
            aliases: ['lb', 'top'],
            staffOnly: false,
            details: 'Shows a paginated leaderboard of members based on invites.'
        },

        gcreate: {
            name: 'gcreate',
            description: 'Create a new giveaway',
            usage: `${prefix}gcreate <winners> <prize> <time> [role]`,
            category: 'Giveaways',
            aliases: [],
            staffOnly: true,
            details: 'Starts a new giveaway with specified winners, prize, duration, and optional role restriction.'
        },
        greroll: {
            name: 'greroll',
            description: 'Reroll giveaway winners',
            usage: `${prefix}greroll <message-id> [winners]`,
            category: 'Giveaways',
            aliases: [],
            staffOnly: true,
            details: 'Selects new winners for an ended giveaway.'
        },
        gend: {
            name: 'gend',
            description: 'End a giveaway immediately',
            usage: `${prefix}gend <message-id> [winners]`,
            category: 'Giveaways',
            aliases: [],
            staffOnly: true,
            details: 'Ends a running giveaway immediately and announces winners.'
        },

        afk: {
            name: 'afk',
            description: 'Set your AFK status',
            usage: `${prefix}afk [reason]`,
            category: 'AFK',
            aliases: [],
            staffOnly: false,
            details: 'Sets your AFK status and notifies others when mentioned.'
        },
        afklist: {
            name: 'afklist',
            description: 'View all AFK members',
            usage: `${prefix}afklist`,
            category: 'AFK',
            aliases: [],
            staffOnly: false,
            details: 'Displays all members with AFK status and their reasons.'
        },

        messages: {
            name: 'messages',
            description: 'Show message count',
            usage: `${prefix}messages [user]`,
            category: 'Tracking',
            aliases: ['msgcount', 'messagecount'],
            staffOnly: false,
            details: 'Shows total messages sent by you or another user in the server.'
        },
        rmsg: {
            name: 'rmsg',
            description: 'Reset message counters',
            usage: `${prefix}rmsg [user/role]`,
            category: 'Tracking',
            aliases: ['resetmessages', 'clearmessages'],
            staffOnly: true,
            details: 'Resets message counters for users, roles, or entire server.'
        },

        greet: {
            name: 'greet',
            description: 'Set welcome messages',
            usage: `${prefix}greet <channel> <message> [timeout]`,
            category: 'Welcome',
            aliases: ['welcome'],
            staffOnly: true,
            details: 'Sets a channel for welcome messages when users join the server.'
        },

        bcreate: {
            name: 'bcreate',
            description: 'Create a manual backup',
            usage: `${prefix}bcreate <name>`,
            category: 'Backup',
            aliases: ['backupcreate'],
            staffOnly: true,
            details: 'Creates a manual backup of server data with the specified name.'
        },
        binterval: {
            name: 'binterval',
            description: 'Set auto backup interval',
            usage: `${prefix}binterval set <hours>`,
            category: 'Backup',
            aliases: ['backupinterval'],
            staffOnly: true,
            details: 'Sets the automatic backup interval in hours (1-8760).'
        },
        bamount: {
            name: 'bamount',
            description: 'Set backup retention count',
            usage: `${prefix}bamount <number>`,
            category: 'Backup',
            aliases: ['backupamount'],
            staffOnly: true,
            details: 'Sets how many recent backups to keep (1-100).'
        },

        review: {
            name: 'review',
            description: 'Create a service review',
            usage: `${prefix}review [service] [rating] [description]`,
            category: 'Misc.',
            aliases: ['rate', 'feedback'],
            staffOnly: false,
            details: 'Creates a review for a service. Use without arguments for interactive menu.'
        },
        rchannel: {
            name: 'rchannel',
            description: 'Set review channel',
            usage: `${prefix}rchannel <channel>`,
            category: 'Misc.',
            aliases: ['reviewchannel'],
            staffOnly: true,
            details: 'Sets the channel where reviews will be posted.'
        },

        tag: {
            name: 'tag',
            description: 'Create and manage message tags',
            usage: `${prefix}tag <create|send|list|delete|info> [args]`,
            category: 'Misc.',
            aliases: ['t'],
            staffOnly: false,
            details: 'Manages message tags for quick responses. Use "tag list" to see all commands.'
        }
    };

    const query = args[0]?.toLowerCase();

    if (query && commandDatabase[query]) {
        const command = commandDatabase[query];
        return await showCommandHelp(message, command, isStaff, prefix);
    }

    if (query) {
        const aliasCommand = Object.values(commandDatabase).find(cmd => 
            cmd.aliases.includes(query)
        );
        if (aliasCommand) {
            return await showCommandHelp(message, aliasCommand, isStaff, prefix);
        }
    }

    await showInteractiveHelp(message, commandDatabase, isStaff, prefix);
  },

  handleComponent: async (interaction) => {
    if (interaction.customId === 'help_category') {
      return true;
    }
    return false;
  }
};

async function showCommandHelp(message, command, isStaff, prefix) {
    if (command.staffOnly && !isStaff) {
        return message.channel.send('❌ You don\'t have permission to view this command.');
    }

    const embed = new EmbedBuilder()
        .setColor(getCategoryColor(command.category))
        .setTitle(`Command: ${command.name}`)
        .setDescription(command.details)
        .addFields(
            { name: '📝 Description', value: command.description, inline: true },
            { name: '📂 Category', value: command.category, inline: true },
            { name: '🔤 Aliases', value: command.aliases.length ? `\`${command.aliases.join('`, `')}\`` : 'None', inline: true },
            { name: '💻 Usage', value: `\`${command.usage}\``, inline: false },
            { name: '👮 Staff Only', value: command.staffOnly ? 'Yes' : 'No', inline: true }
        )
        .setFooter({ 
            text: `Use "${prefix}help" to see all commands • ${command.category}`,
            iconURL: message.client.user.displayAvatarURL()
        })
        .setTimestamp();

    return message.channel.send({ embeds: [embed] });
}

async function showInteractiveHelp(message, commandDatabase, isStaff, prefix) {
    const categories = {
        main: {
            name: 'Main Menu',
            description: 'Select a category from the dropdown below to explore commands',
            emoji: '🏠',
            color: 0x5865F2
        },
        moderation: {
            name: 'Moderation',
            description: 'Server moderation and management commands',
            emoji: '🛡️',
            color: 0xFF0000,
            staffOnly: true
        },
        cases: {
            name: 'Case Management',
            description: 'Warning and case management commands',
            emoji: '📋',
            color: 0xFFA500,
            staffOnly: true
        },
        utility: {
            name: 'Utility',
            description: 'General utility and fun commands',
            emoji: '🔧',
            color: 0x00FF00
        },
        invites: {
            name: 'Invites',
            description: 'Server invite tracking and management',
            emoji: '📖',
            color: 0x9C27B0
        },
        giveaways: {
            name: 'Giveaways',
            description: 'Giveaway creation and management',
            emoji: '🎉',
            color: 0xFFD700,
            staffOnly: true
        },
        afk: {
            name: 'AFK System',
            description: 'Away From Keyboard status management',
            emoji: '💤',
            color: 0x808080
        },
        tracking: {
            name: 'Message Tracking',
            description: 'Message count and statistics',
            emoji: '📊',
            color: 0x2196F3
        },
        welcome: {
            name: 'Welcome System',
            description: 'Welcome message configuration',
            emoji: '👋',
            color: 0x4CAF50,
            staffOnly: true
        },
        backup: {
            name: 'Backup System',
            description: 'Server data backup and restoration',
            emoji: '💾',
            color: 0x607D8B,
            staffOnly: true
        },
        misc: {
            name: 'Miscellaneous',
            description: 'Miscellaneous commands and features',
            emoji: '🍰',
            color: 0xE91E63
        }
    };

    const mainEmbed = createMainEmbed(message, commandDatabase, isStaff, prefix, categories);
    
    const dropdown = createCategoryDropdown(categories, isStaff);

    const helpMessage = await message.channel.send({
        embeds: [mainEmbed],
        components: [dropdown]
    });

    setupDropdownCollector(helpMessage, message, commandDatabase, isStaff, prefix, categories);
}

function createMainEmbed(message, commandDatabase, isStaff, prefix, categories) {
    const totalCommands = Object.values(commandDatabase).filter(cmd => !cmd.staffOnly || isStaff).length;
    const staffCommands = Object.values(commandDatabase).filter(cmd => cmd.staffOnly && isStaff).length;

    const embed = new EmbedBuilder()
        .setTitle('🎯 Command Help Center')
        .setDescription(`**Prefix:** \`${prefix}\` | **Available Commands:** ${totalCommands}${isStaff ? ` (${staffCommands} staff)` : ''}\n\nBrowse commands by category using the dropdown below!`)
        .addFields(
            { 
                name: '📖 Quick Guide', 
                value: `• \`${prefix}help [command]\` - Specific command info\n• \`${prefix}help [category]\` - Category commands\n• Use dropdown for navigation`, 
                inline: false 
            },
            { 
                name: '🚀 Popular Commands', 
                value: `• **Utility**: \`${prefix}ping\`, \`${prefix}afk\`, \`${prefix}calculate\`\n• **Invites**: \`${prefix}invites\`, \`${prefix}leaderboard\`\n• **Moderation**: \`${prefix}kick\`, \`${prefix}ban\`, \`${prefix}warn\``, 
                inline: false 
            }
        )
        .setColor(categories.main.color)
        .setFooter({ 
            text: `${message.client.user.username} • Type "${prefix}help [command]" for details`,
            iconURL: message.client.user.displayAvatarURL()
        })
        .setTimestamp();

    return embed;
}

function createCategoryDropdown(categories, isStaff) {
    const options = [
        {
            label: 'Main Menu',
            description: 'Return to main help menu',
            value: 'main',
            emoji: '🏠'
        }
    ];

    Object.entries(categories).forEach(([key, category]) => {
        if (key !== 'main' && (!category.staffOnly || isStaff)) {
            options.push({
                label: category.name,
                description: category.description,
                value: key,
                emoji: category.emoji
            });
        }
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_category')
        .setPlaceholder('📂 Select a category...')
        .addOptions(options);

    return new ActionRowBuilder().addComponents(selectMenu);
}

function setupDropdownCollector(helpMessage, message, commandDatabase, isStaff, prefix, categories) {
    const collector = helpMessage.createMessageComponentCollector({
        filter: i => i.user.id === message.author.id && i.customId === 'help_category',
        time: 120000
    });

    collector.on('collect', async i => {
        await i.deferUpdate();
        
        const selectedCategory = i.values[0];
        const embed = selectedCategory === 'main' 
            ? createMainEmbed(message, commandDatabase, isStaff, prefix, categories)
            : createCategoryEmbed(selectedCategory, commandDatabase, isStaff, prefix, categories);

        await helpMessage.edit({ embeds: [embed] });
    });

    collector.on('end', async () => {
        try {
            const disabledDropdown = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('help_category_expired')
                    .setPlaceholder('⏰ Menu expired - use help command again')
                    .setDisabled(true)
                    .addOptions({
                        label: 'Menu Expired',
                        value: 'expired',
                        emoji: '⏰'
                    })
            );

            await helpMessage.edit({ components: [disabledDropdown] });
        } catch (error) {
        }
    });
}

function createCategoryEmbed(categoryKey, commandDatabase, isStaff, prefix, categories) {
    const category = categories[categoryKey];
    const commands = getCommandsByCategory(categoryKey, commandDatabase, isStaff);
    
    const embed = new EmbedBuilder()
        .setTitle(`${category.emoji} ${category.name}`)
        .setDescription(category.description)
        .setColor(category.color)
        .setFooter({ 
            text: `Use "${prefix}help [command]" for detailed info • ${commands.length} commands`,
            iconURL: null
        })
        .setTimestamp();

    if (commands.length === 0) {
        embed.addFields({
            name: 'No Commands Available',
            value: 'There are no commands in this category for your permission level.',
            inline: false
        });
    } else {
        const chunkSize = 6;
        for (let i = 0; i < commands.length; i += chunkSize) {
            const chunk = commands.slice(i, i + chunkSize);
            const commandList = chunk.map(cmd => {
                const staffIcon = cmd.staffOnly ? ' 🔒' : '';
                return `• \`${cmd.name}\` - ${cmd.description}${staffIcon}`;
            }).join('\n');
            
            embed.addFields({
                name: i === 0 ? `Commands` : '\u200b',
                value: commandList,
                inline: false
            });
        }
    }

    return embed;
}

function getCommandsByCategory(categoryKey, commandDatabase, isStaff) {
    const categoryMap = {
        moderation: ['kick', 'ban', 'tempban', 'lock', 'unlock', 'massban', 'masskick', 'warn', 'mute', 'restrict', 'everyone'],
        cases: ['cases', 'cremove'],
        utility: ['ping', 'help', 'purge', 'nuke', 'notify', 'calculate'],
        invites: ['invites', 'inviter', 'invitecodes', 'leaderboard'],
        giveaways: ['gcreate', 'greroll', 'gend'],
        afk: ['afk', 'afklist'],
        tracking: ['messages', 'rmsg'],
        welcome: ['greet'],
        backup: ['bcreate', 'binterval', 'bamount'],
        misc: ['tag', 'review', 'rchannel']
    };

    const commandKeys = categoryMap[categoryKey] || [];
    return commandKeys
        .map(key => commandDatabase[key])
        .filter(cmd => cmd && (!cmd.staffOnly || isStaff))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function getCategoryColor(category) {
    const colors = {
        'Moderation': 0xFF0000,
        'Cases': 0xFFA500,
        'Utility': 0x00FF00,
        'Invites': 0x9C27B0,
        'Giveaways': 0xFFD700,
        'AFK': 0x808080,
        'Tracking': 0x2196F3,
        'Welcome': 0x4CAF50,
        'Backup': 0x607D8B,
        'Reviews': 0xFFC107,
        'Tags': 0xE91E63
    };
    return colors[category] || 0x5865F2;
}
