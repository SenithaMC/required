const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionsBitField } = require('discord.js');
const db = require('../../../utils/db');

// Initialize database table if it doesn't exist
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
        console.log('✅ Services table initialized');
    } catch (error) {
        console.error('❌ Error initializing services table:', error);
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
        ),

    async execute(interaction) {
        // Check if user has MANAGE_GUILD permission
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ You need the `Manage Server` permission to use this command.')
                ],
                ephemeral: true
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
        }
    },

    async handleEmbed(interaction) {
        await interaction.deferReply(); // NOT ephemeral - we want the embed to be public

        try {
            // Fetch all services for this guild
            const [services] = await db.pool.execute(
                'SELECT * FROM services WHERE guildId = ? ORDER BY name',
                [interaction.guild.id]
            );

            if (services.length === 0) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFFA500)
                            .setDescription('❌ No services found. Use `/services add` to add services first.')
                    ],
                    ephemeral: true // This error message IS ephemeral
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
                .setTitle('🏢 Server Services')
                .setDescription('Select a service from the dropdown below to get more information or access the service.')
                .addFields(
                    { name: 'Available Services', value: `**${services.length}** service(s) available`, inline: true },
                    { name: 'How to Use', value: 'Use the dropdown menu below to select a service', inline: true }
                )
                .setColor(0x0099FF)
                .setFooter({ text: `Services Manager • ${interaction.guild.name}` })
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                components: [actionRow]
                // NOT ephemeral - this is the main services embed that should be public
            });

        } catch (error) {
            console.error('Error sending services embed:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ There was an error creating the services embed.')
                ],
                ephemeral: true // Error IS ephemeral
            });
        }
    },

    async handleAdd(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const serviceName = interaction.options.getString('service');
        const serviceDescription = interaction.options.getString('description') || 'No description provided';

        // Validate service name length for Discord limitations
        if (serviceName.length > 100) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ Service name must be less than 100 characters.')
                ],
                ephemeral: true
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
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription(`❌ Service **"${serviceName}"** already exists.`)
                    ],
                    ephemeral: true
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
                ],
                ephemeral: true
            });

        } catch (error) {
            console.error('Error adding service:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ There was an error adding the service.')
                ],
                ephemeral: true
            });
        }
    },

    async handleRemove(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Fetch all services for this guild
            const [services] = await db.pool.execute(
                'SELECT * FROM services WHERE guildId = ? ORDER BY name',
                [interaction.guild.id]
            );

            if (services.length === 0) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFFA500)
                            .setDescription('❌ No services found to remove.')
                    ],
                    ephemeral: true
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
                components: [actionRow],
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in remove services:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ There was an error fetching services.')
                ],
                ephemeral: true
            });
        }
    },

    // Component handler for the select menus - FIXED VERSION
    handleComponent: async function(interaction) {
        if (!interaction.isStringSelectMenu()) return false;

        if (interaction.customId === 'services_select') {
            return await this.handleServiceSelect(interaction);
        }

        if (interaction.customId === 'services_remove') {
            return await this.handleServiceRemove(interaction);
        }

        return false;
    },

    async handleServiceSelect(interaction) {
        try {
            const serviceId = interaction.values[0];
            
            // Fetch service details
            const [services] = await db.pool.execute(
                'SELECT * FROM services WHERE id = ?',
                [serviceId]
            );

            if (services.length === 0) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription('❌ Service not found.')
                    ],
                    ephemeral: true
                });
            }

            const service = services[0];

            // Create response embed
            const embed = new EmbedBuilder()
                .setTitle(`🏢 ${service.name}`)
                .setDescription(service.description || 'No description available.')
                .addFields(
                    { name: 'Service ID', value: `#${service.id}`, inline: true },
                    { name: 'Added', value: `<t:${Math.floor(new Date(service.createdAt).getTime() / 1000)}:R>`, inline: true }
                )
                .setColor(0x0099FF)
                .setFooter({ text: 'Service Information' })
                .setTimestamp();

            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });

            return true;

        } catch (error) {
            console.error('Error handling service selection:', error);
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ There was an error processing your selection.')
                ],
                ephemeral: true
            });
            return true;
        }
    },

    async handleServiceRemove(interaction) {
        // Check permissions again
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ You need the `Manage Server` permission to remove services.')
                ],
                ephemeral: true
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
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription('❌ There was an error removing the selected services.')
                ],
                ephemeral: true
            });
            return true;
        }
    }
};
