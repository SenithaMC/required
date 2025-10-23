const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const config = require('../../../config');
const db = require('../../../utils/db');

module.exports = {
  name: 'help',
  description: 'List all commands or get info about a specific command',
  usage: `${config.prefix}help [command]`,

  async execute(message, args) {
    const isStaff = message.member.permissions.has(PermissionsBitField.Flags.ManageMessages);
    const guildPrefix = await db.getGuildPrefix(message.guild.id);
    const prefix = guildPrefix || config.prefix;

    const commandDetails = {
        kick: {
            name: 'Kick',
            description: 'Kick a user from the server',
            usage: `${prefix}kick [user] [reason]`,
            category: 'Moderation',
            aliases: [],
            staffOnly: true,
            details: 'This command allows moderators to remove a user from the server. The user can rejoin if they have another invitation.'
        },
        ban: {
            name: 'ban',
            description: 'Ban a user from the server',
            usage: `ban [user] [reason]`,
            category: 'Moderation',
            aliases: [],
            staffOnly: true,
            details: 'This command permanently removes a user from the server. Banned users cannot rejoin unless unbanned by a moderator.'
        },
        tempban: {
            name: 'tempban',
            description: 'Temporarily ban a user from the server',
            usage: `${prefix}tempban [user] [duration] [reason]`,
            category: 'Moderation',
            aliases: [],
            staffOnly: true,
            details: 'This command temporarily removes a user from the server for a specified duration. Format duration as 1d, 2h, 30m, etc.'
        },
        lock: {
            name: 'lock',
            description: 'Lock a channel',
            usage: `${prefix}lock [channel] [reason]`,
            category: 'Moderation',
            aliases: [],
            staffOnly: true,
            details: 'This command locks a channel to prevent members from sending messages. Useful for emergency situations.'
        },
        unlock: {
            name: 'unlock',
            description: 'Unlock a channel',
            usage: `${prefix}unlock [channel]`,
            category: 'Moderation',
            aliases: [],
            staffOnly: true,
            details: 'This command unlocks a previously locked channel, allowing members to send messages again.'
        },
        ping: {
            name: 'ping',
            description: 'Check the bot\'s latency',
            usage: `${prefix}ping`,
            category: 'Utility',
            aliases: [],
            staffOnly: false,
            details: 'This command shows the bot\'s current latency and API response time.'
        },
        help: {
            name: 'help',
            description: 'Show command information',
            usage: `${prefix}help [command]`,
            category: 'Utility',
            aliases: [],
            staffOnly: false,
            details: 'This command displays information about all available commands or details about a specific command.'
        },
        gcreate: {
            name: 'gcreate',
            description: 'Create a new giveaway',
            usage: `${prefix}gcreate [no-of-winners] <prize> <time> [@role]`,
            category: 'Giveaways',
            aliases: [],
            staffOnly: true,
            details: 'Starts a new giveaway in the server. Allows setting the number of winners, the prize, the duration, and optionally restricting participation to a specific role.'
        },
        greroll: {
            name: 'Giveaways',
            description: 'Reroll winners for a giveaway',
            usage: `${prefix}greroll <message-id> [winners]`,
            category: 'Utility',
            aliases: [],
            staffOnly: true,
            details: 'Selects new winners for an already ended giveaway. Requires the giveaway message ID and optionally the number of winners to reroll.'
        },
        gend: {
            name: 'Giveaways',
            description: 'End a giveaway immediately',
            usage: `${prefix}gend <message-id> [winners]`,
            category: 'Utility',
            aliases: [],
            staffOnly: true,
            details: 'Ends a running giveaway immediately. Allows specifying the number of winners, and announces the winners once ended.'
        },
        invites: {
            name: 'invites',
            description: 'Check your or another user\'s invite statistics.',
            usage: `${prefix}invites [@user]`,
            category: 'Invites',
            aliases: [],
            staffOnly: false,
            details: 'Displays the number of invites a user has made, including valid, left, and fake invites.'
        },
        inviter: {
            name: 'inviter',
            description: 'See who invited a specific user.',
            usage: `${prefix}inviter [@user]`,
            category: 'Invites',
            aliases: [],
            staffOnly: false,
            details: 'Shows the member who invited a user, along with the inviter\'s invite statistics.'
        },
        invitecodes: {
            name: 'invitecodes',
            description: 'List all invite codes created by a user.',
            usage: `${prefix}invitecodes [@user]`,
            category: 'Invites',
            aliases: ['icodes'],
            staffOnly: false,
            details: 'Displays all invite codes a user has created, along with usage counts, active members, and left members.'
        },
        leaderboard: {
            name: 'leaderboard',
            description: 'View the server\'s invite leaderboard.',
            usage: `${prefix}leaderboard [page]`,
            category: 'Invites',
            aliases: ['lb', 'top'],
            staffOnly: false,
            details: 'Shows a paginated leaderboard of members based on their total invites, including valid, left, and fake invites.'
        },
        massban: {
            name: 'massban',
            description: 'Ban all members with a specific role at once.',
            usage: `${prefix}massban <@role> [reason]`,
            category: 'Moderation',
            aliases: ['mban'],
            staffOnly: true,
            details: 'Bans every member who has the specified role. An optional reason can be provided. This action is irreversible.'
        },
        masskick: {
            name: 'masskick',
            description: 'Kick all members with a specific role at once.',
            usage: `${prefix}masskick <@role> [reason]`,
            category: 'Moderation',
            aliases: ['mkick'],
            staffOnly: true,
            details: 'Kicks every member who has the specified role. An optional reason can be provided. Review role members carefully before executing.'
        },
        warn: {
            name: 'warn',
            description: 'Issue a warning to a member.',
            usage: `${prefix}warn <@user> <reason>`,
            category: 'Moderation',
            aliases: [],
            staffOnly: true,
            details: 'Sends a warning to the mentioned user and logs it. Warnings track rule violations and help escalate moderation actions if needed.'
        },
        purge: {
            name: 'purge',
            description: 'Delete a specified number of recent messages in a channel.',
            usage: `${prefix}purge <number-of-messages>`,
            category: 'Utility',
            aliases: [],
            staffOnly: true,
            details: 'Useful for clearing spam or cleaning up chats quickly. Staff only.'
        },
        nuke: {
            name: 'nuke',
            description: 'Completely clears a channel by cloning and deleting it.',
            usage: `${prefix}nuke`,
            category: 'Utility',
            aliases: [],
            staffOnly: true,
            details: 'This will wipe the entire channel\'s messages by recreating it.'
        },
        cremove: {
            name: 'cremove',
            description: 'Reset all cases for a user.',
            usage: `${prefix}cremove <@user>`,
            category: 'Modaration',
            aliases: ['unwarn', 'removecase'],
            staffOnly: true,
            details: 'Completely clears all recorded cases for the specified user.'
        },
        cases: {
            name: 'cases',
            description: 'View all cases for a user',
            usage: `${prefix}cases [@user]`,
            category: 'Modaration',
            aliases: [],
            staffOnly: true,
            details: 'Shows all recorded cases for the specified user.'
        },
        greet: {
            name: 'greet',
            description: 'Set a channel for welcome messages when users join the server',
            usage: `${prefix}greet #<channel> <welcome-message> <message-timeout>`,
            category: 'Modaration',
            aliases: [],
            staffOnly: true,
            details: 'Shows all recorded cases for the specified user.'
        },
        restrict: {
            name: 'restrict',
            description: 'Restrict all commands for non-admin members',
            usage: `${prefix}restrict [enable/disable] [role/channel mentions]`,
            category: 'Modaration',
            aliases: [],
            staffOnly: true,
            details: 'Restrict all bot commands to administrators only, with optional role/channel exemptions.'
        },
        everyone: {
            name: 'everyone',
            description: 'Ghost ping every user in the server',
            usage: `${prefix}everyone`,
            category: 'Modaration',
            aliases: ['ghostping', 'massping'],
            staffOnly: true,
            details: 'Sends a ghost ping to every human member in the server without sending any confirmation or error messages.'
        },
        notify: {
            name: 'notify',
            description: 'Send a direct message notification to a user, role, or everyone.',
            usage: `${prefix}notify <user|role|ALL> <message>`,
            category: 'Utility',
            aliases: ['dm', 'message', 'alert'],
            staffOnly: true,
            details: 'Sends a direct message to a specified user, all members of a specified role, or every member in the server. Requires Manage Messages permission.'
        },
        mute: {
            name: 'mute',
            description: 'Mute a user in the server',
            usage: `${prefix}mute <@user> <duration> [reason]`,
            category: 'Modaration',
            aliases: ['silence'],
            staffOnly: true,
            details: 'Temporarily mutes a user for a specified duration, preventing them from sending messages or speaking in voice channels.'
        },
        afk: {
            name: 'afk',
            description: 'Set your AFK (Away From Keyboard) status',
            usage: `${prefix}afk [reason]`,
            category: 'Utility',
            aliases: [],
            staffOnly: false,
            details: 'Sets your AFK status with an optional reason. Notifies others when they mention you while you are AFK.'
        },
        afklist: {
            name: 'afklist',
            description: 'View a list of all members currently marked as AFK in the server',
            usage: `${prefix}afklist`,
            category: 'Utility',
            aliases: [],
            staffOnly: false,
            details: 'Displays a list of all members who have set their AFK status in the server, along with their reasons and timestamps.'
        },
        calculate: {
            name: 'calculate',
            description: 'Performs mathematical calculations: +, -, *, /, %, ^, √, ² etc.',
            usage: `${prefix}calculate <expression>`,
            category: 'Utility',
            aliases: ['calc', 'math'],
            staffOnly: false,
            details: 'Evaluates mathematical expressions using basic arithmetic operations and functions like square root and exponentiation.'
        },
        messages: {
            name: 'messages',
            description: 'Show your message count in this server',
            usage: `${prefix}messages [@user]`,
            category: 'Utility',
            aliases: ['msgcount', 'messagecount'],
            staffOnly: false,
            details: 'Shows the total number of messages you or another user have sent in this server.'
        },
        rmsg: {
            name: 'rmsg',
            description: 'Reset message counters for users or the entire server',
            usage: `${prefix}rmsg [@user/@role]`,
            category: 'Utility',
            aliases: ['resetmessages', 'clearmessages'],
            staffOnly: true,
            details: 'Resets message counters for specific users, roles, or the entire server. Requires Manage Messages permission.'
        }
    };

    const query = args[0]?.toLowerCase();

    if (query && commandDetails[query]) {
      const command = commandDetails[query];

      if (command.staffOnly && !isStaff) {
        return message.channel.send('❌ You don\'t have permission to view this command.');
      }

      const embed = new EmbedBuilder()
        .setColor(0x00FFE7)
        .setTitle(`Command: ${command.name}`)
        .setDescription(command.details)
        .addFields(
            { name: 'Description', value: command.description, inline: true },
            { name: 'Category', value: command.category, inline: true },
            { name: 'Aliases', value: command.aliases.length ? `\`${command.aliases.join('`, `')}\`` : 'None', inline: true },
            { name: 'Usage', value: `\`${command.usage}\`` || 'NONE', inline: false }
        )
        .setFooter({ text: `${config.bot_name} • Help`, iconURL: message.client.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    const commandCategories = {
        main: {
            name: 'Main Menu',
            description: 'Select a category from the dropdown below to explore commands',
            emoji: '🏠',
            color: 0x5865F2
        },
        moderation: {
            name: 'Moderation Commands',
            description: 'Commands for server moderation and management',
            emoji: '🛡️',
            color: 0xFF0000,
            staffOnly: true
        },
        utility: {
            name: 'Utility Commands',
            description: 'General utility and fun commands',
            emoji: '🔧',
            color: 0x00FF00
        },
        giveaways: {
            name: 'Giveaway Commands',
            description: 'Commands to create and manage giveaways',
            emoji: '🎉',
            color: 0xFFD700
        },
        invites: {
            name: 'Invite Commands',
            description: 'Commands to manage and track server invites',
            emoji: '📖',
            color: 0x9C27B0
        }
    };

    const createMainEmbed = () => {
        return new EmbedBuilder()
            .setTitle(`${config.bot_name} - Help Menu`)
            .setDescription(`**Prefix for this guild:** \`${prefix}\`\n**Total Commands:** ${Object.keys(commandDetails).length}\n\nSelect a category from the dropdown below to explore commands!`)
            .addFields(
                { 
                    name: '📖 How to use', 
                    value: `• Use \`${prefix}help [command]\` for specific command info\n• Navigate categories using the dropdown\n• Staff commands are marked with 🔒`, 
                    inline: false 
                },
                { 
                    name: '🔧 Quick Access', 
                    value: `• **Utility**: \`${prefix}ping\`, \`${prefix}afk\`, \`${prefix}calculate\`\n• **Giveaways**: \`${prefix}gcreate\`, \`${prefix}greroll\`\n• **Invites**: \`${prefix}invites\`, \`${prefix}leaderboard\``, 
                    inline: false 
                }
            )
            .setColor(commandCategories.main.color)
            .setFooter({ 
                text: `${config.bot_name} • Help Menu`, 
                iconURL: message.client.user.displayAvatarURL({ dynamic: true })
            })
            .setTimestamp();
    };

    const createCategoryEmbed = (categoryKey) => {
        const category = commandCategories[categoryKey];
        const commands = getCommandsByCategory(categoryKey);
        
        const embed = new EmbedBuilder()
            .setTitle(`${category.emoji} ${category.name}`)
            .setDescription(category.description)
            .setColor(category.color)
            .setFooter({ 
                text: `${config.bot_name} • ${category.name}`, 
                iconURL: message.client.user.displayAvatarURL({ dynamic: true })
            })
            .setTimestamp();

        if (commands.length === 0) {
            embed.addFields({
                name: 'No Commands',
                value: 'There are no commands available in this category for your permission level.',
                inline: false
            });
        } else {
            const chunkSize = 8;
            for (let i = 0; i < commands.length; i += chunkSize) {
                const chunk = commands.slice(i, i + chunkSize);
                const commandList = chunk.map(cmd => {
                    const staffIcon = cmd.staffOnly && isStaff ? ' 🔒' : '';
                    return `• \`${cmd.usage.split(' ')[0]}\` - ${cmd.description}${staffIcon}`;
                }).join('\n');
                
                embed.addFields({
                    name: i === 0 ? `Commands (${commands.length})` : '\u200b',
                    value: commandList,
                    inline: false
                });
            }
        }

        return embed;
    };

    const getCommandsByCategory = (categoryKey) => {
        const categoryMap = {
            moderation: ['kick', 'ban', 'tempban', 'lock', 'unlock', 'massban', 'masskick', 'warn', 'cases', 'cremove', 'restrict', 'mute', 'everyone'],
            utility: ['ping', 'help', 'purge', 'nuke', 'greet', 'notify', 'afk', 'afklist', 'calculate', 'messages', 'rmsg'],
            giveaways: ['gcreate', 'greroll', 'gend'],
            invites: ['invites', 'inviter', 'invitecodes', 'leaderboard']
        };

        const commandKeys = categoryMap[categoryKey] || [];
        return commandKeys
            .map(key => commandDetails[key])
            .filter(cmd => cmd && (!cmd.staffOnly || isStaff));
    };

    const createDropdown = () => {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category')
            .setPlaceholder('🏠 Select a category...')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Main Menu')
                    .setDescription('Return to the main help menu')
                    .setValue('main')
                    .setEmoji('🏠'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Moderation')
                    .setDescription('Server moderation commands')
                    .setValue('moderation')
                    .setEmoji('🛡️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Utility')
                    .setDescription('General utility commands')
                    .setValue('utility')
                    .setEmoji('🔧'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Giveaways')
                    .setDescription('Giveaway management commands')
                    .setValue('giveaways')
                    .setEmoji('🎉'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Invites')
                    .setDescription('Invite tracking commands')
                    .setValue('invites')
                    .setEmoji('📖')
            );

        return new ActionRowBuilder().addComponents(selectMenu);
    };

    const helpMessage = await message.channel.send({
        embeds: [createMainEmbed()],
        components: [createDropdown()]
    });

    const collector = helpMessage.createMessageComponentCollector({
        filter: i => i.user.id === message.author.id && i.customId === 'help_category',
        time: 60000
    });

    collector.on('collect', async i => {
        await i.deferUpdate();
        
        const selectedCategory = i.values[0];
        const embed = selectedCategory === 'main' 
            ? createMainEmbed() 
            : createCategoryEmbed(selectedCategory);

        await helpMessage.edit({ embeds: [embed] });
    });

    collector.on('end', async () => {
        try {
            const disabledDropdown = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('help_category_expired')
                    .setPlaceholder('❌ Menu expired - use help command again')
                    .setDisabled(true)
                    .addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Menu Expired')
                            .setValue('expired')
                            .setEmoji('⏰')
                    )
            );

            await helpMessage.edit({ components: [disabledDropdown] });
        } catch (error) {
            console.error('Error disabling help menu:', error);
        }
    });
  },

  handleComponent: async (interaction) => {
    if (interaction.customId === 'help_category') {
      return true;
    }
    return false;
  }
};
