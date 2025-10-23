module.exports = {
    name: "calculate",
    aliases: ["calc"],
    description: "Performs mathematical calculations: +, -, *, /, %, ^, √, ² etc.",
    async execute(message, args) {
        if (!args.length)
            return message.reply("Please provide a mathematical expression to calculate.");

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
            /(?:function|class|var|let|const|=>|=>)/,
            /(?:\.\s*[a-zA-Z]+\s*\()/,
            /(?:this|window|global|document)/i,
            /[;{}`'"]/ // block semicolons, braces, quotes
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
            // Use Function constructor for safer evaluation
            const result = new Function('return ' + expression)();
            
            // Validate that result is a finite number
            if (typeof result !== 'number' || !isFinite(result)) {
                return message.reply("❌ Invalid calculation result.");
            }

            // Format the result
            let formattedResult = result;
            if (Math.abs(result) > 1000000 || (Math.abs(result) < 0.0001 && result !== 0)) {
                formattedResult = result.toExponential(4);
            } else if (!Number.isInteger(result)) {
                formattedResult = Number(result.toFixed(6));
            }

            await message.reply(`🧮 **${args.join(" ")} = ${formattedResult}**`);
        } catch (err) {
            console.error(`Calculation error: ${err.message}`, { expression, user: message.author.tag });
            await message.reply("❌ Error evaluating expression. Please check your syntax.");
        }
    },
};
