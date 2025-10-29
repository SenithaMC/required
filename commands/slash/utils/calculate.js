const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('calculate')
        .setDescription('Perform mathematical calculations')
        .addStringOption(option =>
            option
                .setName('expression')
                .setDescription('The mathematical expression to calculate')
                .setRequired(true)
        ),

    async execute(interaction) {
        let expression = interaction.options.getString('expression')
            .replace(/²/g, "**2")
            .replace(/³/g, "**3")
            .replace(/√/g, "Math.sqrt")
            .replace(/π/g, "Math.PI")
            .replace(/÷/g, "/")
            .replace(/×/g, "*")
            .replace(/\^/g, "**");

        const allowedPattern = /^[0-9+\-*/().,%\sMathPIsqrt&|<>!=\s]+$/;
        const dangerousPatterns = [
            /(?:import|require|process|console|fs|file|exec|spawn|fork)/i,
            /(?:function|class|var|let|const|=>)/,
            /(?:\.\s*[a-zA-Z]+\s*\()/,
            /(?:this|window|global|document)/i,
            /[;{}`'"]/
        ];

        await interaction.deferReply();

        if (!allowedPattern.test(expression)) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF3333)
                .setTitle('❌ Invalid Expression')
                .setDescription('Only mathematical characters and functions are allowed.')
                .addFields(
                    { name: 'Allowed Symbols', value: 'Numbers: `0-9`\nOperators: `+ - * / % ^`\nFunctions: `sqrt() π`\nGrouping: `( )`', inline: true }
                )
                .setFooter({ text: 'Use /help calculate for more info' });

            return interaction.editReply({ embeds: [errorEmbed] });
        }

        for (const pattern of dangerousPatterns) {
            if (pattern.test(expression)) {
                const securityEmbed = new EmbedBuilder()
                    .setColor(0xFF3333)
                    .setTitle('🔒 Security Alert')
                    .setDescription('Potentially unsafe expression detected.')
                    .setFooter({ text: 'Expression blocked for security reasons' });

                return interaction.editReply({ embeds: [securityEmbed] });
            }
        }

        try {
            const result = new Function('return ' + expression)();
            
            if (typeof result !== 'number' || !isFinite(result)) {
                const invalidEmbed = new EmbedBuilder()
                    .setColor(0xFF3333)
                    .setTitle('❌ Invalid Result')
                    .setDescription('The calculation produced an invalid or undefined result.')
                    .setFooter({ text: 'Please check your expression' });

                return interaction.editReply({ embeds: [invalidEmbed] });
            }

            let formattedResult = result;
            if (Math.abs(result) > 1000000 || (Math.abs(result) < 0.0001 && result !== 0)) {
                formattedResult = result.toExponential(4);
            } else if (!Number.isInteger(result)) {
                formattedResult = Number(result.toFixed(6));
            }

            let displayExpression = interaction.options.getString('expression')
                .replace(/Math\.sqrt/g, '√')
                .replace(/Math\.PI/g, 'π');

            const successEmbed = new EmbedBuilder()
                .setColor(0x00D166)
                .setTitle('🧮 Calculation Result')
                .setDescription(`**Expression:** \`${displayExpression}\``)
                .addFields(
                    { name: 'Result', value: `**\`${formattedResult}\`**`, inline: true },
                    { name: 'Type', value: typeof result, inline: true }
                )
                .setFooter({ 
                    text: `Calculated for ${interaction.user.username}`, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTimestamp();

            if (Math.abs(result) > 1000) {
                successEmbed.addFields({ 
                    name: 'Scientific Notation', 
                    value: `\`${result.toExponential(6)}\``,
                    inline: false 
                });
            }

            await interaction.editReply({ embeds: [successEmbed] });
        } catch (err) {
            console.error(`Calculation error: ${err.message}`, { 
                expression: interaction.options.getString('expression'), 
                user: interaction.user.tag 
            });
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF3333)
                .setTitle('❌ Calculation Error')
                .setDescription('Unable to evaluate the mathematical expression.')
                .addFields(
                    { name: 'Common Issues', value: '• Check for missing parentheses\n• Verify operator placement\n• Ensure valid function syntax', inline: false }
                )
                .setFooter({ text: 'Use /help calculate for usage examples' });

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};