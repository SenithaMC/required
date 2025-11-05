const mysql = require('mysql2/promise');
const config = require('../config');

const connectionConfig = {
  host: config.mysql.host,
  port: config.mysql.port || 3306,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,
  charset: 'utf8mb4',
  timezone: '+00:00',
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 30000,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: false
};

const poolConfig = {
  ...connectionConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  maxIdle: 10,
  idleTimeout: 60000,
  acquireTimeout: 60000
};

const pool = mysql.createPool(poolConfig);

let isPoolHealthy = false;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 10;

async function testConnection() {
  let connection;
  try {
    console.log('🔌 Testing database connection...');
    connection = await pool.getConnection();
    await connection.execute('SELECT 1');
    connection.release();
    isPoolHealthy = true;
    console.log('✅ Database connection established successfully');
    return true;
  } catch (error) {
    if (connection) {
      connection.release();
    }
    console.error('❌ Database connection failed:', error.message);
    isPoolHealthy = false;
    return false;
  }
}

pool.on('connection', (connection) => {
  console.log('✅ New MySQL connection established');
  isPoolHealthy = true;
});

pool.on('acquire', (connection) => {
});

pool.on('release', (connection) => {
});

pool.on('enqueue', () => {
  console.log('⏳ Waiting for available connection slot...');
});

pool.on('error', (err) => {
  console.error('❌ MySQL Pool Error:', err.message);
  isPoolHealthy = false;
});

async function waitForConnection() {
  const maxWaitTime = 30000;
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    if (isPoolHealthy) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
}

async function initializeDatabase() {
  initializationAttempts++;
  
  if (initializationAttempts > MAX_INIT_ATTEMPTS) {
    console.error('❌ Maximum database initialization attempts reached. Please check your database configuration.');
    return;
  }

  console.log(`🔄 Database initialization attempt ${initializationAttempts}/${MAX_INIT_ATTEMPTS}`);

  if (!await testConnection()) {
    const delay = Math.min(2000 * Math.pow(2, initializationAttempts - 1), 30000);
    console.log(`⏳ Retrying database initialization in ${delay}ms...`);
    setTimeout(() => initializeDatabase(), delay);
    return;
  }

  let connection;
  try {
    connection = await pool.getConnection();
    console.log('🔌 Starting database tables initialization...');

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

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL UNIQUE,
        ticket_id VARCHAR(50) NOT NULL,
        category VARCHAR(100) DEFAULT NULL,
        status ENUM('open', 'closed') DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME DEFAULT NULL,
        claimed_by VARCHAR(255) DEFAULT NULL,
        transcript TEXT DEFAULT NULL,
        INDEX (guild_id, user_id),
        INDEX (status)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ticket_panels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        panel_channel VARCHAR(255) DEFAULT NULL,
        panel_message VARCHAR(255) DEFAULT NULL,
        category_id VARCHAR(255) DEFAULT NULL,
        support_roles JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ticket_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        emoji VARCHAR(50) DEFAULT '🎫',
        category_id VARCHAR(255) DEFAULT NULL,
        support_roles JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY (guild_id, name)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        usage_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY (guild_id, name)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        service_bought VARCHAR(255) NOT NULL,
        rating INT NOT NULL,
        description TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (guild_id),
        INDEX (user_id)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS review_channels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL UNIQUE,
        channel_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS backups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (guild_id)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS backup_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL UNIQUE,
        interval_hours INT DEFAULT 24,
        keep_amount INT DEFAULT 10,
        enabled TINYINT DEFAULT 0,
        last_backup TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS transcript_channels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL UNIQUE,
        channel_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ All database tables initialized successfully');
    initializationAttempts = 0;
    
  } catch (error) {
    console.error('❌ Error initializing database tables:', error.message);
    
    if (initializationAttempts <= MAX_INIT_ATTEMPTS) {
      const delay = Math.min(2000 * Math.pow(2, initializationAttempts - 1), 30000);
      console.log(`🔄 Retrying database initialization in ${delay}ms...`);
      setTimeout(() => initializeDatabase(), delay);
    }
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function executeWithRetry(sql, params = [], maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let connection;
    try {
      if (!isPoolHealthy) {
        const connectionReady = await waitForConnection();
        if (!connectionReady) {
          throw new Error('Database connection not available');
        }
      }
      
      const [rows] = await pool.execute(sql, params);
      return rows;
    } catch (error) {
      console.error(`❌ Database query failed (attempt ${attempt}/${maxRetries}):`, error.message);
      
      if (error.code === 'ER_PARSE_ERROR' || error.code === 'ER_BAD_FIELD_ERROR') {
        throw error;
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ETIMEDOUT') {
        isPoolHealthy = false;
        await testConnection();
      }
      
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
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
    isPoolHealthy = true;
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error.message);
    isPoolHealthy = false;
    return false;
  }
}

setInterval(async () => {
  const isHealthy = await checkDatabaseHealth();
  if (!isHealthy) {
    console.warn('⚠️ Database health check failed');
  }
}, 120000);

setTimeout(async () => {
  await checkDatabaseHealth();
}, 5000);

process.on('SIGINT', async () => {
  console.log('🔄 Closing database connections...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 Closing database connections...');
  await pool.end();
  process.exit(0);
});

module.exports = {
  getGuild,
  createGuild,
  getGuildPrefix,
  setGuildPrefix,
  executeWithRetry,
  checkDatabaseHealth,
  closePool: () => pool.end(),
  pool,
  getPoolHealth: () => isPoolHealthy
};

setTimeout(() => {
  initializeDatabase().catch(console.error);
}, 1000);
