const { Client, GatewayIntentBits, Collection, Partials, Events, REST, Routes, PermissionsBitField } = require('discord.js');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const mongoose = require('mongoose');
const db = require('./utils/db');
const GiveawayCleanup = require('./utils/giveawayCleanup');

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.Reaction,
    Partials.GuildMember
  ]
});

// Command collections
client.prefixCommands = new Collection();
client.slashCommands = new Collection();
client.componentHandlers = new Collection();
client.dbModels = new Collection();
client.invites = new Map();
client.prefixCache = new Map();
client.giveawayCleanup = new GiveawayCleanup(client);

// Cooldown map
const cooldowns = new Map();

// Recursive command loader
const loadCommands = async (type) => {
  const basePath = path.join(__dirname, 'commands', type);

  const readCommands = (dir) => {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        readCommands(fullPath);
      } else if (item.isFile() && item.name.endsWith('.js')) {
        try {
          const command = require(fullPath);

          if (!command.name || typeof command.execute !== 'function') {
            console.warn(`⚠️ Invalid ${type} command: ${item.name}`);
            continue;
          }

          if (type === 'prefix') {
            client.prefixCommands.set(command.name, command);
            if (command.aliases) command.aliases.forEach(alias => client.prefixCommands.set(alias, command));
            if (command.handleComponent) client.componentHandlers.set(command.name, command.handleComponent);
          } else if (type === 'slash') {
            client.slashCommands.set(command.name, command);
          }

          console.log(`✔ Loaded ${type} command: ${command.name}`);
        } catch (err) {
          console.error(`❌ Error loading ${type} command ${item.name}:`, err);
        }
      }
    }
  };

  readCommands(basePath);
};

// Register slash commands with Discord
const registerSlashCommands = async () => {
  try {
    const commands = [];
    
    // Get all slash commands data
    for (const [name, command] of client.slashCommands) {
      commands.push({
        name: name,
        description: command.description,
        options: command.options || [],
        default_permission: command.default_permission !== false
      });
    }

    const rest = new REST({ version: '10' }).setToken(config.token);
    
    console.log('🔄 Registering slash commands...');
    
    // Register commands globally
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    
    console.log(`✅ Successfully registered ${commands.length} slash commands globally`);
  } catch (error) {
    console.error('❌ Error registering slash commands:', error);
  }
};

// Load MongoDB models
const loadModels = () => {
  const modelsPath = path.join(__dirname, 'models');
  if (!fs.existsSync(modelsPath)) return;

  const modelFiles = fs.readdirSync(modelsPath).filter(file => file.endsWith('.js'));

  for (const file of modelFiles) {
    try {
      const modelPath = path.join(modelsPath, file);
      const model = require(modelPath);
      if (model.modelName) {
        client.dbModels.set(model.modelName, model);
        console.log(`✔ Loaded MongoDB model: ${model.modelName}`);
      }
    } catch (err) {
      console.error(`❌ Error loading model ${file}:`, err);
    }
  }
};

// Load events
const loadEvents = () => {
  const eventsPath = path.join(__dirname, 'events');
  if (!fs.existsSync(eventsPath)) return;

  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    try {
      const eventPath = path.join(eventsPath, file);
      const event = require(eventPath);

      if (event.once) client.once(event.name, (...args) => event.execute(...args, client));
      else client.on(event.name, (...args) => event.execute(...args, client));

      console.log(`✔ Loaded event: ${event.name}`);
    } catch (err) {
      console.error(`❌ Error loading event ${file}:`, err);
    }
  }
};

// Connect to MongoDB
const connectDatabase = async () => {
  try {
    if (!config.mongoURI) return false;
    await mongoose.connect(config.mongoURI);
    console.log('✅ Connected to MongoDB');
    return true;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    return false;
  }
};

// Initialize bot
const initializeBot = async () => {
  try {
    const dbConnected = await connectDatabase();
    if (!dbConnected) console.log('⚠️ Continuing without database connection');

    await loadCommands('prefix');
    await loadCommands('slash'); // Load slash commands
    loadModels();
    loadEvents();

    console.log(`📦 Loaded ${client.prefixCommands.size} prefix commands (including aliases)`);
    console.log(`📦 Loaded ${client.slashCommands.size} slash commands`);
    console.log(`📦 Loaded ${client.dbModels.size} database models`);

    if (!config.token) throw new Error('No token provided in config.json');
    await client.login(config.token);
  } catch (error) {
    console.error('❌ Error initializing bot:', error);
    process.exit(1);
  }
};

// Bot ready
client.once(Events.ClientReady, async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  if (config.giveawayCleanup?.enabled) {
    client.giveawayCleanup.start();
    console.log('✅ Giveaway cleanup service started');
  }

  // Cache invites for all guilds
  client.guilds.cache.each(async (guild) => {
    try {
      const invites = await guild.invites.fetch();
      client.invites.set(guild.id, new Map(invites.map(i => [i.code, i.uses])));
      console.log(`✅ Cached invites for ${guild.name}`);
    } catch (err) {
      console.error(`❌ Error caching invites for ${guild.name}:`, err);
    }
  });

  // Register slash commands after bot is ready
  await registerSlashCommands();
});

// Prefix command handler with cooldown & auto-delete spam
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  let prefix = client.prefixCache.get(message.guild.id);
  if (!prefix) {
    try {
      prefix = await db.getGuildPrefix(message.guild.id);
      client.prefixCache.set(message.guild.id, prefix);
    } catch (err) {
      console.error('Error getting guild prefix:', err);
      prefix = config.prefix;
    }
  }

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = client.prefixCommands.get(commandName);
  if (!command) return;

  // Command Restriction Check
  try {
    const CommandRestrict = client.dbModels.get('CommandRestrict');
    if (CommandRestrict) {
      const restrictData = await CommandRestrict.findOne({ guildId: message.guild.id, enabled: true });
      
      if (restrictData) {
        // Check if user is exempt from command restriction
        const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const hasExemptRole = restrictData.exemptRoles?.some(roleId => message.member.roles.cache.has(roleId));
        const isExemptChannel = restrictData.exemptChannels?.includes(message.channel.id);
        
        // Allow restrict command and exempt users
        const isRestrictCommand = ['restrict', 'lockcommands', 'cmdrestrict'].includes(commandName);
        
        if (!isAdmin && !hasExemptRole && !isExemptChannel && !isRestrictCommand) {
          const embed = new EmbedBuilder()
            .setTitle('🔒 Command Restricted')
            .setDescription('Commands are currently restricted to administrators only.')
            .addFields(
              { name: 'Reason', value: 'Server command restriction is active', inline: true },
              { name: 'Action', value: 'Contact server administrators', inline: true }
            )
            .setColor(0xFF0000)
            .setTimestamp();

          if (message.deletable) {
            await message.delete().catch(() => {});
          }

          return message.channel.send({ embeds: [embed] }).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 10000);
          });
        }
      }
    }
  } catch (err) {
    console.error('Command restriction check error:', err);
    // Continue with command execution if there's an error checking the restriction
  }
    
  // Cooldown
  const now = Date.now();
  const cooldownAmount = (config.commandCooldown || 15) * 1000; // 15 seconds
  if (!cooldowns.has(message.author.id)) cooldowns.set(message.author.id, new Map());
  const timestamps = cooldowns.get(message.author.id);

  if (timestamps.has(commandName)) {
    const expiration = timestamps.get(commandName) + cooldownAmount;
    if (now < expiration) {
      // Delete the spam message
      if (message.deletable) await message.delete().catch(() => {});

      // Optional: send a temporary warning
      return message.channel.send(`⏱️ Please wait ${((expiration - now)/1000).toFixed(1)}s before using \`${prefix}${commandName}\` again.`)
        .then(msg => setTimeout(() => msg.delete().catch(() => {}), 4000));
    }
  }

  // Set cooldown
  timestamps.set(commandName, now);
  setTimeout(() => timestamps.delete(commandName), cooldownAmount);

  // Execute the command
  try {
    console.log(`➡️ Prefix command (${prefix}): ${commandName} by ${message.author.tag}`);
    await command.execute(message, args);
  } catch (err) {
    console.error(`Prefix command error: ${commandName}`, err);
    if (message.channel) await message.channel.send('❌ There was an error executing that command.');
  }

  // Delete original command message if possible
  try {
    if (message.deletable) await message.delete();
  } catch (err) {
    console.log('Failed to delete command message:', err.message);
  }
});

// Interaction handler (buttons and slash commands)
client.on('interactionCreate', async interaction => {
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.slashCommands.get(interaction.commandName);
    
    if (!command) return;
    
    try {
      console.log(`➡️ Slash command: ${interaction.commandName} by ${interaction.user.tag}`);
      await command.execute(interaction);
    } catch (error) {
      console.error(`Slash command error: ${interaction.commandName}`, error);
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ 
          content: '❌ There was an error executing this command.', 
          ephemeral: true 
        });
      } else {
        await interaction.reply({ 
          content: '❌ There was an error executing this command.', 
          ephemeral: true 
        });
      }
    }
    return;
  }
  
  // Handle button interactions
  if (interaction.isButton()) {
    for (const [commandName, command] of client.prefixCommands) {
      if (command.handleComponent && typeof command.handleComponent === 'function') {
        const handled = await command.handleComponent(interaction);
        if (handled) break;
      }
    }
    return;
  }
});

// Global error handling
process.on('unhandledRejection', console.error);
process.on('uncaughtException', err => { 
  console.error(err); 
  process.exit(1); 
});

// Graceful shutdown
const gracefulExit = () => {
  console.log('Shutting down...');
  if (client.giveawayCleanup) client.giveawayCleanup.stop();
  mongoose.connection.close();
  process.exit(0);
};

process.on('SIGINT', gracefulExit);
process.on('SIGTERM', gracefulExit);

// Start bot
initializeBot();