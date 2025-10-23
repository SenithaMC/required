const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const config = require('../../../config');
const db = require('../../../utils/db');
const gcreate = require('../giveaway/gcreate');
const leaderboard = require('../invites/leaderboard');
const restrict = require('../modaration/restrict');
const calculate = require('./calculate');

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
            staffOnly: false,
            details: 'Starts a new giveaway in the server. Allows setting the number of winners, the prize, the duration, and optionally restricting participation to a specific role.'
        },
        greroll: {
            name: 'Giveaways',
            description: 'Reroll winners for a giveaway',
            usage: `${prefix}greroll <message-id> [winners]`,
            category: 'Utility',
            aliases: [],
            staffOnly: false,
            details: 'Selects new winners for an already ended giveaway. Requires the giveaway message ID and optionally the number of winners to reroll.'
        },
        gend: {
            name: 'Giveaways',
            description: 'End a giveaway immediately',
            usage: `${prefix}gend <message-id> [winners]`,
            category: 'Utility',
            aliases: [],
            staffOnly: false,
            details: 'Ends a running giveaway immediately. Allows specifying the number of winners, and announces the winners once ended.'
        },
        invites: {
            name: 'invites',
            description: 'Check your or another user’s invite statistics.',
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
            details: 'Shows the member who invited a user, along with the inviter’s invite statistics.'
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
            description: 'View the server’s invite leaderboard.',
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
            details: 'This will wipe the entire channel’s messages by recreating it.'
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
        calculate: {
            name: 'calculate',
            description: 'Performs mathematical calculations: +, -, *, /, %, ^, √, ² etc.',
            usage: `${prefix}calculate <expression>`,
            category: 'Utility',
            aliases: ['calc'],
            staffOnly: false,
            details: 'Evaluates mathematical expressions using basic arithmetic operations and functions like square root and exponentiation.'
        }
    };

    const query = args[0]?.toLowerCase();

    if (query && commandDetails[query]) {
      const command = commandDetails[query];

      if (command.staffOnly && !isStaff) {
        return message.channel.send('❌ You don’t have permission to view this command.');
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
        moderation: {
            name: '**<:shield:1416513072121516163> Moderation Commands**',
            description: 'Commands for server moderation (Staff only)',
            commands: [
                { name: `\`${prefix}kick\``, description: 'Kick a user from the server' },
                { name: `\`${prefix}ban\``, description: 'Ban a user from the server' },
                { name: `\`${prefix}tempban\``, description: 'Temporarily ban a user' },
                { name: `\`${prefix}lock\``, description: 'Lock a channel' },
                { name: `\`${prefix}unlock\``, description: 'Unlock a channel' },
                { name: `\`${prefix}massban\``, description: 'Ban all members with a specific role at once.' },
                { name: `\`${prefix}masskick\``, description: 'Kick all members with a specific role at once.' },
                { name: `\`${prefix}warn\``, description: 'Issue a warning to a member.' },
                { name: `\`${prefix}cases\``, description: 'View all cases for a user' },
                { name: `\`${prefix}cremove\``, description: 'Reset all cases for a user.' },
                { name: `\`${prefix}restrict\``, description: 'Restrict all commands for non-admin members' },
                { name: `\`${prefix}mute\``, description: 'Mute a user in the server' }
            ],
            staffOnly: true
        },
        utility: {
            name: '**<:wrench:1416513217634762914> Utility Commands**',
            description: 'General utility commands',
            commands: [
                { name: `\`${prefix}help\``, description: 'Show this help menu' },
                { name: `\`${prefix}ping\``, description: 'Check bot latency' },
                { name: `\`${prefix}purge\``, description: `Delete a specified number of recent messages in a channel.` },
                { name: `\`${prefix}nuke\``, description: `Completely clears a channel by cloning and deleting it.` },
                { name: `\`${prefix}greet\``, description: `Set a channel for welcome messages when users join the server` },
                { name: `\`${prefix}everyone\``, description: `Ghost ping every user in the server` },
                { name: `\`${prefix}notify\``, description: `Send a direct message notification to a user, role, or everyone.` },
                { name: `\`${prefix}greet\``, description: 'Set a channel for welcome messages when users join the server' },
                { name: `\`${prefix}everyone\``, description: 'Ghost ping every user in the server' },
                {name: `\`${prefix}calculate\``, description: 'Performs mathematical calculations: +, -, *, /, %, ^, √, ² etc.' }
            ],
            staffOnly: false
        },
        giveaways: {
            name: '**<:mc_tada1:1409569448553353226> Giveaways**',
            description: 'Commands to manage giveaways',
            commands: [
                { name: `\`${prefix}gcreate\``, description: 'Create a new giveaway' },
                { name: `\`${prefix}greroll\``, description: 'Reroll winners for a giveaway' },
                { name: `\`${prefix}gend\``, description: 'End a giveaway immediately' }
            ],
            staffOnly: false
        },
        invites: {
            name: '**<:mc_book_n_quill:1421489693807345684> Invites**',
            description: 'Commands to manage and view invites',
            commands: [
                { name: `\`${prefix}invites\``, description: `Check your or another user’s invite statistics.` },
                { name: `\`${prefix}inviter\``, description: `See who invited a specific user.` },
                { name: `\`${prefix}invitecodes\``, description: `List all invite codes created by a user.` },
                { name: `\`${prefix}leaderboard\``, description: `View the server’s invite leaderboard.` }
            ],
            staffOnly: false
        }
    };

    const embed = new EmbedBuilder()
        .setTitle(`${config.bot_name} - Help Menu`)
        .setDescription(`**Prefix for this guild:** \`${prefix}\`\nUse \`${prefix}help [command]\` to get info on a specific command.`)
        .setColor(0x5865F2)
        .setFooter({ 
            text: `${config.bot_name} • Help`, 
            iconURL: message.client.user.displayAvatarURL({ dynamic: true })
        })
        .setTimestamp();

    for (const [key, category] of Object.entries(commandCategories)) {
        if (category.staffOnly && !isStaff) continue;
        
        const commandList = category.commands.map(cmd => `• ${cmd.name} - ${cmd.description}`).join('\n');
        embed.addFields({ 
            name: category.name, 
            value: `${category.description}\n${commandList}`,
            inline: false 
        });
    }

    return message.channel.send({ embeds: [embed] });
  }
};
