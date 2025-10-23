const mysql = require('mysql2/promise');
const config = require('../config');

const poolConfig = {
  host: config.mysql.host,
  port: config.mysql.port,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4',
  timezone: '+00:00',
  retry: {
    count: 3,
    delay: 1000
  }
};

const pool = mysql.createPool(poolConfig);

let isPoolHealthy = true;

pool.on('connection', (connection) => {
  console.log('✅ New MySQL connection established');
});

pool.on('acquire', (connection) => {
});

pool.on('release', (connection) => {
});

pool.on('enqueue', () => {
  console.log('⏳ Waiting for available connection slot...');
});

pool.on('error', (err) => {
  console.error('❌ MySQL Pool Error:', err);
  isPoolHealthy = false;
  
  setTimeout(() => {
    console.log('🔄 Attempting to restore database connection...');
    isPoolHealthy = true;
  }, 5000);
});

async function initializeDatabase() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('🔌 Testing database connection...');
    
    await connection.execute('SELECT 1');
    console.log('✅ Database connection test passed');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS guilds (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL UNIQUE,
        prefix VARCHAR(10) DEFAULT ?,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `, [config.prefix]);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS cases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        caseId INT NOT NULL,
        guildId VARCHAR(255) NOT NULL,
        userId VARCHAR(255) NOT NULL,
        moderatorId VARCHAR(255) NOT NULL,
        type ENUM('WARN', 'MUTE', 'KICK', 'BAN', 'UNMUTE', 'UNBAN', 'NOTE') NOT NULL,
        reason TEXT NOT NULL,
        duration INT DEFAULT NULL,
        expiresAt DATETIME DEFAULT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (guildId, userId),
        UNIQUE KEY (guildId, caseId)
      )
    `);

    await connection.execute(`
        CREATE TABLE IF NOT EXISTS user_messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            guild_id VARCHAR(255) NOT NULL,
            user_id VARCHAR(255) NOT NULL,
            message_count INT DEFAULT 0,
            last_message TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user_guild (guild_id, user_id),
            INDEX (guild_id),
            INDEX (user_id)
        )
    `);    

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS afk (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255) NOT NULL,
        guildId VARCHAR(255) NOT NULL,
        reason TEXT NOT NULL,
        createdAt DATETIME NOT NULL,
        INDEX idx_user_guild (userId, guildId)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS command_restrict (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guildId VARCHAR(255) NOT NULL UNIQUE,
        enabled BOOLEAN DEFAULT FALSE,
        enabledBy VARCHAR(255) NOT NULL,
        enabledAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        exemptRoles JSON,
        exemptChannels JSON
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS giveaways (
        id INT AUTO_INCREMENT PRIMARY KEY,
        messageId VARCHAR(255) NOT NULL UNIQUE,
        channelId VARCHAR(255) NOT NULL,
        guildId VARCHAR(255) NOT NULL,
        prize TEXT NOT NULL,
        winners INT NOT NULL,
        endTime DATETIME NOT NULL,
        role VARCHAR(255) DEFAULT NULL,
        participants JSON,
        ended BOOLEAN DEFAULT FALSE,
        endedAt DATETIME DEFAULT NULL,
        hostId VARCHAR(255) NOT NULL,
        deleteAt DATETIME DEFAULT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX (deleteAt)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS invites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guildId VARCHAR(255) NOT NULL,
        memberId VARCHAR(255) NOT NULL,
        inviteCode VARCHAR(255) NOT NULL,
        uses INT DEFAULT 0,
        fakeUses INT DEFAULT 0,
        invitedUsers JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (guildId, memberId),
        UNIQUE KEY (guildId, inviteCode)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS member_invites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guildId VARCHAR(255) NOT NULL,
        memberId VARCHAR(255) NOT NULL,
        totalInvites INT DEFAULT 0,
        validInvites INT DEFAULT 0,
        fakeInvites INT DEFAULT 0,
        leaveInvites INT DEFAULT 0,
        inviteCodes JSON,
        lastUpdated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY (guildId, memberId)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS greet_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guildId VARCHAR(255) NOT NULL UNIQUE,
        channelId VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        deleteAfter INT DEFAULT 0,
        enabled BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ All database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database tables:', error);
    
    setTimeout(() => {
      console.log('🔄 Retrying database initialization...');
      initializeDatabase().catch(console.error);
    }, 10000);
    
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function executeWithRetry(sql, params = [], maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!isPoolHealthy) {
        throw new Error('Pool is not healthy');
      }
      
      const [rows] = await pool.execute(sql, params);
      return rows;
    } catch (error) {
      console.error(`❌ Database query failed (attempt ${attempt}/${maxRetries}):`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
    
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
        isPoolHealthy = false;
        setTimeout(() => {
          isPoolHealthy = true;
          console.log('🔄 Pool health reset after connection error');
        }, 5000);
      }
    }
  }
}

async function getGuild(guildId) {
  try {
    const rows = await executeWithRetry(
      'SELECT * FROM guilds WHERE guild_id = ?',
      [guildId]
    );
    
    if (rows.length === 0) {
      return await createGuild(guildId);
    }
    
    return rows[0];
  } catch (error) {
    console.error('Error getting guild:', error);
    return { guild_id: guildId, prefix: config.prefix };
  }
}

async function createGuild(guildId) {
  try {
    await executeWithRetry(
      'INSERT INTO guilds (guild_id) VALUES (?)',
      [guildId]
    );
    
    const rows = await executeWithRetry(
      'SELECT * FROM guilds WHERE guild_id = ?',
      [guildId]
    );
    
    return rows[0];
  } catch (error) {
    console.error('Error creating guild:', error);
    return { guild_id: guildId, prefix: config.prefix };
  }
}

async function getGuildPrefix(guildId) {
  try {
    const rows = await executeWithRetry(
      'SELECT prefix FROM guilds WHERE guild_id = ?',
      [guildId]
    );
    
    return rows.length > 0 ? rows[0].prefix : config.prefix;
  } catch (error) {
    console.error('Error getting guild prefix:', error);
    return config.prefix;
  }
}

async function setGuildPrefix(guildId, prefix) {
  try {
    await executeWithRetry(
      'INSERT INTO guilds (guild_id, prefix) VALUES (?, ?) ON DUPLICATE KEY UPDATE prefix = ?',
      [guildId, prefix, prefix]
    );
    return true;
  } catch (error) {
    console.error('Error setting guild prefix:', error);
    return false;
  }
}

async function checkDatabaseHealth() {
  try {
    await executeWithRetry('SELECT 1');
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error.message);
    return false;
  }
}

setInterval(async () => {
  const isHealthy = await checkDatabaseHealth();
  if (!isHealthy) {
    console.warn('⚠️ Database health check failed');
  }
}, 300000);

module.exports = {
  getGuild,
  createGuild,
  getGuildPrefix,
  setGuildPrefix,
  executeWithRetry,
  checkDatabaseHealth,
  closePool: () => pool.end(),
  pool
};

initializeDatabase().catch(console.error);
