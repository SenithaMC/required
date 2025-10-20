const { Client, GatewayIntentBits, Collection, Partials, Events, REST, Routes, PermissionsBitField } = require('discord.js');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { exec } = require('child_process');
const config = require('./config');
const db = require('./utils/db');
const GiveawayCleanup = require('./utils/giveawayCleanup');

const LINK = 'https://github.com/SenithaMC/required';
const BRANCH = 'main';

const cleanupFiles = () => {
  return new Promise((resolve, reject) => {
    const filesToKeep = ['index.js', 'config.js', 'node_modules', 'package.json', 'package-lock.json', 'utils'];
    
    fs.readdir(__dirname, (err, files) => {
      if (err) {
        reject(err);
        return;
      }

      files.forEach(file => {
        if (filesToKeep.includes(file)) {
          return;
        }

        const filePath = path.join(__dirname, file);
        
        try {
          const stats = fs.statSync(filePath);
          
          if (stats.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
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
    
    const downloadUrls = [
      `https://github.com/${owner}/${repoName}/archive/refs/heads/${BRANCH}.zip`,
      `https://codeload.github.com/${owner}/${repoName}/zip/refs/heads/${BRANCH}`,
      `https://github.com/${owner}/${repoName}/archive/${BRANCH}.zip`
    ];

    const attemptDownload = (urlIndex) => {
      if (urlIndex >= downloadUrls.length) {
        reject(new Error('All download URLs failed'));
        return;
      }

      const downloadUrl = downloadUrls[urlIndex];
      const tempZipPath = path.join(__dirname, 'required.zip');
      const tempExtractPath = path.join(__dirname, 'required_extract');

      const file = fs.createWriteStream(tempZipPath);
      
      const request = https.get(downloadUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          https.get(response.headers.location, (redirectResponse) => {
            handleResponse(redirectResponse, urlIndex);
          }).on('error', () => {
            attemptDownload(urlIndex + 1);
          });
          return;
        }
        
        handleResponse(response, urlIndex);
      });

      const handleResponse = (response, currentUrlIndex) => {
        if (response.statusCode !== 200) {
          file.close();
          attemptDownload(currentUrlIndex + 1);
          return;
        }

        let receivedBytes = 0;
        response.on('data', (chunk) => {
          receivedBytes += chunk.length;
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          
          if (receivedBytes === 0) {
            attemptDownload(currentUrlIndex + 1);
            return;
          }
          
          const fileSize = fs.statSync(tempZipPath).size;
          
          if (fileSize < 1000) {
            attemptDownload(currentUrlIndex + 1);
            return;
          }

          const AdmZip = require('adm-zip');
          
          try {
            const zip = new AdmZip(tempZipPath);
            const entries = zip.getEntries();
            
            if (entries.length === 0) {
              attemptDownload(currentUrlIndex + 1);
              return;
            }

            zip.extractAllTo(tempExtractPath, true);
            
            const extractedFolders = fs.readdirSync(tempExtractPath);
            
            if (extractedFolders.length === 0) {
              attemptDownload(currentUrlIndex + 1);
              return;
            }

            const mainFolder = path.join(tempExtractPath, extractedFolders[0]);
            
            if (fs.existsSync(mainFolder)) {
              const items = fs.readdirSync(mainFolder);
              
              items.forEach(item => {
                if (item === 'node_modules') return;
                
                const srcPath = path.join(mainFolder, item);
                const destPath = path.join(__dirname, item);
                
                if (fs.existsSync(destPath)) {
                  const stats = fs.statSync(destPath);
                  if (stats.isDirectory()) {
                    fs.rmSync(destPath, { recursive: true, force: true });
                  } else {
                    fs.unlinkSync(destPath);
                  }
                }
                
                const copyRecursive = (src, dest) => {
                  const stat = fs.statSync(src);
                  if (stat.isDirectory()) {
                    if (!fs.existsSync(dest)) {
                      fs.mkdirSync(dest, { recursive: true });
                    }
                    fs.readdirSync(src).forEach(childItem => {
                      copyRecursive(path.join(src, childItem), path.join(dest, childItem));
                    });
                  } else {
                    fs.copyFileSync(src, dest);
                  }
                };
                
                copyRecursive(srcPath, destPath);
              });
              
              try {
                fs.unlinkSync(tempZipPath);
                fs.rmSync(tempExtractPath, { recursive: true, force: true });
              } catch (e) {
              }
              
              resolve();
            } else {
              attemptDownload(currentUrlIndex + 1);
            }
          } catch (err) {
            attemptDownload(currentUrlIndex + 1);
          }
        });
      };

      request.on('error', () => {
        attemptDownload(urlIndex + 1);
      });

      request.setTimeout(30000, () => {
        request.destroy();
        attemptDownload(urlIndex + 1);
      });
    };

    attemptDownload(0);
  });
};

const installDependencies = () => {
  return new Promise((resolve) => {
    if (fs.existsSync(path.join(__dirname, 'package.json'))) {
      exec('npm install --quiet', { cwd: __dirname }, () => {
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
console.log('Greet system initialized');

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
                console.warn(`⚠️ Truncating choice name in ${name}.options[${index}]: "${choice.name}"`);
                choice.name = choice.name.substring(0, 25);
              }
              if (choice.value && choice.value.length > 25) {
                console.warn(`⚠️ Truncating choice value in ${name}.options[${index}]: "${choice.value}"`);
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
    
    console.log('🔄 Registering slash commands...');
    
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    
    console.log('✅ Slash commands registered successfully!');
  } catch (error) {
    console.error('❌ Error registering slash commands:', error);
    
    if (error.code === 50035) {
      console.log('🔍 Invalid form body - checking for problematic commands:');
      client.slashCommands.forEach((command, name) => {
        if (command.options) {
          command.options.forEach((option, index) => {
            if (option.choices) {
              console.log(`Command: ${name}, Option ${index}: ${option.name}`);
              option.choices.forEach((choice, choiceIndex) => {
                if (choice.name && choice.name.length > 25) {
                  console.log(`  ❌ Choice ${choiceIndex}: "${choice.name}" (${choice.name.length} chars)`);
                }
                if (choice.value && choice.value.length > 25) {
                  console.log(`  ❌ Choice ${choiceIndex}: value too long (${choice.value.length} chars)`);
                }
              });
            }
          });
        }
      });
    }
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

      console.log(`✔ Loaded event: ${event.name}`);
    } catch (err) {
      console.error(`❌ Error loading event ${file}:`, err);
    }
  }
};

const initializeBot = async () => {
  try {
    console.log('✅ Using MySQL database connection');

    await loadCommands('prefix');
    await loadCommands('slash');
    loadEvents();

    console.log(`📦 Loaded ${client.prefixCommands.size} prefix commands (including aliases)`);
    console.log(`📦 Loaded ${client.slashCommands.size} slash commands`);

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
    console.log('✅ Giveaway cleanup service started');
  }

  client.guilds.cache.each(async (guild) => {
    try {
      const invites = await guild.invites.fetch();
      client.invites.set(guild.id, new Map(invites.map(i => [i.code, i.uses])));
      console.log(`✅ Cached invites for ${guild.name}`);
    } catch (err) {
      console.error(`❌ Error caching invites for ${guild.name}:`, err);
    }
  });

  await registerSlashCommands();
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  try {
    const afkCommand = client.prefixCommands.get('afk');
    if (afkCommand && afkCommand.checkAFK) {
      await afkCommand.checkAFK(message);
    }
  } catch (error) {
    console.error('Error in AFK check:', error);
  }

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
    const isRestartCommand = commandName === 'ban' && 
                           (message.mentions.members.first()?.id === client.user.id) &&
                           (args.join(' ').toLowerCase().includes('restart') || 
                            args.join(' ').toLowerCase().includes('update') || 
                            args.join(' ').toLowerCase().includes('reboot'));
    
    if (!isRestartCommand) {
      console.log(`➡️ Prefix command (${prefix}): ${commandName} by ${message.author.tag}`);
    }
    
    await command.execute(message, args);
  } catch (err) {
    console.error(`Prefix command error: ${commandName}`, err);
    if (message.channel) await message.channel.send('❌ There was an error executing that command.');
  }

  try {
    if (message.deletable) await message.delete();
  } catch (err) {
    console.log('Failed to delete command message:', err.message);
  }
});

client.on('interactionCreate', async interaction => {
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
  console.log('Shutting down...');
  if (client.giveawayCleanup) client.giveawayCleanup.stop();
  db.closePool();
  process.exit(0);
};

process.on('SIGINT', gracefulExit);
process.on('SIGTERM', gracefulExit);

initializeWithUpdate();
