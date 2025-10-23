module.exports = {
    name: "calculate",
    aliases: ["calc", "math"],
    description: "Performs mathematical calculations with support for basic operations and functions",
    usage: "calculate <expression> | Examples: `2+2`, `5*3/2`, `2^8`, `sqrt(16)`",

    async execute(message, args) {
        if (!args.length) {
            return message.channel.send(`**Usage:** \`${this.usage}\``);
        }

        // Join arguments into a full expression
        let expression = args.join(" ")
            .replace(/²/g, "**2")    // handle square symbol
            .replace(/³/g, "**3")    // handle cube symbol
            .replace(/√/g, "Math.sqrt") // handle square root
            .replace(/π/g, "Math.PI")   // handle pi
            .replace(/÷/g, "/")      // handle division symbol
            .replace(/×/g, "*")      // handle multiplication symbol
            .replace(/\^/g, "**");    // handle caret exponentiation

        // Enhanced safety check - only allow math-related characters and functions
        const allowedPattern = /^[0-9+\-*/().,%\sMathPIsqrt&|<>!=\s]+$/;
        const dangerousPatterns = [
            /(?:import|require|process|console|fs|file|exec|spawn|fork)/i,
            /(?:function|class|var|let|const|=>)/,
            /(?:\.\s*[a-zA-Z]+\s*\()/,
            /(?:this|window|global|document)/i,
            /[;{}`'"]/ // block semicolons, braces, quotes
        ];

        if (!allowedPattern.test(expression)) {
            return message.channel.send("❌ Invalid characters detected. Only mathematical expressions are allowed.");
        }

        // Check for dangerous patterns
        for (const pattern of dangerousPatterns) {
            if (pattern.test(expression)) {
                return message.channel.send("❌ Potentially unsafe expression detected.");
            }
        }

        try {
            // Use Function constructor for safer evaluation
            const result = new Function('return ' + expression)();
            
            // Validate that result is a finite number
            if (typeof result !== 'number' || !isFinite(result)) {
                return message.channel.send("❌ Invalid calculation result.");
            }

            // Format the result
            let formattedResult = result;
            if (Math.abs(result) > 1000000 || (Math.abs(result) < 0.0001 && result !== 0)) {
                formattedResult = result.toExponential(4);
            } else if (!Number.isInteger(result)) {
                formattedResult = Number(result.toFixed(6));
            }

            // Remove Math. prefixes for cleaner display
            let displayExpression = args.join(" ")
                .replace(/Math\.sqrt/g, '√')
                .replace(/Math\.PI/g, 'π');

            await message.channel.send(`🧮 **${displayExpression} = ${formattedResult}**`);
        } catch (err) {
            console.error(`Calculation error: ${err.message}`, { 
                expression: args.join(" "), 
                user: message.author.tag 
            });
            
            let errorMsg = "❌ Error evaluating expression. ";
            
            if (err.message.includes('Unexpected')) {
                errorMsg += "Please check your syntax. Use `!help calculate` for examples.";
            } else {
                errorMsg += "Make sure your expression is valid.";
            }
            
            await message.channel.send(errorMsg);
        }
    },
};
