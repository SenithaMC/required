const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const config = require('../../config');
const db = require('../../utils/db');

const commandDatabase = {
    kick: {
        name: 'kick',
        description: 'Kick a user from the server',
        usage: `kick <user> [reason]`,
        category: 'Moderation',
        aliases: [],
        staffOnly: true,
        details: 'Removes a user from the server. They can rejoin with another invitation.'
    },
    ban: {
        name: 'ban',
        description: 'Ban a user from the server',
        usage: `ban <user> [reason]`,
        category: 'Moderation',
        aliases: [],
        staffOnly: true,
        details: 'Permanently removes a user from the server. Banned users cannot rejoin unless unbanned.'
    },
    tempban: {
        name: 'tempban',
        description: 'Temporarily ban a user',
        usage: `tempban <user> <duration> [reason]`,
        category: 'Moderation',
        aliases: ['tban'],
        staffOnly: true,
        details: 'Temporarily bans a user. Duration format: 1d, 2h, 30m, etc.'
    },
    lock: {
        name: 'lock',
        description: 'Lock a channel',
        usage: `lock [channel] [reason]`,
        category: 'Moderation',
        aliases: [],
        staffOnly: true,
        details: 'Locks a channel to prevent members from sending messages.'
    },
    unlock: {
        name: 'unlock',
        description: 'Unlock a channel',
        usage: `unlock [channel]`,
        category: 'Moderation',
        aliases: [],
        staffOnly: true,
        details: 'Unlocks a previously locked channel.'
    },
    massban: {
        name: 'massban',
        description: 'Ban all members with a specific role',
        usage: `massban <role> [reason]`,
        category: 'Moderation',
        aliases: ['mban'],
        staffOnly: true,
        details: 'Bans every member who has the specified role. Use with caution.'
    },
    masskick: {
        name: 'masskick',
        description: 'Kick all members with a specific role',
        usage: `masskick <role> [reason]`,
        category: 'Moderation',
        aliases: ['mkick'],
        staffOnly: true,
        details: 'Kicks every member who has the specified role.'
    },
    warn: {
        name: 'warn',
        description: 'Issue a warning to a member',
        usage: `warn <user> <reason>`,
        category: 'Moderation',
        aliases: [],
        staffOnly: true,
        details: 'Sends a warning to the user and logs it for moderation tracking.'
    },
    mute: {
        name: 'mute',
        description: 'Mute a user in the server',
        usage: `mute <user> <duration> [reason]`,
        category: 'Moderation',
        aliases: ['silence'],
        staffOnly: true,
        details: 'Temporarily mutes a user for specified duration.'
    },
    restrict: {
        name: 'restrict',
        description: 'Restrict commands for non-admin members',
        usage: `restrict [enable/disable] [role/channel]`,
        category: 'Moderation',
        aliases: [],
        staffOnly: true,
        details: 'Restricts bot commands to administrators only with exemptions.'
    },
    everyone: {
        name: 'everyone',
        description: 'Ghost ping every user in the server',
        usage: `everyone`,
        category: 'Moderation',
        aliases: ['ghostping', 'massping'],
        staffOnly: true,
        details: 'Sends a ghost ping to every human member without confirmation.'
    },

    cases: {
        name: 'cases',
        description: 'View all cases for a user',
        usage: `cases [user]`,
        category: 'Cases',
        aliases: ['warnings'],
        staffOnly: true,
        details: 'Shows all recorded moderation cases for the specified user.'
    },
    cremove: {
        name: 'cremove',
        description: 'Reset all cases for a user',
        usage: `cremove <user>`,
        category: 'Cases',
        aliases: ['unwarn', 'removecase'],
        staffOnly: true,
        details: 'Completely clears all recorded cases for the specified user.'
    },

    ping: {
        name: 'ping',
        description: 'Check the bot\'s latency',
        usage: `ping`,
        category: 'Utility',
        aliases: [],
        staffOnly: false,
        details: 'Shows the bot\'s current latency and API response time.'
    },
    help: {
        name: 'help',
        description: 'Show command information',
        usage: `help [command]`,
        category: 'Utility',
        aliases: ['h', 'commands'],
        staffOnly: false,
        details: 'Displays information about available commands or specific command details.'
    },
    purge: {
        name: 'purge',
        description: 'Delete multiple messages',
        usage: `purge <amount>`,
        category: 'Utility',
        aliases: ['clear'],
        staffOnly: true,
        details: 'Deletes a specified number of recent messages in a channel.'
    },
    nuke: {
        name: 'nuke',
        description: 'Completely clear a channel',
        usage: `nuke`,
        category: 'Utility',
        aliases: [],
        staffOnly: true,
        details: 'Wipes the entire channel by recreating it.'
    },
    notify: {
        name: 'notify',
        description: 'Send DM notifications',
        usage: `notify <user|role|ALL> <message>`,
        category: 'Utility',
        aliases: ['dm', 'message', 'alert'],
        staffOnly: true,
        details: 'Sends direct messages to users, roles, or all server members.'
    },
    calculate: {
        name: 'calculate',
        description: 'Perform mathematical calculations',
        usage: `calculate <expression>`,
        category: 'Utility',
        aliases: ['calc', 'math'],
        staffOnly: false,
        details: 'Evaluates mathematical expressions with +, -, *, /, %, ^, √, etc.'
    },

    invites: {
        name: 'invites',
        description: 'Check invite statistics',
        usage: `invites [user]`,
        category: 'Invites',
        aliases: [],
        staffOnly: false,
        details: 'Displays invite statistics including valid, left, and fake invites.'
    },
    inviter: {
        name: 'inviter',
        description: 'See who invited a user',
        usage: `inviter [user]`,
        category: 'Invites',
        aliases: [],
        staffOnly: false,
        details: 'Shows the member who invited a user and their invite stats.'
    },
    invitecodes: {
        name: 'invitecodes',
        description: 'List invite codes by user',
        usage: `invitecodes [user]`,
        category: 'Invites',
        aliases: ['icodes'],
        staffOnly: false,
        details: 'Displays all invite codes created by a user with usage statistics.'
    },
    leaderboard: {
        name: 'leaderboard',
        description: 'View invite leaderboard',
        usage: `leaderboard [page]`,
        category: 'Invites',
        aliases: ['lb', 'top'],
        staffOnly: false,
        details: 'Shows a paginated leaderboard of members based on invites.'
    },

    gcreate: {
        name: 'gcreate',
        description: 'Create a new giveaway',
        usage: `gcreate <winners> <prize> <time> [role]`,
        category: 'Giveaways',
        aliases: [],
        staffOnly: true,
        details: 'Starts a new giveaway with specified winners, prize, duration, and optional role restriction.'
    },
    greroll: {
        name: 'greroll',
        description: 'Reroll giveaway winners',
        usage: `greroll <message-id> [winners]`,
        category: 'Giveaways',
        aliases: [],
        staffOnly: true,
        details: 'Selects new winners for an ended giveaway.'
    },
    gend: {
        name: 'gend',
        description: 'End a giveaway immediately',
        usage: `gend <message-id> [winners]`,
        category: 'Giveaways',
        aliases: [],
        staffOnly: true,
        details: 'Ends a running giveaway immediately and announces winners.'
    },

    afk: {
        name: 'afk',
        description: 'Set your AFK status',
        usage: `afk [reason]`,
        category: 'AFK',
        aliases: [],
        staffOnly: false,
        details: 'Sets your AFK status and notifies others when mentioned.'
    },
    afklist: {
        name: 'afklist',
        description: 'View all AFK members',
        usage: `afklist`,
        category: 'AFK',
        aliases: [],
        staffOnly: false,
        details: 'Displays all members with AFK status and their reasons.'
    },

    messages: {
        name: 'messages',
        description: 'Show message count',
        usage: `messages [user]`,
        category: 'Tracking',
        aliases: ['msgcount', 'messagecount'],
        staffOnly: false,
        details: 'Shows total messages sent by you or another user in the server.'
    },
    rmsg: {
        name: 'rmsg',
        description: 'Reset message counters',
        usage: `rmsg [user/role]`,
        category: 'Tracking',
        aliases: ['resetmessages', 'clearmessages'],
        staffOnly: true,
        details: 'Resets message counters for users, roles, or entire server.'
    },

    greet: {
        name: 'greet',
        description: 'Set welcome messages',
        usage: `greet <channel> <message> [timeout]`,
        category: 'Welcome',
        aliases: ['welcome'],
        staffOnly: true,
        details: 'Sets a channel for welcome messages when users join the server.'
    },

    bcreate: {
        name: 'bcreate',
        description: 'Create a comprehensive backup of server data',
        usage: `${prefix}bcreate <name>`,
        category: 'Backup',
        aliases: ['backupcreate'],
        staffOnly: true,
        details: 'Creates a backup of server data with the specified name.'
    },
    bauto: {
        name: 'bauto',
        description: 'Configure automatic backups',
        usage: `${prefix}bauto <on/off> OR ${prefix}bauto <interval> <amount>`,
        category: 'Backup',
        aliases: ['backupauto'],
        staffOnly: true,
        details: 'Enables/disables automatic backups or sets interval and amount.'
    },
    bload: {
        name: 'bload',
        description: 'Load a created backup',
        usage: `${prefix}bload [name]`,
        category: 'Backup',
        aliases: ['backupload'],
        staffOnly: true,
        details: 'Loads a backup using a dropdown menu or by specifying the name.'
    },
    bview: {
        name: 'bview',
        description: 'View comprehensive backup details including server structure',
        usage: `${prefix}bview <name>`,
        category: 'Backup',
        aliases: ['backupview'],
        staffOnly: true,
        details: 'Displays detailed information about a specific backup.'
    },
    blist: {
        name: 'blist',
        description: 'Show created backup list',
        usage: `${prefix}blist`,
        category: 'Backup',
        aliases: ['backuplist'],
        staffOnly: true,
        details: 'Lists all backups created for the server.'
    },
    bdel: {
        name: 'bdel',
        description: 'Delete a created backup',
        usage: `${prefix}bdel <name>`,
        category: 'Backup',
        aliases: ['backupdelete'],
        staffOnly: true,
        details: 'Deletes a specified backup from the server.'
    },

    review: {
        name: 'review',
        description: 'Create a service review',
        usage: `review [service] [rating] [description]`,
        category: 'Misc.',
        aliases: ['rate', 'feedback'],
        staffOnly: false,
        details: 'Creates a review for a service. Use without arguments for interactive menu.'
    },
    rchannel: {
        name: 'rchannel',
        description: 'Set review channel',
        usage: `rchannel <channel>`,
        category: 'Misc.',
        aliases: ['reviewchannel'],
        staffOnly: true,
        details: 'Sets the channel where reviews will be posted.'
    },

    tag: {
        name: 'tag',
        description: 'Create and manage message tags',
        usage: `tag <create|send|list|delete|info> [args]`,
        category: 'Misc.',
        aliases: ['t'],
        staffOnly: false,
        details: 'Manages message tags for quick responses. Use "tag list" to see all commands.'
    }
};

module.exports = {
  name: 'help',
  description: 'List all commands or get info about a specific command',
  options: [
    {
      name: 'command',
      description: 'Get detailed info about a specific command',
      type: 3,
      required: false,
      choices: [
        { name: 'kick', value: 'kick' },
        { name: 'ban', value: 'ban' },
        { name: 'tempban', value: 'tempban' },
        { name: 'lock', value: 'lock' },
        { name: 'unlock', value: 'unlock' },
        { name: 'massban', value: 'massban' },
        { name: 'masskick', value: 'masskick' },
        { name: 'warn', value: 'warn' },
        { name: 'mute', value: 'mute' },
        { name: 'restrict', value: 'restrict' },
        { name: 'everyone', value: 'everyone' },
        { name: 'cases', value: 'cases' },
        { name: 'cremove', value: 'cremove' },
        { name: 'ping', value: 'ping' },
        { name: 'help', value: 'help' },
        { name: 'purge', value: 'purge' },
        { name: 'nuke', value: 'nuke' },
        { name: 'notify', value: 'notify' },
        { name: 'calculate', value: 'calculate' },
        { name: 'invites', value: 'invites' },
        { name: 'inviter', value: 'inviter' },
        { name: 'invitecodes', value: 'invitecodes' },
        { name: 'leaderboard', value: 'leaderboard' },
        { name: 'gcreate', value: 'gcreate' },
        { name: 'greroll', value: 'greroll' }
      ]
    }
  ],

  async execute(interaction) {
    const commandQuery = interaction.options.getString('command');
    const isStaff = interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages);

    const guildPrefix = await db.getGuildPrefix(interaction.guild.id);
    const prefix = guildPrefix || config.prefix;

    if (commandQuery) {
      const commandKey = commandQuery.toLowerCase();
      const command = commandDatabase[commandKey];

      const aliasCommand = Object.values(commandDatabase).find(cmd => 
        cmd.aliases.includes(commandKey)
      );

      const targetCommand = command || aliasCommand;

      if (!targetCommand) {
        return interaction.reply({
          content: `❌ Command \`${commandQuery}\` not found. Use \`/help\` to see all available commands.`,
          ephemeral: true
        });
      }

      if (targetCommand.staffOnly && !isStaff) {
        return interaction.reply({
          content: '❌ You don\'t have permission to view this command.',
          ephemeral: true
        });
      }

      const embed = createCommandEmbed(targetCommand, prefix, interaction);
      return interaction.reply({ embeds: [embed] });
    }

    await showInteractiveHelp(interaction, commandDatabase, isStaff, prefix);
  }
};

async function showInteractiveHelp(interaction, commandDatabase, isStaff, prefix) {
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

    const mainEmbed = createMainEmbed(interaction, commandDatabase, isStaff, prefix, categories);
    const dropdown = createCategoryDropdown(categories, isStaff);

    const reply = await interaction.reply({
        embeds: [mainEmbed],
        components: [dropdown],
        fetchReply: true
    });

    setupDropdownCollector(reply, interaction, commandDatabase, isStaff, prefix, categories);
}

function createMainEmbed(message, commandDatabase, isStaff, prefix, categories) {
    const totalCommands = Object.values(commandDatabase).filter(cmd => !cmd.staffOnly || isStaff).length;
    const staffCommands = Object.values(commandDatabase).filter(cmd => cmd.staffOnly && isStaff).length;

    const defaultPrefix = config.prefix;
    const isCustomPrefix = prefix !== defaultPrefix;

    let prefixDisplay = `\`${prefix}\``;
    if (isCustomPrefix) {
        prefixDisplay += ` (default: \`${defaultPrefix}\` also works)`;
    }

    const embed = new EmbedBuilder()
        .setTitle('🎯 Command Help Center')
        .setDescription(`**Prefix:** ${prefixDisplay} | **Available Commands:** ${totalCommands}${isStaff ? ` (${staffCommands} staff)` : ''}\n\nBrowse commands by category using the dropdown below!`)
        .addFields(
            { 
                name: '📖 Quick Guide', 
                value: `• \`${prefix}help [command]\` - Specific command info\n• \`${defaultPrefix}help [command]\` - Also works${isCustomPrefix ? '\n• Both prefixes work for all commands' : ''}`, 
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

function setupDropdownCollector(helpMessage, interaction, commandDatabase, isStaff, prefix, categories) {
    const collector = helpMessage.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && i.customId === 'help_category',
        time: 120000
    });

    collector.on('collect', async i => {
        await i.deferUpdate();
        
        const selectedCategory = i.values[0];
        const embed = selectedCategory === 'main' 
            ? createMainEmbed(interaction, commandDatabase, isStaff, prefix, categories)
            : createCategoryEmbed(selectedCategory, commandDatabase, isStaff, prefix, interaction);

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

function createCategoryEmbed(categoryKey, commandDatabase, isStaff, prefix, interaction) {
    const categories = {
        main: { name: 'Main Menu', emoji: '🏠', color: 0x5865F2 },
        moderation: { name: 'Moderation', emoji: '🛡️', color: 0xFF0000 },
        cases: { name: 'Case Management', emoji: '📋', color: 0xFFA500 },
        utility: { name: 'Utility', emoji: '🔧', color: 0x00FF00 },
        invites: { name: 'Invites', emoji: '📖', color: 0x9C27B0 },
        giveaways: { name: 'Giveaways', emoji: '🎉', color: 0xFFD700 },
        afk: { name: 'AFK System', emoji: '💤', color: 0x808080 },
        tracking: { name: 'Message Tracking', emoji: '📊', color: 0x2196F3 },
        welcome: { name: 'Welcome System', emoji: '👋', color: 0x4CAF50 },
        backup: { name: 'Backup System', emoji: '💾', color: 0x607D8B },
        misc: { name: 'Miscellaneous', emoji: '🍰', color: 0xE91E63 }
    };

    const category = categories[categoryKey];
    const commands = getCommandsByCategory(categoryKey, commandDatabase, isStaff);
    
    const embed = new EmbedBuilder()
        .setTitle(`${category.emoji} ${category.name}`)
        .setDescription(getCategoryDescription(categoryKey))
        .setColor(category.color)
        .setFooter({ 
            text: `Use "/help command:name" for detailed info • ${commands.length} commands`,
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

function getCategoryDescription(categoryKey) {
    const descriptions = {
        moderation: 'Server moderation and management commands',
        cases: 'Warning and case management commands',
        utility: 'General utility and fun commands',
        invites: 'Server invite tracking and management',
        giveaways: 'Giveaway creation and management',
        afk: 'Away From Keyboard status management',
        tracking: 'Message count and statistics',
        welcome: 'Welcome message configuration',
        backup: 'Server data backup and restoration',
        misc: 'Miscellaneous commands and features'
    };
    return descriptions[categoryKey] || 'Commands for this category';
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

function createCommandEmbed(command, prefix, interaction) {
    const embed = new EmbedBuilder()
        .setTitle(`Command: ${command.name}`)
        .setDescription(command.details)
        .setColor(getCategoryColor(command.category))
        .addFields(
            { name: '📝 Description', value: command.description, inline: true },
            { name: '📂 Category', value: command.category, inline: true },
            { name: '🔤 Aliases', value: command.aliases.length ? `\`${command.aliases.join('`, `')}\`` : 'None', inline: true },
            { name: '💻 Usage', value: `\`${prefix}${command.usage}\``, inline: false },
            { name: '👮 Staff Only', value: command.staffOnly ? 'Yes' : 'No', inline: true }
        )
        .setFooter({ 
            text: `Use "/help" to see all commands • ${command.category}`,
            iconURL: interaction.client.user.displayAvatarURL()
        })
        .setTimestamp();

    return embed;
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
        'Misc.': 0xE91E63
    };
    return colors[category] || 0x5865F2;
}
