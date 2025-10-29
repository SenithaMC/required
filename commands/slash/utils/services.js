const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionsBitField, ChannelType, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../../../utils/db');

// Initialize database tables if they don't exist
async function initializeServicesTable() {
    try {
        await db.pool.execute(`
            CREATE TABLE IF NOT EXISTS services (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guildId VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                createdBy VARCHAR(255) NOT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_guild_service (guildId, name)
            )
        `);

        // First create the table without categoryId (for existing installations)
        await db.pool.execute(`
            CREATE TABLE IF NOT EXISTS service_settings (
                guildId VARCHAR(255) PRIMARY KEY,
                staffRoleId VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check if categoryId column exists, if not, add it
        try {
            await db.pool.execute('SELECT categoryId FROM service_settings LIMIT 1');
        } catch (error) {
            if (error.code === 'ER_BAD_FIELD_ERROR') {
                console.log('🔄 Adding categoryId column to service_settings table...');
                await db.pool.execute('ALTER TABLE service_settings ADD COLUMN categoryId VARCHAR(255)');
                console.log('✅ categoryId column added successfully');
            }
        }

        await db.pool.execute(`
            CREATE TABLE IF NOT EXISTS service_tickets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guildId VARCHAR(255) NOT NULL,
                channelId VARCHAR(255) NOT NULL,
                userId VARCHAR(255) NOT NULL,
                serviceId INT NOT NULL,
                claimedBy VARCHAR(255) DEFAULT NULL,
                status ENUM('open', 'claimed', 'closed') DEFAULT 'open',
                closeReason TEXT DEFAULT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                closedAt TIMESTAMP NULL DEFAULT NULL
            )
        `);
        console.log('✅ Services tables initialized');
    } catch (error) {
        console.error('❌ Error initializing services tables:', error);
    }
}

// Call initialization
initializeServicesTable();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('services')
        .setDescription('Manage server services selection menu')
        .addSubcommand(subcommand =>
            subcommand
                .setName('embed')
                .setDescription('Send the services selection embed')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a new service to the services list')
                .addStringOption(option =>
                    option
                        .setName('service')
                        .setDescription('Name of the service to add')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('description')
                        .setDescription('Description of the service')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove services from the services list')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('staff')
                .setDescription('Set the staff role for service requests')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('The staff role to mention in service channels')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        // Check if user has MANAGE_GUILD permission
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({
                content: '❌ You need the `Manage Server` permission to use this command.',
                flags: 64 // Ephemeral flag
            });
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'embed':
                await this.handleEmbed(interaction);
                break;
            case 'add':
                await this.handleAdd(interaction);
                break;
            case 'remove':
                await this.handleRemove(interaction);
                break;
            case 'staff':
                await this.handleStaff(interaction);
                break;
        }
    },

    async handleEmbed(interaction) {
        try {
            // Fetch all services for this guild
            const [services] = await db.pool.execute(
                'SELECT * FROM services WHERE guildId = ? ORDER BY name',
                [interaction.guild.id]
            );

            if (services.length === 0) {
                return interaction.reply({
                    content: '❌ No services found. Use `/services add` to add services first.',
                    flags: 64
                });
            }

            // Create select menu options from services
            const selectOptions = services.map(service => ({
                label: service.name.length > 25 ? service.name.substring(0, 22) + '...' : service.name,
                value: service.id.toString(),
                description: service.description ? 
                    (service.description.length > 50 ? service.description.substring(0, 47) + '...' : service.description) 
                    : 'No description'
            }));

            // Create the select menu
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('services_select')
                .setPlaceholder('Select a service...')
                .addOptions(selectOptions);

            const actionRow = new ActionRowBuilder().addComponents(selectMenu);

            // Create the embed
            const embed = new EmbedBuilder()
                .setTitle('DevArc • Services')
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setDescription('Select a service from the dropdown below to get more information or access the service.')
                .setColor(0x0099FF)
                .setFooter({ text: `Services • ${interaction.guild.name}` })
                .setTimestamp();

            // Send the embed to the channel (not as a reply to the interaction)
            await interaction.channel.send({
                embeds: [embed],
                components: [actionRow]
            });

            // Reply to the interaction with a success message (ephemeral)
            await interaction.reply({
                content: '✅ Services embed sent successfully!',
                flags: 64
            });

        } catch (error) {
            console.error('Error sending services embed:', error);
            await interaction.reply({
                content: '❌ There was an error creating the services embed.',
                flags: 64
            });
        }
    },

    async handleAdd(interaction) {
        await interaction.deferReply({ flags: 64 });

        const serviceName = interaction.options.getString('service');
        const serviceDescription = interaction.options.getString('description') || 'No description provided';

        // Validate service name length for Discord limitations
        if (serviceName.length > 100) {
            return interaction.editReply({
                content: '❌ Service name must be less than 100 characters.'
            });
        }

        try {
            // Check if service already exists
            const [existingServices] = await db.pool.execute(
                'SELECT * FROM services WHERE guildId = ? AND LOWER(name) = LOWER(?)',
                [interaction.guild.id, serviceName]
            );

            if (existingServices.length > 0) {
                return interaction.editReply({
                    content: `❌ Service **"${serviceName}"** already exists.`
                });
            }

            // Add service to database
            await db.pool.execute(
                'INSERT INTO services (guildId, name, description, createdBy) VALUES (?, ?, ?, ?)',
                [interaction.guild.id, serviceName, serviceDescription, interaction.user.id]
            );

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setDescription(`✅ Service **"${serviceName}"** has been added successfully!`)
                        .addFields(
                            { name: 'Description', value: serviceDescription, inline: false }
                        )
                        .setFooter({ text: `Added by ${interaction.user.tag}` })
                        .setTimestamp()
                ]
            });

        } catch (error) {
            console.error('Error adding service:', error);
            await interaction.editReply({
                content: '❌ There was an error adding the service.'
            });
        }
    },

    async handleRemove(interaction) {
        await interaction.deferReply({ flags: 64 });

        try {
            // Fetch all services for this guild
            const [services] = await db.pool.execute(
                'SELECT * FROM services WHERE guildId = ? ORDER BY name',
                [interaction.guild.id]
            );

            if (services.length === 0) {
                return interaction.editReply({
                    content: '❌ No services found to remove.'
                });
            }

            // Create select menu options from services (max 25 for Discord limitation)
            const selectOptions = services.slice(0, 25).map(service => ({
                label: service.name.length > 25 ? service.name.substring(0, 22) + '...' : service.name,
                value: service.id.toString(),
                description: service.description ? 
                    (service.description.length > 50 ? service.description.substring(0, 47) + '...' : service.description) 
                    : 'No description'
            }));

            // Create the select menu
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('services_remove')
                .setPlaceholder('Select services to remove...')
                .setMinValues(1)
                .setMaxValues(selectOptions.length)
                .addOptions(selectOptions);

            const actionRow = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle('🗑️ Remove Services')
                .setDescription(`Select the services you want to remove from the list below.\n\n**Current Services:** ${services.length}`)
                .setColor(0xFFA500)
                .setFooter({ text: 'You can select multiple services to remove at once' })
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                components: [actionRow]
            });

        } catch (error) {
            console.error('Error in remove services:', error);
            await interaction.editReply({
                content: '❌ There was an error fetching services.'
            });
        }
    },

    async handleStaff(interaction) {
        await interaction.deferReply({ flags: 64 });

        const staffRole = interaction.options.getRole('role');

        try {
            // Update or insert staff role setting
            await db.pool.execute(
                `INSERT INTO service_settings (guildId, staffRoleId) 
                 VALUES (?, ?) 
                 ON DUPLICATE KEY UPDATE staffRoleId = ?`,
                [interaction.guild.id, staffRole.id, staffRole.id]
            );

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setDescription(`✅ Staff role set to ${staffRole.toString()}`)
                        .setFooter({ text: `Configured by ${interaction.user.tag}` })
                        .setTimestamp()
                ]
            });

        } catch (error) {
            console.error('Error setting staff role:', error);
            await interaction.editReply({
                content: '❌ There was an error setting the staff role.'
            });
        }
    },

    // Component handler for the select menus, buttons, and modals
    handleComponent: async function(interaction) {
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'services_select') {
                return await this.handleServiceSelect(interaction);
            }
            if (interaction.customId === 'services_remove') {
                return await this.handleServiceRemove(interaction);
            }
        }

        if (interaction.isButton()) {
            if (interaction.customId.startsWith('claim_ticket_')) {
                return await this.handleClaimTicket(interaction);
            }
            if (interaction.customId.startsWith('close_ticket_')) {
                return await this.handleCloseTicket(interaction);
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('close_modal_')) {
                return await this.handleCloseModal(interaction);
            }
        }

        return false;
    },

    async handleServiceSelect(interaction) {
        // Defer the reply immediately to avoid interaction timeout
        await interaction.deferReply({ flags: 64 });

        try {
            const serviceId = interaction.values[0];
            
            // Fetch service details
            const [services] = await db.pool.execute(
                'SELECT * FROM services WHERE id = ?',
                [serviceId]
            );

            if (services.length === 0) {
                return interaction.editReply({
                    content: '❌ Service not found.'
                });
            }

            const service = services[0];

            // Check if staff role is set
            const [settings] = await db.pool.execute(
                'SELECT * FROM service_settings WHERE guildId = ?',
                [interaction.guild.id]
            );

            if (settings.length === 0 || !settings[0].staffRoleId) {
                return interaction.editReply({
                    content: '❌ Staff role is not configured. Use `/services staff` to set it up first.'
                });
            }

            const staffRole = interaction.guild.roles.cache.get(settings[0].staffRoleId);
            if (!staffRole) {
                return interaction.editReply({
                    content: '❌ Configured staff role not found. Please reconfigure with `/services staff`.'
                });
            }

            // Find or create "Services" category
            let servicesCategory = interaction.guild.channels.cache.find(
                channel => channel.name === 'Services' && channel.type === ChannelType.GuildCategory
            );

            if (!servicesCategory) {
                servicesCategory = await interaction.guild.channels.create({
                    name: 'Services',
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id, // @everyone role
                            deny: [PermissionsBitField.Flags.ViewChannel]
                        },
                        {
                            id: staffRole.id,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
                        }
                    ]
                });

                // Store category ID in database - with error handling for missing column
                try {
                    await db.pool.execute(
                        `INSERT INTO service_settings (guildId, staffRoleId, categoryId) 
                         VALUES (?, ?, ?) 
                         ON DUPLICATE KEY UPDATE categoryId = ?`,
                        [interaction.guild.id, staffRole.id, servicesCategory.id, servicesCategory.id]
                    );
                } catch (error) {
                    if (error.code === 'ER_BAD_FIELD_ERROR') {
                        console.log('categoryId column not available, skipping category storage');
                    } else {
                        throw error;
                    }
                }
            }

            // Create private channel for the service request
            const userName = interaction.user.username;
            const channelName = `${userName}-request`.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 100);

            const serviceChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: servicesCategory.id,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id, // @everyone role
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    },
                    {
                        id: interaction.user.id, // The user who requested the service
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
                    },
                    {
                        id: staffRole.id, // Staff role
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
                    },
                    {
                        id: interaction.client.user.id, // Bot
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
                    }
                ],
                reason: `Service request for ${service.name} by ${interaction.user.tag}`
            });

            // Create claim and close buttons
            const claimButton = new ButtonBuilder()
                .setCustomId(`claim_ticket_${serviceChannel.id}`)
                .setLabel('Claim')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🔓');

            const closeButton = new ButtonBuilder()
                .setCustomId(`close_ticket_${serviceChannel.id}`)
                .setLabel('Close')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒');

            const buttonRow = new ActionRowBuilder().addComponents(claimButton, closeButton);

            // Send welcome message in the new channel
            const channelEmbed = new EmbedBuilder()
                .setTitle(`${service.name} Request`)
                .setDescription(`Hello ${interaction.user.toString()}, thank you for requesting for our service!\nA member of our staff team will be with you shortly to assist you.'\n`)
                .addFields(
                    { name: 'Service Description', value: service.description || 'No description provided', inline: false },
                    { name: 'Requested By', value: interaction.user.toString(), inline: true },
                    { name: 'Status', value: '🟡 **Open** - Waiting for staff', inline: true }
                )
                .setColor(0x0099FF)
                .setFooter({ text: 'A staff member will assist you shortly.' })
                .setTimestamp();

            await serviceChannel.send({
                content: `||${staffRole.toString()}||\n New service request from ${interaction.user.toString()}!`,
                embeds: [channelEmbed],
                components: [buttonRow]
            });

            // Store ticket in database
            await db.pool.execute(
                'INSERT INTO service_tickets (guildId, channelId, userId, serviceId, status) VALUES (?, ?, ?, ?, ?)',
                [interaction.guild.id, serviceChannel.id, interaction.user.id, service.id, 'open']
            );

            // Send confirmation to user
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setDescription(`✅ Created private channel for **${service.name}**: ${serviceChannel.toString()}`)
                        .setFooter({ text: 'Please check the channel for further assistance' })
                ]
            });

            return true;

        } catch (error) {
            console.error('Error handling service selection:', error);
            
            let errorMessage = '❌ There was an error processing your selection.';
            
            if (error.code === 50013) { // Missing permissions
                errorMessage = '❌ Bot lacks permissions to create channels or manage permissions.';
            } else if (error.code === 30013) { // Maximum channels reached
                errorMessage = '❌ Maximum number of channels reached in this server.';
            }

            await interaction.editReply({
                content: errorMessage
            });
            return true;
        }
    },

    async handleClaimTicket(interaction) {
        await interaction.deferReply({ flags: 64 });

        const channelId = interaction.customId.replace('claim_ticket_', '');
        const channel = interaction.guild.channels.cache.get(channelId);

        if (!channel) {
            return interaction.editReply({
                content: '❌ Channel not found.'
            });
        }

        try {
            // Check if ticket is already claimed
            const [tickets] = await db.pool.execute(
                'SELECT * FROM service_tickets WHERE channelId = ?',
                [channelId]
            );

            if (tickets.length === 0) {
                return interaction.editReply({
                    content: '❌ Ticket not found in database.'
                });
            }

            const ticket = tickets[0];

            // Check if already claimed
            if (ticket.status === 'claimed') {
                return interaction.editReply({
                    content: '❌ This ticket has already been claimed.'
                });
            }

            // Update ticket in database
            await db.pool.execute(
                'UPDATE service_tickets SET claimedBy = ?, status = ? WHERE channelId = ?',
                [interaction.user.id, 'claimed', channelId]
            );

            // Update the embed in the channel
            const messages = await channel.messages.fetch({ limit: 10 });
            const welcomeMessage = messages.find(msg => msg.embeds.length > 0 && msg.embeds[0].title?.includes('Request'));

            if (welcomeMessage) {
                const oldEmbed = welcomeMessage.embeds[0];
                const newEmbed = EmbedBuilder.from(oldEmbed)
                    .spliceFields(2, 1, { name: 'Status', value: '🟢 **Claimed** - ' + interaction.user.toString(), inline: true });

                // Create updated buttons with claim button disabled
                const disabledClaimButton = new ButtonBuilder()
                    .setCustomId(`claim_ticket_${channelId}`)
                    .setLabel('Claimed')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
                    .setEmoji('🔓');

                const closeButton = new ButtonBuilder()
                    .setCustomId(`close_ticket_${channelId}`)
                    .setLabel('Close')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒');

                const updatedButtonRow = new ActionRowBuilder().addComponents(disabledClaimButton, closeButton);

                await welcomeMessage.edit({
                    embeds: [newEmbed],
                    components: [updatedButtonRow]
                });
            }

            await interaction.editReply({
                content: '✅ Ticket claimed successfully!'
            });

            // Notify the channel
            await channel.send({
                content: `🎯 ${interaction.user.toString()} has claimed this ticket!`
            });

            return true;

        } catch (error) {
            console.error('Error claiming ticket:', error);
            await interaction.editReply({
                content: '❌ There was an error claiming the ticket.'
            });
            return true;
        }
    },

    async handleCloseTicket(interaction) {
        const channelId = interaction.customId.replace('close_ticket_', '');
        
        // Check if channel still exists
        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel) {
            return interaction.reply({
                content: '❌ This ticket channel no longer exists.',
                flags: 64
            });
        }

        // Check if user has permission to close tickets
        // Allow: Server owner, users with MANAGE_MESSAGES permission, or users with staff role
        const hasManageMessages = interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages);
        const isServerOwner = interaction.guild.ownerId === interaction.user.id;
        
        let hasStaffRole = false;
        
        // Check if staff role is configured and user has it
        const [settings] = await db.pool.execute(
            'SELECT * FROM service_settings WHERE guildId = ?',
            [interaction.guild.id]
        );

        if (settings.length > 0 && settings[0].staffRoleId) {
            const staffRole = interaction.guild.roles.cache.get(settings[0].staffRoleId);
            if (staffRole && interaction.member.roles.cache.has(staffRole.id)) {
                hasStaffRole = true;
            }
        }

        // If user doesn't have any of the required permissions
        if (!isServerOwner && !hasManageMessages && !hasStaffRole) {
            return interaction.reply({
                content: '❌ You do not have permission to close tickets. You need either:\n• Server Owner\n• Manage Messages permission\n• Staff role',
                flags: 64
            });
        }

        // Create the modal
        const modal = new ModalBuilder()
            .setCustomId(`close_modal_${channelId}`)
            .setTitle('Close Service Ticket')
            .setComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('close_reason')
                        .setLabel('Reason for closing')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Enter the reason for closing this ticket...')
                        .setRequired(true)
                        .setMaxLength(1000)
                        .setMinLength(10)
                )
            );

        // Show the modal to the user
        await interaction.showModal(modal);
        return true;
    },

    async handleCloseModal(interaction) {
        console.log('🔧 DEBUG: Modal submission started');
        
        try {
            console.log('🔧 DEBUG: Attempting to defer reply...');
            await interaction.deferReply({ flags: 64 });
            console.log('✅ DEBUG: Reply deferred successfully');

            const channelId = interaction.customId.replace('close_modal_', '');
            const closeReason = interaction.fields.getTextInputValue('close_reason');
            
            console.log('🔧 DEBUG: Modal data extracted:', {
                channelId: channelId,
                closeReasonLength: closeReason.length
            });

            console.log('🔧 DEBUG: Looking for channel...');
            const channel = interaction.guild.channels.cache.get(channelId);

            if (!channel) {
                console.log('❌ DEBUG: Channel not found:', channelId);
                return await interaction.editReply({
                    content: '❌ Channel not found.'
                });
            }
            console.log('✅ DEBUG: Channel found:', channel.name);

            console.log('🔧 DEBUG: Checking database connection...');
            try {
                await db.pool.execute('SELECT 1');
                console.log('✅ DEBUG: Database connection OK');
            } catch (dbError) {
                console.error('❌ DEBUG: Database connection failed:', dbError);
                return await interaction.editReply({
                    content: '❌ Database connection error.'
                });
            }

            console.log('🔧 DEBUG: Querying ticket from database...');
            const [tickets] = await db.pool.execute(
                'SELECT * FROM service_tickets WHERE channelId = ?',
                [channelId]
            );

            if (tickets.length === 0) {
                console.log('❌ DEBUG: No ticket found in database');
                return await interaction.editReply({
                    content: '❌ Ticket not found in database.'
                });
            }
            console.log('✅ DEBUG: Ticket found in database');

            const ticket = tickets[0];

            console.log('🔧 DEBUG: Updating ticket in database...');
            await db.pool.execute(
                'UPDATE service_tickets SET status = ?, closeReason = ?, closedAt = NOW() WHERE channelId = ?',
                ['closed', closeReason, channelId]
            );
            console.log('✅ DEBUG: Ticket updated in database');

            // Try to DM the user
            let dmSent = false;
            console.log('🔧 DEBUG: Attempting to DM user...');
            try {
                const user = await interaction.client.users.fetch(ticket.userId);
                console.log('✅ DEBUG: User fetched:', user.tag);
                
                const dmEmbed = new EmbedBuilder()
                    .setTitle('Service Ticket Closed')
                    .setDescription(`Your service request in **${interaction.guild.name}** has been closed.`)
                    .addFields(
                        { name: 'Closed By', value: interaction.user.toString(), inline: true },
                        { name: 'Reason', value: closeReason.substring(0, 1000), inline: false }
                    )
                    .setColor(0xFFA500)
                    .setTimestamp();

                await user.send({ embeds: [dmEmbed] });
                dmSent = true;
                console.log('✅ DEBUG: DM sent successfully');
            } catch (dmError) {
                console.log('⚠️ DEBUG: Could not DM user:', dmError.message);
                dmSent = false;
            }

            console.log('🔧 DEBUG: Sending close message to channel...');
            const closeEmbed = new EmbedBuilder()
                .setTitle('Ticket Closed')
                .setDescription(`This ticket has been closed by ${interaction.user.toString()}`)
                .addFields(
                    { name: 'Reason', value: closeReason.substring(0, 1000), inline: false }
                )
                .setColor(0xFF0000)
                .setTimestamp();

            if (!dmSent) {
                closeEmbed.addFields(
                    { name: 'Note', value: 'Could not send DM to user. They may have DMs disabled.', inline: false }
                );
            }

            await channel.send({ embeds: [closeEmbed] });
            console.log('✅ DEBUG: Close message sent to channel');

            console.log('🔧 DEBUG: Scheduling channel deletion...');
            // Wait a moment for the message to be seen, then delete the channel
            setTimeout(async () => {
                try {
                    console.log('🔧 DEBUG: Attempting to delete channel...');
                    await channel.delete('Service ticket closed');
                    console.log('✅ DEBUG: Channel deleted successfully');
                } catch (deleteError) {
                    console.error('❌ DEBUG: Error deleting channel:', deleteError);
                }
            }, 2000);

            console.log('🔧 DEBUG: Sending final response to user...');
            await interaction.editReply({
                content: `✅ Ticket closed${dmSent ? ' and user notified' : ''}! Channel will be deleted shortly.`
            });

            console.log('✅ DEBUG: Modal submission completed successfully');
            return true;

        } catch (error) {
            console.error('❌ DEBUG: Error in handleCloseModal:', error);
            console.error('❌ DEBUG: Error stack:', error.stack);
            
            try {
                await interaction.editReply({
                    content: `❌ There was an error closing the ticket: ${error.message}`
                });
            } catch (replyError) {
                console.error('❌ DEBUG: Could not send error message:', replyError);
            }
            return true;
        }
    },

    async handleServiceRemove(interaction) {
        // Check permissions again
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({
                content: '❌ You need the `Manage Server` permission to remove services.',
                flags: 64
            });
        }

        try {
            const serviceIds = interaction.values;
            
            // Get service names before deleting for the response
            const [servicesToDelete] = await db.pool.execute(
                `SELECT * FROM services WHERE id IN (${serviceIds.map(() => '?').join(',')})`,
                serviceIds
            );

            // Delete the selected services
            await db.pool.execute(
                `DELETE FROM services WHERE id IN (${serviceIds.map(() => '?').join(',')})`,
                serviceIds
            );

            const serviceNames = servicesToDelete.map(service => `• **${service.name}**`).join('\n');

            const embed = new EmbedBuilder()
                .setTitle('✅ Services Removed')
                .setDescription(`Successfully removed ${serviceIds.length} service(s):\n\n${serviceNames}`)
                .setColor(0x00FF00)
                .setFooter({ text: `Removed by ${interaction.user.tag}` })
                .setTimestamp();

            // Update the original message to show it's been processed
            await interaction.update({
                embeds: [embed],
                components: []
            });

            return true;

        } catch (error) {
            console.error('Error removing services:', error);
            await interaction.reply({
                content: '❌ There was an error removing the selected services.',
                flags: 64
            });
            return true;
        }
    }
};
