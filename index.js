const { Client, GatewayIntentBits, Collection, Partials, Events, REST, Routes, PermissionsBitField } = require('discord.js');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { exec } = require('child_process');
const config = require('./config');
const db = require('./utils/db');
const GiveawayCleanup = require('./utils/giveawayCleanup');

const LINK = 'https://github.com/SenithaMC/lwky.bot';
const BRANCH = 'main';

const cleanupFiles = () => {
  return new Promise((resolve, reject) => {
    const filesToKeep = ['index.js', 'config.js', 'node_modules'];
    
    fs.readdir(__dirname, (err, files) => {
      if (err) {
        reject(err);
        return;
      }

      let deletedCount = 0;

      files.forEach(file => {
        if (filesToKeep.includes(file)) {
          return;
        }

        const filePath = path.join(__dirname, file);
        
        try {
          const stats = fs.statSync(filePath);
          
          if (stats.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
            deletedCount++;
          } else {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        } catch (error) {
        }
      });

      resolve();
    });
  });
};

const downloadFromGitHub = () => {
  return new Promise((resolve, reject) => {
    const match = LINK.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      reject(new Error('Invalid GitHub repository URL'));
      return;
    }

    const [, owner, repo] = match;
    const repoName = repo.replace('.git', '');
    const downloadUrl = `https://github.com/${owner}/${repoName}/archive/refs/heads/${BRANCH}.zip`;
    
    const tempZipPath = path.join(__dirname, 'temp_repo.zip');
    const tempExtractPath = path.join(__dirname, 'temp_extract');
    const finalExtractPath = path.join(tempExtractPath, `${repoName}-${BRANCH}`);

    const file = fs.createWriteStream(tempZipPath);
    
    https.get(downloadUrl, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
        });
      } else if (response.statusCode === 200) {
        response.pipe(file);
      } else {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      file.on('finish', () => {
        file.close();
        
        const unzip = require('extract-zip');
        
        unzip(tempZipPath, { dir: tempExtractPath })
          .then(() => {
            copyRecursiveSync(finalExtractPath, __dirname);
            
            try {
              fs.unlinkSync(tempZipPath);
              fs.rmSync(tempExtractPath, { recursive: true, force: true });
            } catch (e) {
            }
            
            resolve();
          })
          .catch(err => {
            reject(new Error(`Extraction failed: ${err.message}`));
          });
      });
    }).on('error', (err) => {
      reject(new Error(`Download failed: ${err.message}`));
    });
  });
};

const copyRecursiveSync = (src, dest) => {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
};

const installDependencies = () => {
  return new Promise((resolve) => {
    if (fs.existsSync(path.join(__dirname, 'package.json'))) {
      exec('npm install --quiet', { cwd: __dirname }, (error) => {
        if (error) {
        }
        resolve();
      });
    } else {
      resolve();
    }
  });
};

const initializeWithUpdate = async () => {
  try {
    await cleanupFiles();
    
    try {
      await downloadFromGitHub();
    } catch (error) {
    }
    
    await installDependencies();
    
    await initializeBot();
    
  } catch (error) {
    console.error('❌ Error during initialization:', error);
    process.exit(1);
  }
};

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

client.prefixCommands = new Collection();
client.slashCommands = new Collection();
client.componentHandlers = new Collection();
client.invites = new Map();
client.prefixCache = new Map();
client.giveawayCleanup = new GiveawayCleanup(client);

const cooldowns = new Map();

client.greetConfigs = new Map();

const loadCommands = async (type) => {
  const basePath = path.join(__dirname, 'commands', type);

  if (!fs.existsSync(basePath)) {
    return;
  }

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
            continue;
          }

          if (type === 'prefix') {
            client.prefixCommands.set(command.name, command);
            if (command.aliases) command.aliases.forEach(alias => client.prefixCommands.set(alias, command));
            if (command.handleComponent) client.componentHandlers.set(command.name, command.handleComponent);
          } else if (type === 'slash') {
            client.slashCommands.set(command.name, command);
          }
        } catch (err) {
        }
      }
    }
  };

  readCommands(basePath);
};

const registerSlashCommands = async () => {
  try {
    const commands = [];
    
    for (const [name, command] of client.slashCommands) {
      const commandData = {
        name: name,
        description: command.description,
        options: command.options || [],
        default_permission: command.default_permission !== false
      };

      if (commandData.options && commandData.options.length > 0) {
        commandData.options.forEach((option, index) => {
          if (option.choices && Array.isArray(option.choices)) {
            option.choices = option.choices.map(choice => {
              if (choice.name && choice.name.length > 25) {
                choice.name = choice.name.substring(0, 25);
              }
              if (choice.value && choice.value.length > 25) {
                choice.value = choice.value.substring(0, 25);
              }
              return choice;
            });
          }
        });
      }

      commands.push(commandData);
    }

    const rest = new REST({ version: '10' }).setToken(config.token);
    
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
  } catch (error) {
  }
};

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
    } catch (err) {
    }
  }
};

const initializeBot = async () => {
  try {
    await loadCommands('prefix');
    await loadCommands('slash');
    loadEvents();

    if (!config.token) throw new Error('No token provided in config.json');
    await client.login(config.token);
  } catch (error) {
    console.error('❌ Error initializing bot:', error);
    process.exit(1);
  }
};

client.once(Events.ClientReady, async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  if (config.giveawayCleanup?.enabled) {
    client.giveawayCleanup.start();
  }

  client.guilds.cache.each(async (guild) => {
    try {
      const invites = await guild.invites.fetch();
      client.invites.set(guild.id, new Map(invites.map(i => [i.code, i.uses])));
    } catch (err) {
    }
  });

  await registerSlashCommands();
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  let prefix = client.prefixCache.get(message.guild.id);
  if (!prefix) {
    try {
      prefix = await db.getGuildPrefix(message.guild.id);
      client.prefixCache.set(message.guild.id, prefix);
    } catch (err) {
      prefix = config.prefix;
    }
  }

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = client.prefixCommands.get(commandName);
  if (!command) return;

  const now = Date.now();
  const cooldownAmount = (config.commandCooldown || 15) * 1000;
  if (!cooldowns.has(message.author.id)) cooldowns.set(message.author.id, new Map());
  const timestamps = cooldowns.get(message.author.id);

  if (timestamps.has(commandName)) {
    const expiration = timestamps.get(commandName) + cooldownAmount;
    if (now < expiration) {
      if (message.deletable) await message.delete().catch(() => {});

      return message.channel.send(`⏱️ Please wait ${((expiration - now)/1000).toFixed(1)}s before using \`${prefix}${commandName}\` again.`)
        .then(msg => setTimeout(() => msg.delete().catch(() => {}), 4000));
    }
  }

  timestamps.set(commandName, now);
  setTimeout(() => timestamps.delete(commandName), cooldownAmount);

  try {
    await command.execute(message, args);
  } catch (err) {
    if (message.channel) await message.channel.send('❌ There was an error executing that command.');
  }

  try {
    if (message.deletable) await message.delete();
  } catch (err) {
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.slashCommands.get(interaction.commandName);
    
    if (!command) return;
    
    try {
      await command.execute(interaction);
    } catch (error) {
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
  
  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    for (const [commandName, command] of client.prefixCommands) {
      if (command.handleComponent && typeof command.handleComponent === 'function') {
        const handled = await command.handleComponent(interaction);
        if (handled) break;
      }
    }
    return;
  }
});

process.on('unhandledRejection', console.error);
process.on('uncaughtException', err => { 
  console.error(err); 
  process.exit(1); 
});

const gracefulExit = () => {
  if (client.giveawayCleanup) client.giveawayCleanup.stop();
  db.closePool();
  process.exit(0);
};

process.on('SIGINT', gracefulExit);
process.on('SIGTERM', gracefulExit);

initializeWithUpdate();
