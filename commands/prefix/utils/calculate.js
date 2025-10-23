const { evaluate } = require('mathjs');

module.exports = {
    name: "calculate",
    aliases: ["calc"],
    description: "Performs mathematical calculations: +, -, *, /, %, ^, √, ² etc.",
    async execute(message, args) {
        if (!args.length)
            return message.reply("Please provide a mathematical expression to calculate.");

        // Join arguments into a full expression
        let expression = args.join(" ")
            .replace(/²/g, "^2")    // handle square symbol
            .replace(/√/g, "sqrt"); // handle square root
        
        // Prevent unsafe code evaluation
        if (/[^0-9+\-*/()%^.\s√²]/.test(expression)) {
            return message.reply("Invalid characters detected in the expression.");
        }

        try {
            // Math.js safely evaluates arithmetic expressions
            const result = evaluate(expression);

            // Format and send the result
            await message.reply(`🧮 **${expression} = ${result}**`);
        } catch (err) {
            await message.reply("Error evaluating expression. Please check your syntax.");
        }
    },
};
