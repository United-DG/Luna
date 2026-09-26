const { get } = require('../../colors/setup');
const { GroqAI } = require('../../colors/groq');
const axios = require('axios');

module.exports = {
    x: {
        type: 'utility',
        desc: 'Use Luna AI to answer questions or have a conversation',
        usage: 'x <your question>',
        run: async (Luna, message, fulltext) => {
            const sender = message.key.remoteJid;
            const query = fulltext.split(' ').slice(1).join(' ').trim();
            
            if (!query) {
                return await Luna.sendMessage(sender, {
                    text: '❓ Please provide a question or prompt for the AI. Example: `ai What is the capital of France?`'
                }, { quoted: message });
            } 

            try {
                const GROQ_API_KEY = await get('GROQ');
                const aiProcessor = new GroqAI(GROQ_API_KEY);
                
                // Fetch saved model, fallback to first in list
                const savedModel = await get('MODEL');
                const model_choice = savedModel || 'groq/compound-mini';
                
                const response = await aiProcessor.processQuery(query, {
                    model_choice: model_choice,
                    system_prompt: "You are Luna. Create engaging WhatsApp conversations."
                });
                
                const aiText = response?.[0]?.content?.parts?.[0]?.text;
                if (!aiText) {
                    throw new Error("No response from AI");
                }
                
                const reply = aiText.replace(/^["']|["']$/g, '').trim();
                await Luna.sendMessage(sender, {
                    text: `> 🤖 *Luna Response:*\n\n${reply}`
                }, { quoted: message });
                
            } catch (error) {
                console.error('AI Processing Error:', error.message);
                await Luna.sendMessage(sender, {
                    text: `⚠️ *Luna AI Error:*\n\n${error.message}\n\n💡 Get free key: console.groq.com/keys`
                }, { quoted: message });
            }
        },
    },

    groq: {
        type: 'utility',
        desc: 'List all available Groq AI models in your account',
        usage: 'groq',
        run: async (Luna, message) => {
            const sender = message.key.remoteJid;

            try {
                const GROQ_API_KEY = await get('GROQ');
                
                if (!GROQ_API_KEY) {
                    return await Luna.sendMessage(sender, {
                        text: '❌ GROQ_API_KEY not found. Please set it first using: `set GROQ your_api_key`'
                    }, { quoted: message });
                }

                const url = "https://api.groq.com/openai/v1/models";
                const headers = {
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                };

                const response = await axios.get(url, { headers });
                const modelNames = response.data.data.map(model => model.id);

                if (modelNames.length === 0) {
                    return await Luna.sendMessage(sender, {
                        text: '⚠️ No models found in your account.'
                    }, { quoted: message });
                }

                let modelList = '🪄 *Available Groq Models:*\n\n';
                modelNames.forEach((name, index) => {
                    modelList += ` ${index + 1}. \`${name}\`\n`;
                });
                modelList += `\n📌 *Usage:* Use \`set MODEL <model_name>\` to set your preferred model.`;
                modelList += `\n💡 *Example:* \`set MODEL ${modelNames[0]}\``;

                await Luna.sendMessage(sender, {
                    text: modelList
                }, { quoted: message });

            } catch (error) {
                console.error('Groq List Error:', error.message);
                
                let errorMsg = '⚠️ *Failed to fetch models:*\n\n';
                if (error.response?.status === 401) {
                    errorMsg += '❌ Invalid API key. Please check your GROQ_API_KEY.\n💡 Get free key: console.groq.com/keys';
                } else if (error.response?.status === 429) {
                    errorMsg += '⏳ Rate limit exceeded. Please try again later.';
                } else {
                    errorMsg += `❌ ${error.message}`;
                }

                await Luna.sendMessage(sender, {
                    text: errorMsg
                }, { quoted: message });
            }
        },
    }
};