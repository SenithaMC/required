const { evaluate, compile } = require('mathjs');

module.exports = {
    name: "calculate",
    aliases: ["calc", "math"],
    description: "Performs mathematical calculations with support for advanced functions, constants, and unit conversions",
    usage: "<expression> | Examples: `2+2`, `sin(45 deg)`, `5cm to inches`, `2^8`, `sqrt(16)`",
    
    async execute(message, args) {
        if (!args.length) {
            return message.reply("🔢 **Calculator Help**\n" +
                "**Usage:** `!calculate <expression>`\n" +
                "**Examples:**\n" +
                "• Basic: `2+2`, `(5*3)/2`\n" +
                "• Advanced: `sin(45 deg)`, `2^8`, `sqrt(16)`\n" +
                "• Constants: `pi`, `e`\n" +
                "• Units: `5cm to inches`, `2kg in pounds`");
        }

        let expression = args.join(" ")
            .replace(/²/g, "^2")
            .replace(/³/g, "^3")
            .replace(/√/g, "sqrt")
            .replace(/π/g, "pi")
            .replace(/÷/g, "/")
            .replace(/×/g, "*");

        // Enhanced safety check - allow only math-related characters and functions
        const allowedPattern = /^[0-9+\-*/().,%^!&|<>=\sπ√²³a-zA-Z°]+$/;
        const dangerousPatterns = [
            /(?:import|require|process|console|fs|file|exec|spawn|fork)/i,
            /(?:function|class|var|let|const|=>|=>)/,
            /(?:\.\s*[a-zA-Z]+\s*\()/,
            /(?:this|window|global|document)/i
        ];

        if (!allowedPattern.test(expression)) {
            return message.reply("❌ Invalid characters detected. Only mathematical expressions are allowed.");
        }

        // Check for dangerous patterns
        for (const pattern of dangerousPatterns) {
            if (pattern.test(expression)) {
                return message.reply("❌ Potentially unsafe expression detected.");
            }
        }

        try {
            // Compile first for additional safety
            const compiled = compile(expression);
            const result = compiled.evaluate();

            // Format large numbers
            let formattedResult = result;
            if (typeof result === 'number') {
                if (Math.abs(result) > 1000000 || (Math.abs(result) < 0.0001 && result !== 0)) {
                    formattedResult = result.toExponential(4);
                } else if (!Number.isInteger(result)) {
                    formattedResult = Number(result.toFixed(6));
                }
            }

            // Create a beautiful response
            const response = `
🧮 **Calculator**
**Expression:** \`${expression}\`
**Result:** **\`${formattedResult}\`**

*Need more help? Use \`!calculate help\`*
            `.trim();

            await message.reply(response);

        } catch (err) {
            console.error(`Calculation error: ${err.message}`, { expression, user: message.author.tag });
            
            let errorMessage = "❌ Error evaluating expression. ";
            
            if (err.message.includes('Undefined symbol')) {
                errorMessage += "Unknown function or variable. Check your spelling.";
            } else if (err.message.includes('Parenthesis')) {
                errorMessage += "Mismatched parentheses. Check your brackets.";
            } else if (err.message.includes('Unexpected')) {
                errorMessage += "Syntax error. Please check your expression.";
            } else {
                errorMessage += "Please check your syntax and try again.";
            }
            
            await message.reply(errorMessage);
        }
    },
};

// Additional helper function for unit conversion
async function handleUnitConversion(expression, message) {
    try {
        const unitMatch = expression.match(/([\d.]+)\s*([a-zA-Z]+)\s*(?:to|in)\s*([a-zA-Z]+)/i);
        if (unitMatch) {
            const [, value, fromUnit, toUnit] = unitMatch;
            const conversion = evaluate(`${value} ${fromUnit} to ${toUnit}`);
            await message.reply(`📏 **Unit Conversion**\n${value} ${fromUnit} = **${conversion}**`);
            return true;
        }
    } catch (err) {
        // If unit conversion fails, continue with normal evaluation
    }
    return false;
}
