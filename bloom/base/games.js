const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { User, Pokemon, TicTacToe } = require('../../colors/schema');
const { createGame, joinGame, endGame, renderBoard } = require('../ttthandle');
const { pokemon } = require('../../colors/pokemon');
const { get }= require('../../colors/setup');

const pokemonNames = ['Pikachu', 'Charmander', 'Bulbasaur', 'Squirtle', 'Jigglypuff', 'Meowth', 'Psyduck', 'Eevee', 'Snorlax', 'Mewtwo'];
const animals = ['lion', 'buffalo', 'fox', 'monkey', 'ant', 'rabbit', 'dinosaur', 'zebra'];
const sizes = ['small', 'medium', 'big'];
const aquaticAnimals = ['whale', 'shark', 'fish', 'frog', 'blowfish', 'tropical_fish'];
const shopItems = { "wooden_axe": 100, "iron_axe": 200, "diamond_axe": 500, "golden_axe": 1000, "magic_wand": 2000, "fish_net": 1850, "fish_hook": 100, "spear": 450, "potion": 800, "hearb": 300 };
const itemEmojis = { "wooden_axe": "🪓", "iron_axe": "⛏️", "diamond_axe": "💎🪓", "golden_axe": "🪙🪓", "magic_wand": "🪄", "fish_net": "🎣", "fish_hook": "🪝", "spear": "⚔️", "potion": "🔮", "herb": "🫚" };
const itemCategories = { "wooden_axe": "mining", "iron_axe": "mining", "diamond_axe": "mining", "golden_axe": "mining", "magic_wand": "magic", "fish_net": "fishing", "fish_hook": "fishing", "spear": "fishing", "potion": "healing", "hearb": "healing" };
const animalEmojis = { lion: '🦁', buffalo: '🐃', fox: '🦊', monkey: '🐒', ant: '🐜', rabbit: '🐇', dinosaur: '🦖', zebra: '🦓' };
const aquaticAnimalEmojis = { whale: '🐋', shark: '🦈', fish: '🐟', frog: '🐸', blowfish: '🐡', tropical_fish: '🐠' };
const gambleMultipliers = {
    red: Math.floor(Math.random() * 1101) - 100,
    blue: Math.floor(Math.random() * 1101) - 100,
    green: Math.floor(Math.random() * 1101) - 100,
    yellow: Math.floor(Math.random() * 1101) - 100,
    purple: Math.floor(Math.random() * 1101) - 100,
    orange: Math.floor(Math.random() * 1101) - 100,
    pink: Math.floor(Math.random() * 1101) - 100,
    black: Math.floor(Math.random() * 1101) - 100,
    white: Math.floor(Math.random() * 1101) - 100,
    magenta: Math.floor(Math.random() * 1101) - 100,
    cyan: Math.floor(Math.random() * 1101) - 100,
    indigo: Math.floor(Math.random() * 1101) - 100,
    violet: Math.floor(Math.random() * 1101) - 100,
    grey: Math.floor(Math.random() * 1101) - 100,
    brown: Math.floor(Math.random() * 1101) - 100,
    maloon: Math.floor(Math.random() * 1101) - 100,
};

module.exports = {
    bal: {
        type: 'economy',
        desc: 'Check your wallet and bank balance',
        run: async (Bloom, message, fulltext) => {
            const senderID = message.key.participant || message.key.remoteJid;
            const user = await User.findById(senderID);
            if (!user) return Bloom.sendMessage(message.key.remoteJid, { text: 'You are not registered in the economy. Please register first.\n\n!reg <username>' }, { quoted: message });
            const balanceInfo = { user: user.name, wallet: user.walletBalance, bank: user.bankBalance };
            return Bloom.sendMessage(message.key.remoteJid, { text: `- ${balanceInfo.user} | Balance:\n╭──────── 💰\n│>  Wallet: ${balanceInfo.wallet} \n│>  Bank: ${balanceInfo.bank} \n╰───────── 💳` }, { quoted: message });
        }
    },

reg: {
    type: 'economy',
    desc: 'Register or update your economy profile',
    reg: 'reg <name>',
    run: async (Bloom, message, fulltext) => {
        const senderID = message.key.participant || message.key.remoteJid;
        const arg = fulltext.trim().split(/\s+/)[1];
        let name = arg || generateRandomName();

        if (!isValidName(name))
            return Bloom.sendMessage(message.key.remoteJid, {
                text: 'Invalid name. Name must be at least 4 characters long, contain only letters, and no symbols.'
            }, { quoted: message });

        // Generate a unique "email" to avoid duplicates
        const fakeEmail = `${name}-${uuidv4()}@lunabot.com`;

        let user = await User.findById(senderID);
        if (user) {
            user.name = name;
            user.email = fakeEmail;  // Add fake email here
            await user.save();
            return Bloom.sendMessage(message.key.remoteJid, { text: `Welcome back! Your name has been updated to ${name}.` }, { quoted: message });
        } else {
            user = new User({ _id: senderID, name, email: fakeEmail });
            await user.save();
            return Bloom.sendMessage(message.key.remoteJid, { text: `Welcome, ${name}! You have been successfully registered in the economy.` }, { quoted: message });
        }
    }
},

    dep: {
        type: 'economy',
        desc: 'Deposit money into your bank account',
        uasage: 'dep <amount>',
        run: async (Bloom, message, fulltext) => {
            const senderID = message.key.participant || message.key.remoteJid;
            const arg = parseFloat(fulltext.trim().split(/\s+/)[1]);

            if (isNaN(arg)) return Bloom.sendMessage(message.key.remoteJid, { text: 'Invalid input. You must deposit a valid number.' }, { quoted: message });

            const user = await User.findById(senderID);
            if (!user) return Bloom.sendMessage(message.key.remoteJid, { text: 'You are not registered in the economy. Please register first.\n\n!reg <username>' }, { quoted: message });
            if (user.walletBalance < arg) return Bloom.sendMessage(message.key.remoteJid, { text: `Insufficient funds in your wallet to deposit. You have ${user.walletBalance} available, but you tried to deposit ${arg}.` }, { quoted: message });
            if (arg > 100000) return Bloom.sendMessage(message.key.remoteJid, 'You cannot deposit more than 100,000.');

            user.walletBalance -= arg;
            user.bankBalance += arg;
            user.transactionHistory.push({ type: 'deposit', arg, result: 'success' });
            await user.save();

            Bloom.sendMessage(message.key.remoteJid, {text: `- Dear ${user.name} You have successfully deposited ${arg} 💰 into your bank account. New wallet balance: ${user.walletBalance}, New bank balance: ${user.bankBalance}`},{ quoted: message });
        }
    },

    withd: {
        type: 'economy',
        desc: 'Withdraw money from your bank account',
        usage: 'withd <amount>',
        run: async (Bloom, message, fulltext) => {
            const senderID = message.key.participant || message.key.remoteJid;
            const arg = parseFloat(fulltext.trim().split(/\s+/)[1]);

            if (!fulltext || isNaN(arg)) return Bloom.sendMessage(message.key.remoteJid, { text: 'Invalid input. You must specify a valid number to withdraw.' }, { quoted: message });

            const user = await User.findById(senderID);
            if (user.bankBalance < arg) return Bloom.sendMessage(message.key.remoteJid, { text: 'Insufficient funds in your bank account.' }, { quoted: message });
            if (arg > 500000) return Bloom.sendMessage(message.key.remoteJid, { text: 'You cannot withdraw more than 500,000.' }, { quoted: message });

            const transactionFee = calculateTransactionFee(arg);
            const totalAmountToWithdraw = arg + transactionFee;

            if (user.bankBalance < totalAmountToWithdraw) return Bloom.sendMessage(message.key.remoteJid, { text: 'Insufficient funds to cover the withdrawal and transaction fee.' }, { quoted: message });

            user.bankBalance -= totalAmountToWithdraw;
            user.walletBalance += arg;
            user.transactionHistory.push({ type: 'withdraw', arg, transactionFee, result: 'success' });
            await user.save();

            return Bloom.sendMessage(message.key.remoteJid, { text: `You have successfully withdrawn ${arg} 💰 to your wallet. Transaction fee: ${transactionFee} 💰. New bank balance: ${user.bankBalance}, New wallet balance: ${user.walletBalance}` }, { quoted: message });
        }
    },

    trans: {
        type: 'economy',
        desc: 'Transfer money to another user',
        usage: 'trans <amount> <user_id> or\ntrans @user <amount>',
        run: async (Bloom, message, fulltext) => {
            const senderID = message.key.participant || message.key.remoteJid;
            const value = fulltext.trim().split(/\s+/)[2];
            const arg = parseFloat(fulltext.trim().split(/\s+/)[1]);

            if (isNaN(arg)) return Bloom.sendMessage(message.key.remoteJid, { text: 'Invalid amount. You must specify a valid number to transfer.' }, { quoted: message });

            let receiver = null;
            if (value && /^[0-9]{10,15}$/.test(value)) {
                const receiverId = await convertPhoneNumberToJID(value);
                receiver = await User.findById(receiverId);
            }

            if (!receiver && message.message?.extendedTextMessage?.contextInfo?.participant) {
                const quotedUserId = message.message.extendedTextMessage.contextInfo.participant;
                receiver = await User.findById(quotedUserId);
            }


            if (!receiver) return Bloom.sendMessage(message.key.remoteJid, { text: 'The specified receiver does not exist in the economy database.' }, { quoted: message });

            const user = await User.findById(senderID);
            if (!user) return Bloom.sendMessage(message.key.remoteJid, { text: 'You are not registered in the economy. Please register first.\n\n!reg <username>' }, { quoted: message });
            if (user.walletBalance < arg) return Bloom.sendMessage(message.key.remoteJid, { text: 'Insufficient funds in your wallet.' }, { quoted: message });
            if (arg > 500000) return Bloom.sendMessage(message.key.remoteJid, { text: 'You cannot transfer more than 500,000.' }, { quoted: message });

            const transactionFee = calculateTransactionFee(arg);
            const totalAmountToTransfer = arg + transactionFee;

            if (user.walletBalance < totalAmountToTransfer) return Bloom.sendMessage(message.key.remoteJid, { text: 'Insufficient funds to cover both the transfer and transaction fee.' }, { quoted: message });

            user.walletBalance -= totalAmountToTransfer;
            receiver.walletBalance += arg;
            user.transactionHistory.push({ type: 'transfer', arg, transactionFee, result: 'success' });
            receiver.transactionHistory.push({ type: 'transfer', arg, transactionFee, result: 'received' });

            await user.save();
            await receiver.save();

            await Bloom.sendMessage(message.key.remoteJid, { text: `You successfully transferred ${arg} 💰 to ${receiver.name}. Transaction fee: ${transactionFee} 💰. New wallet balance: ${user.walletBalance}` }, { quoted: message });
            console.log(receiver._id);
            await Bloom.sendMessage(message.key.remoteJid, {
                text: `[${receiver.name}] 🎮 Hello Gamer,\nYou received ${arg} 💰 from ${user.name}.\n> @${receiver._id.split('@')[0]} BAL: ${receiver.walletBalance}`, mentions: [receiver._id]} );

        }
    },

    shop: {
        type: 'economy',
        desc: 'View available items in the shop',
        run: async (Bloom, message) => {
            const senderID = message.key.participant || message.key.remoteJid;
            const user = await User.findById(senderID);

            if (!user) return Bloom.sendMessage(message.key.remoteJid, { text: 'You are not registered in the economy. Please register first.' }, { quoted: message });

            let shopMessage = `Welcome ${user.name} to the shop! 🎉\nHere are the available items:\n`;
            for (const [item, price] of Object.entries(shopItems)) {
                const emoji = itemEmojis[item] || "🛒";
                shopMessage += `${emoji} ${item.replace(/_/g, ' ')}: ${price} 💰\n`;
            }

            Bloom.sendMessage(message.key.remoteJid, { text: shopMessage }, { quoted: message });
        }
    },

    buy: {
        type: 'economy',
        desc: 'Purchase an item from the shop',
        usage: 'buy <item_name>',
        run: async (Bloom, message, fulltext) => {
            const senderID = message.key.participant || message.key.remoteJid;
            const itemName = fulltext.trim().split(/\s+/)[1]?.toLowerCase();
            const user = await User.findById(senderID);
            if (!user) return Bloom.sendMessage(message.key.remoteJid, { text: 'You are not registered in the economy. Please register first.\n\n!reg <username>' }, { quoted: message });
            const itemPrice = shopItems[itemName];

            if (!itemPrice) return Bloom.sendMessage(message.key.remoteJid, {text: 'Item not found in the shop.'}, {quoted: message});
            if (user.walletBalance < itemPrice) return Bloom.sendMessage(message.key.remoteJid, {text: 'You do not have enough funds to buy this item.'}, {quoted: message});

            user.walletBalance -= itemPrice;
            const category = itemCategories[itemName];

            if (category) {
                if (["mining", "fishing", "healing", "magic"].includes(category)) {
                    user.inventory[category].push({ name: itemName, miningUses: 0 });
                } else {
                    user.inventory[category].push({ name: itemName });
                }
            } else {
                return Bloom.sendMessage(message.key.remoteJid, {text: 'Error: Item category not found.'}, {quoted: message});
            }

            user.transactionHistory.push({ type: 'buy', arg: itemPrice, item: itemName, result: 'success' });
            await user.save();

            Bloom.sendMessage(message.key.remoteJid, { text: `You bought a ${itemEmojis[itemName] || ''}${itemName} for ${itemPrice} 💰.` }, {quoted: message});
        }
    },

    inv: {
        type: 'economy',
        desc: 'View your inventory',
        run: async (Bloom, message) => {
            const senderID = message.key.participant || message.key.remoteJid;
            const user = await User.findById(senderID);
            if (!user) return Bloom.sendMessage(message.key.remoteJid, { text: 'You are not registered in the economy. Please register first.\n\n!reg <username>' }, { quoted: message });
            let inventoryMessage = `╭───── ${user.name} ─────\n│-- _Your inventory_ --\n`;

            function formatItems(items, itemType) {
                const itemCount = {};
                items.forEach(item => {
                    itemCount[item.name] = (itemCount[item.name] || { count: 0, totalValue: 0 });
                    itemCount[item.name].count++;
                    itemCount[item.name].totalValue += item.value || item.miningUses;
                });

                let itemMessage = "";
                for (const [name, { count, totalValue }] of Object.entries(itemCount)) {
                    itemMessage += `│- ${name}  - ${count} | Usage: ${totalValue} time(s)\n`;
                }

                if (itemMessage === "") itemMessage = `│- No ${itemType} items\n`;
                return itemMessage;
            }

            inventoryMessage += "│──── Mining items: ⛏️ ───\n";
            inventoryMessage += formatItems(user.inventory.mining, "mining");
            inventoryMessage += "│──── Magic items: 🪄 ───\n";
            inventoryMessage += formatItems(user.inventory.magic, "magic");
            inventoryMessage += "│──── Fishing items: 🎣 ───\n";
            inventoryMessage += formatItems(user.inventory.fishing, "fishing");
            inventoryMessage += "│──── Healing items: ☮️ ───\n";
            inventoryMessage += formatItems(user.inventory.healing, "healing");
            inventoryMessage += "│──── Zoo animals: 🦁 ───\n";

            if (user.inventory.animals.length > 0) {
                const animalCount = {};
                let totalAnimalValue = 0;
                user.inventory.animals.forEach(animal => animalCount[animal.name] = (animalCount[animal.name] || 0) + 1);

                for (const [animalName, count] of Object.entries(animalCount)) {
                    const animal = user.inventory.animals.find(a => a.name === animalName);
                    const totalValue = animal.value * count;
                    totalAnimalValue += totalValue;
                    inventoryMessage += `│- ${animalName} | Count: ${count}, Value: ${totalValue} 💰\n`;
                }

                inventoryMessage += `│──>Total Animal Value: ${totalAnimalValue} 💰\n`;
            } else {
                inventoryMessage += "│- No animals\n";
            }

            inventoryMessage += "│──── Rare stones: 🪨 ───\n";

            if (user.inventory.stones.length > 0) {
                const stoneCount = {};
                let totalStoneValue = 0;

                user.inventory.stones.forEach(stone => {
                    if (!stoneCount[stone.name]) stoneCount[stone.name] = { count: 0, totalValue: 0 };
                    stoneCount[stone.name].count++;
                    stoneCount[stone.name].totalValue += stone.value;
                });

                for (const [stoneName, { count, totalValue }] of Object.entries(stoneCount)) {
                    inventoryMessage += `│- ${stoneName} - ${count} | Value: ${totalValue} 💰\n`;
                }

                for (const { totalValue } of Object.values(stoneCount)) {
                    totalStoneValue += totalValue;
                }

                inventoryMessage += `│──> Total Stones Value: ${totalStoneValue} 💰\n╰──────────────────`;
            } else {
                inventoryMessage += "│- No stones\n╰──────────────────";
            }

            Bloom.sendMessage(message.key.remoteJid, { text: inventoryMessage }, { quoted: message });
        }
    },

    hunt: {
        type: 'economy',
        desc: 'Go hunting for animals',
        run: async (Bloom, message) => {
            const senderID = message.key.participant || message.key.remoteJid;
            const user = await User.findById(senderID);
            if (!user) return Bloom.sendMessage(message.key.remoteJid, { text: 'You are not registered in the economy. Please register first.\n\n!reg <username>' }, { quoted: message });
            const currentDate = new Date();
            const lastCatchTime = new Date(user.lastZooCatch);
            const timeDifference = currentDate - lastCatchTime;

            if (timeDifference < 600000) return Bloom.sendMessage(message.key.remoteJid, {text: 'You need to wait a bit before you can catch another animal! Remember hunting is illegal.'}, {quoted: message});

            user.lastZooCatch = currentDate;
            const randomAnimalIndex = Math.floor(Math.random() * animals.length);
            const animal = animals[randomAnimalIndex];
            const size = sizes[Math.floor(Math.random() * sizes.length)];
            const basePrice = Math.floor(Math.random() * 1000) + 100;
            const priceMultiplier = size === 'small' ? 0.5 : size === 'medium' ? 1 : 1.5;
            const finalPrice = basePrice * priceMultiplier;

            user.inventory.animals.push({ name: animal, value: finalPrice });
            user.transactionHistory.push({type: 'catch_animal', arg: finalPrice, animal: animal, result: 'caught' });
            await user.save();

            Bloom.sendMessage(message.key.remoteJid, {text: `You went for a hunt and caught a ${size} ${animalEmojis[animal]} ${animal} worth ${finalPrice} 💰.`}, {quoted: message});
        }
    },
fish: {
    type: 'economy',
    desc: 'Go fishing for aquatic animals',
    run: async (Bloom, message) => {

        const senderID = message.key.participant || message.key.remoteJid;
        const user = await User.findById(senderID);
        if (!user)
            return Bloom.sendMessage(message.key.remoteJid, { text: "You don't exist in the economy." }, { quoted: message });

        const currentDate = new Date();
        const lastCatchTime = new Date(user.lastFishCatch);
        const timeDifference = currentDate - lastCatchTime;

        if (timeDifference < 600000)
            return Bloom.sendMessage(message.key.remoteJid, { text: "You need to wait a bit before you can fish again!" }, { quoted: message });
        const toolLimits = {
            fish_hook: 10,
            spear: 15,
            fish_net: 20
        };

        const catchTypes = {
            fish_hook: ['fish', 'frog'],
            spear: ['fish', 'frog', 'blowfish'],
            fish_net: ['fish', 'frog', 'blowfish', 'tropical_fish', 'shark']
        };
        const fishingTool = user.inventory.fishing.find(tool => tool.name);

        if (!fishingTool)
            return Bloom.sendMessage(message.key.remoteJid, { text: "You don't have any fishing tools! Buy one using *shop*." }, { quoted: message });

        const tool = fishingTool.name;
        const availableCatches = catchTypes[tool];
        const randomAnimal = availableCatches[Math.floor(Math.random() * availableCatches.length)];
        const size = sizes[Math.floor(Math.random() * sizes.length)];
        const basePrice = Math.floor(Math.random() * 1000) + 100;
        const multiplier = size === 'small' ? 0.5 : size === 'medium' ? 1 : 1.5;
        const finalPrice = Math.floor(basePrice * multiplier);
        user.inventory.animals.push({ name: randomAnimal, value: finalPrice });

        // Track tool usage
        let toolUsage = fishingTool.miningUses || 0;
        toolUsage++;
        fishingTool.miningUses = toolUsage;

        user.lastFishCatch = currentDate;
        user.transactionHistory.push({
            type: 'catch_fish',
            item: randomAnimal,
            arg: finalPrice,
            result: 'caught'
        });
        if (toolUsage >= toolLimits[tool]) {

            const toolIndex = user.inventory.fishing.findIndex(t => t.name === tool);
            if (toolIndex !== -1)
                user.inventory.fishing.splice(toolIndex, 1);

            await user.save();

            return Bloom.sendMessage(message.key.remoteJid, {
                text:
                    `🎣 You used your *${tool}* and caught a ${size} ${aquaticAnimalEmojis[randomAnimal]} ${randomAnimal} worth ${finalPrice} 💰.\n\n` +
                    `⚠️ Your ${tool} broke after ${toolUsage} uses!`
            }, { quoted: message }); }
        await user.save();

        return Bloom.sendMessage(message.key.remoteJid, {
            text:
                `🎣 You used your *${tool}* and caught a ${size} ${aquaticAnimalEmojis[randomAnimal]} ${randomAnimal} worth ${finalPrice} 💰.\n` +
                `🛠️ Your ${tool} has *${toolLimits[tool] - toolUsage} uses left*.`
        }, { quoted: message });
    }
},
       gamble: {
        type: 'economy',
        desc: 'Gamble your money on colours',
        usage: 'gamble <colour> <amount>',
        run: async (Bloom, message, fulltext) => {
            const senderID = message.key.participant || message.key.remoteJid;
            const parts = fulltext.trim().split(/\s+/);
            const color = parts[1];
            const betAmountStr = parts[2];
            const betAmount = parseInt(betAmountStr, 10);
            const user = await User.findById(senderID);
            if (!user) return Bloom.sendMessage(message.key.remoteJid, { text: 'You are not registered in the economy. Please register first.\n\n!reg <username>' }, { quoted: message });
            const now = new Date();
            const lastGambleTime = new Date(user.lastGamble || 0);
            const diff = now - lastGambleTime;
            if (diff < 10000) {
                const remaining = ((10000 - diff) / 1000).toFixed(1);
                return Bloom.sendMessage(
                    message.key.remoteJid,
                    { text: `⏳ You must wait **${remaining}s** before gambling again!` },
                    { quoted: message }
                );
            }
            if (!gambleMultipliers[color])
                return Bloom.sendMessage(message.key.remoteJid, {
                    text: 'Invalid color. Please choose a valid color to gamble with.\neg: red, blue, green, yellow, purple, orange, pink, black, white'
                }, { quoted: message });

            if (isNaN(betAmount))
                return Bloom.sendMessage(message.key.remoteJid, {
                    text: 'Invalid bet amount. Please provide a valid positive number.'
                }, { quoted: message });

            if (user.walletBalance < betAmount)
                return Bloom.sendMessage(message.key.remoteJid, {
                    text: 'You do not have enough funds to gamble.'
                }, { quoted: message });

            if (betAmount > 10000)
                return Bloom.sendMessage(message.key.remoteJid, {
                    text: 'You cannot gamble more than 10,000 💰.'
                }, { quoted: message });

            user.lastGamble = now;

            user.walletBalance -= betAmount;
            const multiplier = gambleMultipliers[color];
            const winnings = betAmount * (multiplier / 100);
            let resultMessage = `You chose ${color}. `;

            if (winnings > 0) {
                user.walletBalance += winnings;
                user.transactionHistory.push({
                    type: 'gamble',
                    arg: betAmount,
                    result: 'win',
                    transactionFee: 0
                });
                await user.save();
                resultMessage += `🎉 You won ${winnings.toFixed(2)} 💰!\nNew balance: ${user.walletBalance} 💰.`;
            } else {
                user.transactionHistory.push({
                    type: 'gamble',
                    arg: betAmount,
                    result: 'lose',
                    transactionFee: 0
                });
                await user.save();
                resultMessage += `❌ You lost ${betAmount} 💰.\nNew balance: ${user.walletBalance} 💰.`;
            }

            Bloom.sendMessage(message.key.remoteJid, { text: resultMessage }, { quoted: message });
        }
    },

    work: {
        type: 'economy',
        desc: 'Work to earn money',
        run: async (Bloom, message) => {
            const senderID = message.key.participant || message.key.remoteJid;
            const user = await User.findById(senderID);

            // Check if user is registered
            if (!user) {
                return Bloom.sendMessage(
                    message.key.remoteJid,
                    { text: 'You need to register first to use the work command. Use !reg <name> to register.' },
                    { quoted: message }
                );
            }

            const currentTime = new Date();
            const lastWorkTime = new Date(user.lastWork);
            const timeDifference = currentTime - lastWorkTime;

            if (timeDifference < 3600000) {
                return Bloom.sendMessage(
                    message.key.remoteJid,
                    { text: '⏳ You can work again in an hour.' },
                    { quoted: message }
                );
            }

            const jobs = {
                'scientist': 400,
                'miner': 200,
                'farmer': 150,
                'fisher': 100,
                'blacksmith': 300,
                'dentist': 350
            };
            const jobKeys = Object.keys(jobs);
            const randomJob = jobKeys[Math.floor(Math.random() * jobKeys.length)];
            const earnings = jobs[randomJob];

            user.walletBalance += earnings;
            user.lastWork = currentTime;
            user.transactionHistory.push({ type: 'work', arg: earnings, result: 'success' });
            await user.save();

            Bloom.sendMessage(
                message.key.remoteJid,
                { text: `👷‍♂️ You worked as a ${randomJob} and earned ${earnings} 💰. Your new wallet balance is ${user.walletBalance} 💰.` },
                { quoted: message }
            );
        }
    },

    daily: {
        type: 'economy',
        desc: 'Claim your daily reward',
        run: async (Bloom, message) => {
            const senderID = message.key.participant || message.key.remoteJid;
            const user = await User.findById(senderID);

            if (!user) return Bloom.sendMessage(message.key.remoteJid, { text: 'You need to register first to claim your daily reward. Use `!reg <name>` to register.' }, { quoted: message });

            const now = new Date();
            const last = new Date(user.lastDailyClaim);
            const diff = now - last;

            if (diff < 86400000) {
                const msLeft = 86400000 - diff;
                const hours = Math.floor(msLeft / (1000 * 60 * 60));
                const minutes = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
                return Bloom.sendMessage(message.key.remoteJid, { text: `⏳ You can claim your next daily reward in ${hours} hr(s) ${minutes} min(s).` }, { quoted: message });
            }

            const reward = Math.floor(Math.random() * 500) + 100;
            user.walletBalance += reward;
            user.lastDailyClaim = now;
            user.transactionHistory.push({ type: 'daily_claim', arg: reward, result: 'success' });
            await user.save();

            Bloom.sendMessage(message.key.remoteJid, { text: `🎉 You've claimed your daily reward! You received ${reward} 💰. New wallet balance: ${user.walletBalance} 💰.` }, { quoted: message });
        }
    },

    sell: {
        type: 'economy',
        desc: 'Sell items from your inventory',
        usage: 'sell <animal> or <stone>',
        run: async (Bloom, message, fulltext) => {
            const senderID = message.key.participant || message.key.remoteJid;
            const arg = fulltext.trim().split(/\s+/)[1];
            const user = await User.findById(senderID);
            if (!user) return Bloom.sendMessage(message.key.remoteJid, { text: 'You are not registered in the economy. Please register first.\n\n!reg <username>' }, { quoted: message });
            const animalIndex = user.inventory.animals.findIndex(item => item.name === arg);
            const stoneIndex = user.inventory.stones.findIndex(item => item.name === arg);

            if (animalIndex === -1 && stoneIndex === -1) return Bloom.sendMessage(message.key.remoteJid, { text: `You don't have a ${arg} to sell.` }, { quoted: message });

            let item;
            let itemType;
            let itemPrice;

            if (animalIndex !== -1) {
                item = user.inventory.animals[animalIndex];
                itemType = 'animal';
                itemPrice = item.value;
            }
            else if (stoneIndex !== -1) {
                item = user.inventory.stones[stoneIndex];
                itemType = 'stone';
                itemPrice = item.value;
            }

            if (!itemPrice) return Bloom.sendMessage(message.key.remoteJid, { text: `This ${arg} cannot be sold.` }, { quoted: message });

            user.walletBalance += itemPrice;

            if (itemType === 'animal') user.inventory.animals.splice(animalIndex, 1);
            else if (itemType === 'stone') user.inventory.stones.splice(stoneIndex, 1);

            user.transactionHistory.push({ type: `sell_${itemType}`, arg: itemPrice, [itemType]: arg, result: 'success' });
            await user.save();

            Bloom.sendMessage(message.key.remoteJid, { text: `You sold your ${arg} for ${itemPrice} 💰. Your new wallet balance is ${user.walletBalance} 💰.` }, { quoted: message });
        }
    },

    mine: {
        type: 'economy',
        desc: 'Mine for stones using your tools',
        run: async (Bloom, message) => {
            const senderID = message.key.participant || message.key.remoteJid;
            const user = await User.findById(senderID);

            if (!user) return Bloom.sendMessage(message.key.remoteJid, { text: 'You are not registered in the economy. Please register first.\n\n!reg <username>' }, { quoted: message });

            const toolLimits = { wooden_axe: 5, iron_axe: 10, golden_axe: 20, diamond_axe: 15 };
            const stoneTypes = {
                wooden_axe: ['coal'],
                iron_axe: ['coal','iron'],
                diamond_axe: ['coal','iron','diamond'],
                golden_axe:['coal','iron','diamond','gold']
            };

            const miningTool = user.inventory.mining.find(tool => tool.name);
            if (!miningTool) return Bloom.sendMessage(message.key.remoteJid, { text: "You don't have any mining tools!" }, { quoted: message });

            const tool = miningTool.name;
            const availableStones = stoneTypes[tool];
            const randomStone = availableStones[Math.floor(Math.random() * availableStones.length)];
            const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
            let stoneValue;

            if (randomSize === 'small') stoneValue = 50;
            else if (randomSize === 'medium') stoneValue = 100;
            else stoneValue = 200;

            user.inventory.stones.push({ name: randomStone, value: stoneValue });
            let toolUsage = miningTool.miningUses || 0;
            toolUsage++;
            miningTool.miningUses = toolUsage;

            if (toolUsage >= toolLimits[tool]) {
                const toolIndex = user.inventory.mining.findIndex(t => t.name === tool);
                if (toolIndex !== -1) user.inventory.mining.splice(toolIndex, 1);
                user.transactionHistory.push({ type: 'mine', item: randomStone, result: 'success', arg: stoneValue });
                await user.save();
                return Bloom.sendMessage(message.key.remoteJid, { text: `You used your ${tool} and mined a ${randomSize} ${randomStone} rock worth ${stoneValue} 💰.\n\nYour ${tool} has broken after ${toolUsage} uses! You need a new one.` }, { quoted: message });
            }

            user.transactionHistory.push({ type: 'mine', item: randomStone, result: 'success', arg: stoneValue });
            await user.save();

            return Bloom.sendMessage(message.key.remoteJid, { text: `You used your ${tool} and mined a ${randomSize} ${randomStone} rock worth ${stoneValue} 💰. Your ${tool} has ${toolLimits[tool] - toolUsage} uses left.` }, { quoted: message });
        }
    },
    reset: {
        type: 'economy',
        desc: 'Reset your Economy account (warning: irreversible)',
        run: async (Bloom, message) => {
            const senderID = message.key.participant || message.key.remoteJid;
            const user = await User.findById(senderID);
            if (!user) return Bloom.sendMessage(message.key.remoteJid, { text: 'You are not registered in the economy. Please register first.\n\n!reg <username>' }, { quoted: message });
            user.walletBalance = 0;
            user.bankBalance = 0;
            user.inventory = { mining: [], magic: [], fishing: [], healing: [], animals: [], stones: [], miningUses: new Map() };
            user.transactionHistory = [];
            user.lastDailyClaim = new Date();
            user.lastZooCatch = new Date();
            user.lastGamble = new Date();
            user.lastWork = new Date();

            await user.save();

            Bloom.sendMessage(message.key.remoteJid, { text: `Your account has been purged and reset to default values, ${user.name}. All items and balances have been cleared.` }, { quoted: message });
        }
    },

    catch: {
        type: 'game',
        desc: 'Catch a Pokémon that has appeared',
        usage: 'catch <pokemon_name>',
        run: async (Bloom, message, fulltext) => {
            const senderID = message.key.participant || message.key.remoteJid;
            const arg = fulltext.trim().split(/\s+/)[1];
            const pokemon = await Pokemon.findOne({ name: { $regex: new RegExp('^' + arg + '$', 'i') } });

            if (!pokemon) return Bloom.sendMessage(message.key.remoteJid, { text: 'No claimable Pokémon found with that name, check your spelling mistake and try again.' }, { quoted: message });

            const currentTime = new Date();
            if (currentTime.getTime() > pokemon.timeout.getTime()) return Bloom.sendMessage(message.key.remoteJid, { text: `The Pokémon ${pokemon.name} has expired and is no longer available for claim.` }, { quoted: message });

            const user = await User.findOne({ _id: senderID });
            if (!user) return Bloom.sendMessage(message.key.remoteJid, { text: 'You are not registered yet. Please register first using the command: !reg <name>' }, { quoted: message });

            user.inventory.pokemons.push({
                name: pokemon.name,
                height: pokemon.height,
                weight: pokemon.weight,
                image: pokemon.image,
                description: pokemon.description
            });

            await user.save();
            await Pokemon.deleteOne({ name: pokemon.name });

            return Bloom.sendMessage(message.key.remoteJid, {
                text: `Congratulations! You have successfully claimed ${pokemon.name}\n\n${pokemon.description}.\nHeight: ${pokemon.height} \t\t\t Weight: ${pokemon.weight}`
            }, { quoted: message });
        }
    },
    pokes: {
        type: 'game',
        desc: 'View your Pokémon collection',
        run: async (Bloom, message) => {
            try {
                const senderID = message.key.participant || message.key.remoteJid;
                const user = await User.findById(senderID);
                if (!user) return Bloom.sendMessage(message.key.remoteJid, { text: 'You are not registered in the economy. Please register first.\n\n!reg <username>' }, { quoted: message });
                if (!user.inventory || !user.inventory.pokemons || user.inventory.pokemons.length === 0) {
                    await Bloom.sendMessage(message.key.remoteJid, { text: "You don't have any Pokémon in your inventory yet! You avent caught any." }, { quoted: message });
                    return;
                }

                const pokemons = user.inventory.pokemons;
                let messageContent = "Here are the Pokémon in your inventory:\n\n";

                pokemons.forEach(pokemon => {
                    messageContent += `*${pokemon.name}*\n`;
                    messageContent += `- Height: ${pokemon.height} decimeters\n`;
                    messageContent += `- Weight: ${pokemon.weight} hectograms\n\n`;
                });

                await Bloom.sendMessage(message.key.remoteJid, { text: messageContent }, { quoted: message });
            } catch (error) {
                console.error('Error in pokedex function:', error);
                await Bloom.sendMessage(message.key.remoteJid, { text: "Oops! Something went wrong while fetching your Pokémon. Please try again later." }, { quoted: message });
            }
        }
    },
    pokedex: {
        type: 'game',
        desc: 'View any Pokémon details by name or ID',
        usage: 'pokedex <pokemon_name> or <ID>',
        run: async (Bloom, message, fulltext) => {
            const input = fulltext.trim().split(/\s+/)[1]?.toLowerCase();
            const chatId = message.key.remoteJid;

            if (!input) {
                await Bloom.sendMessage(chatId, { text: "Please provide a Pokémon name or ID to search for." }, { quoted: message });
                return;
            }

            try {
                const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${input}`);
                if (!res.ok) {
                    await Bloom.sendMessage(chatId, { text: `❌ Pokémon "${input}" does not exist.` }, { quoted: message });
                    return;
                }

                const pokemon = await res.json();
                // Get description from species endpoint
                const speciesRes = await fetch(pokemon.species.url);
                const speciesData = await speciesRes.json();

                const flavorEntry = speciesData.flavor_text_entries.find(entry => entry.language.name === 'en');
                const pokemonDescription = flavorEntry?.flavor_text || "No description available.";
                const cleanedDescription = pokemonDescription.replace(/\f/g, ' ').replace(/\n/g, ' ');

                const msg = `*${pokemon.name.toUpperCase()}*\n` +
                `Height: ${pokemon.height} decimeters\n` +
                `Weight: ${pokemon.weight} hectograms\n` +
                `Description: ${cleanedDescription}`;

                await Bloom.sendMessage(chatId, { text: msg }, { quoted: message });

            } catch (error) {
                console.error('Error in pokedex lookup:', error);
                await Bloom.sendMessage(chatId, { text: "⚠️ An error occurred while fetching Pokémon data. Please try again later." }, { quoted: message });
            }
        }
    }, 
    

    ttt: {
    type: 'game',
    desc: 'Tic Tac Toe game (human vs human OR human vs AI)',
    usage: `🎮 *TIC TAC TOE HELP* 🎮
    *Commands*:
    ➼ \`!ttt\` - Create 2-player game (❌)
    ➼ \`!ttt ai\` - Start vs Luna AI (🤖)
    ➼ \`!ttt join\` - Join 2-player game (⭕) 
    ➼ \`!ttt end\` - End game
    ➼ \`1-9\` - Make move (during game)

    *Rules*:
    1. ❌ always goes first
    2. Win by 3 in a row
    3. 5-min timeout for waiting games`,
    run: async (Bloom, message, fulltext) => {
        try {
            const sender = message.key.participant || message.key.remoteJid;
            const groupId = message.key.remoteJid;
            const args = fulltext.trim().split(' ').slice(1);

            if (!groupId.endsWith('@g.us')) {
                return await Bloom.sendMessage(groupId, {
                    text: '❌ Only works in group chats.'
                });
            }

            // !ttt ai - Human vs AI mode
            if (args[0] === 'ai') {
                const existingGame = await TicTacToe.findOne({
                    groupId,
                    $or: [{ 'player1.jid': sender }, { 'player2.jid': sender }],
                    status: { $ne: 'ended' }
                });

                if (existingGame) {
                    return await Bloom.sendMessage(groupId, { 
                        text: '❌ Finish your current game first!' 
                    });
                }

                const roomId = uuidv4().split('-')[0];
                const game = new TicTacToe({
                    roomId, groupId,
                    player1: { jid: sender, symbol: '❌' },  // Human
                    player2: { jid: 'luna_ai', symbol: '⭕' }, // AI
                    currentTurn: sender, 
                    board: Array(9).fill(' '), 
                    status: 'active',  // AI game starts immediately
                    isAI: true
                });

                await game.save();
                
                const board = renderBoard(game.board);
                return await Bloom.sendMessage(groupId, {
                    text: `🤖 *Luna AI Tic Tac Toe!*\n\n` +
                        `❌: @${sender.split('@')[0]} (Human)\n` +
                        `⭕: Luna AI\n\n${board}\n\n` +
                        `🎯 Your turn first! Reply with 1-9`,
                    mentions: [sender]
                });
            }

            // Original 2-player logic (no change)
            if (!args[0]) {
                const res = await createGame(sender, groupId);
                if (res.error) return await Bloom.sendMessage(groupId, { text: res.error });
                
                return await Bloom.sendMessage(groupId, {
                    text: `🎮 Game created!\n\n👤 @${sender.split('@')[0]} (❌)\n` +
                        `Type *ttt join* for Player 2\nGame ID: ${res.roomId}`,
                    mentions: [sender]
                });
            }

            if (args[0] === 'join') {
                const res = await joinGame(sender, groupId);
                if (res.error) return await Bloom.sendMessage(groupId, { text: res.error });
                
                const board = renderBoard(res.board);
                return await Bloom.sendMessage(groupId, {
                    text: `✅ Game started!\n\n❌: @${res.player1.jid.split('@')[0]}\n` +
                        `⭕: @${res.player2.jid.split('@')[0]}\n\n${board}\n\n` +
                        `▶️ @${res.player1.jid.split('@')[0]}'s turn (❌)`,
                    mentions: [res.player1.jid, res.player2.jid]
                });
            }

            if (args[0] === 'end') {
                const res = await endGame(sender);
                if (res.error) return await Bloom.sendMessage(groupId, { text: res.error });
                return await Bloom.sendMessage(groupId, {
                    text: `✅ Game ended by @${sender.split('@')[0]}`,
                    mentions: [sender]
                });
            }

        } catch (err) {
            console.error('TTT Error:', err);
            await Bloom.sendMessage(groupId, { text: '⚠️ Game error occurred' });
        }
    }
},
    magic: {
    type: 'economy',
    desc: 'Use the mysterious magic wand',
    run: async (Bloom, message) => {
        const senderID = message.key.participant || message.key.remoteJid;
        const user = await User.findById(senderID);

        if (!user) return Bloom.sendMessage(message.key.remoteJid, { text: 'You are not registered in the economy. Please register first.\n\n!reg <username>' }, { quoted: message });
        const wandIndex = user.inventory.magic.findIndex(i => i.name === 'magic_wand');
        if (wandIndex === -1)
            return Bloom.sendMessage(message.key.remoteJid, { text: "❌ You need a *magic wand* to use magic! Buy one from the shop."}, { quoted: message });

        // CHECK: user has at least 1 item in every inventory category OR wallet >= 5000
        const inv = user.inventory;
        const hasAllCollateral = inv.mining.length > 0 &&
                                 inv.magic.length > 0 &&
                                 inv.fishing.length > 0 &&
                                 inv.healing.length > 0 &&
                                 inv.animals.length > 0 &&
                                 inv.stones.length > 0 &&
                                 inv.pokemons.length > 0;

        if (!hasAllCollateral && user.walletBalance < 5000) {
            return Bloom.sendMessage(message.key.remoteJid, { text: "❌ You need at least 1 item in each category OR 5000💰 in wallet to perform magic."}, { quoted: message });
        }

        const outcomes = [
            "catch_all_fish",
            "mine_many_stones",
            "win_lottery",
            "burn_zoo",
            "dry_lake",
            "kill_pokemons",
            "infect_pokemons",
            "delete_bank",
            "wipe_inventory",
            "nothing",
            "earn_magic_wand"
        ];

        const event = outcomes[Math.floor(Math.random() * outcomes.length)];
        let resultMsg = `🪄 You performed magic and... `;

        const walletFallback = 5000;

        // HELPER: Deduct collateral or wallet
        const deductCollateralOrWallet = (collateralType, count=1) => {
            let lost = 0;
            switch(collateralType){
                case "animals":
                    lost = Math.min(count, user.inventory.animals.length);
                    user.inventory.animals.splice(0, lost);
                    break;
                case "pokemons":
                    lost = Math.min(count, user.inventory.pokemons.length);
                    user.inventory.pokemons.splice(0, lost);
                    break;
                case "herbs":
                    const herbs = user.inventory.healing.filter(h => h.name === 'herb').length;
                    lost = Math.min(count, herbs);
                    user.inventory.healing = user.inventory.healing.filter(h => h.name !== 'herb');
                    break;
                default:
                    break;
            }
            if (lost === 0 && user.walletBalance >= walletFallback) {
                user.walletBalance -= walletFallback;
                lost = walletFallback;
                return `💰 Deducted ${walletFallback} from wallet!`;
            } else if(lost > 0) {
                return `❌ Lost ${lost} ${collateralType}!`;
            }
            return `⚠️ No collateral or wallet to deduct!`;
        };

        // --- EVENT HANDLER ---
        switch(event) {

            case "catch_all_fish":
                const aquatic = ['fish','frog','blowfish','tropical_fish','shark'];
                const fishCaught = [];
                for (let i = 0; i < 5; i++) {
                    const f = aquatic[Math.floor(Math.random() * aquatic.length)];
                    const value = Math.floor(Math.random() * 400) + 100;
                    user.inventory.animals.push({ name: f, value });
                    fishCaught.push(`${f} (${value}💰)`);
                }
                resultMsg += `🎣 you caught ALL fish in the lake!\nReward:\n${fishCaught.join("\n")}`;
                break;

            case "mine_many_stones":
                const stoneTypes = ['coal','iron','diamond','gold'];
                let stoneList = [];
                for (let i = 0; i < 4; i++) {
                    const s = stoneTypes[Math.floor(Math.random() * stoneTypes.length)];
                    const value = Math.floor(Math.random() * 200) + 50;
                    user.inventory.stones.push({ name: s, value });
                    stoneList.push(`${s} (${value}💰)`);
                }
                resultMsg += `⛏️ you mined tons of stones!\nReward:\n${stoneList.join("\n")}`;
                break;

            case "win_lottery":
                const prize = Math.floor(Math.random() * 50000) + 10000;
                user.walletBalance += prize;
                resultMsg += `💰 YOU WON THE LOTTERY!!!\nReward: +${prize}💰`;
                break;

            case "burn_zoo":
                resultMsg += deductCollateralOrWallet("animals");
                break;

            case "dry_lake":
                const removedAquatic = user.inventory.animals.filter(a => ['fish','frog','blowfish','tropical_fish','shark','whale'].includes(a.name)).length;
                resultMsg += deductCollateralOrWallet("animals", removedAquatic);
                break;

            case "kill_pokemons":
                resultMsg += deductCollateralOrWallet("pokemons");
                break;

            case "infect_pokemons":
                resultMsg += deductCollateralOrWallet("herbs");
                break;

            case "delete_bank":
                if(user.walletBalance >= walletFallback){
                    user.walletBalance -= walletFallback;
                    resultMsg += `💰 Deducted ${walletFallback} from wallet!`;
                } else {
                    user.walletBalance = 0;
                    resultMsg += `🏦 Your bank and wallet were emptied!`;
                }
                break;

            case "wipe_inventory":
                user.inventory = { mining: [], magic: [], fishing: [], healing: [], animals: [], stones: [], pokemons: [] };
                resultMsg += `💨 Your entire inventory was wiped!`;
                break;

            case "earn_magic_wand":
                user.inventory.magic.push({ name: 'magic_wand', miningUses: 0 });
                resultMsg += `🪄 Your wand duplicated! You earned another magic wand.`;
                break;

            case "nothing":
            default:
                resultMsg += `...nothing happened 💀`;
                break;
        }

        // Remove the used magic wand (always)
        user.inventory.magic.splice(wandIndex, 1);

        await user.save();
        return Bloom.sendMessage(message.key.remoteJid, { text: resultMsg }, { quoted: message });
    }
}
};


// 👇 Auto-start function — NOT exported above
async function startGame(Bloom) {
    const allowed = await get('POKEMON');
    if (allowed !== 'true') {
        console.log('⚠️ Pokémon game is disabled. Set POKEMON true to enable.');
        return;
    }
    console.log('✅ Pokémon game started!');
    const interval1 = setInterval(() => loadPokemons(Bloom), 30 * 60 * 1000);
    const interval2 = setInterval(() => handleExpiredPokemons(Bloom), 30 * 60 * 1000);

    return () => {
        clearInterval(interval1);
        clearInterval(interval2);
        console.log('🛑 Pokémon game stopped.');
    };
}

// ✅ Export only this separately
module.exports._autoStartGame = startGame;

async function loadPokemons(Bloom) {
    let randomPokemon;

    try {
        randomPokemon = await pokemon();
    } catch (error) {
        console.error("❌ Error fetching Pokémon:", error.message);
        return;
    }

    if (!randomPokemon || !randomPokemon.name) {
        console.error("❌ No Pokémon returned. Likely null or malformed response.");
        return;
    }

    const newPokemon = new Pokemon({
        name: randomPokemon.name,
        image: randomPokemon.image,
        height: randomPokemon.height,
        weight: randomPokemon.weight,
        description: randomPokemon.description,
        timeout: new Date(Date.now() + 10 * 60 * 1000)
    });

    await newPokemon.save();
    console.log(`✅ Pokémon ${newPokemon.name} added to the database.`);
    const openchat = await get('OPENCHAT');
    await Bloom.sendMessage(openchat, {
        image: { url: newPokemon.image },
        caption: `A new Pokémon has appeared! Use *!catch ${newPokemon.name}* to add it to your inventory.\n\nClue: ${newPokemon.description}`
    });
}


async function handleExpiredPokemons(Bloom) {
    const expiredPokemons = await Pokemon.find({ timeout: { $lt: new Date() } });

    if (expiredPokemons.length > 0) {
        for (const pokemon of expiredPokemons) {
            const gamechat = await get('OPENCHAT');
            await Bloom.sendMessage(gamechat, {
                text: `No one claimed the Pokémon ${pokemon.name}. It has expired.\n\nDescription: ${pokemon.description}\nHeight: ${pokemon.height}\t\t\tWeight: ${pokemon.weight}`
            });

            await Pokemon.deleteOne({ _id: pokemon._id });
            console.log(`Expired Pokémon ${pokemon.name} has been removed from the database.`);
        }
    } else {
        console.log('No expired Pokémon found.');
    }
}


async function convertPhoneNumberToJID(value) {
    return `${value}@s.whatsapp.net`;
}

function generateRandomName() {
    const randomIndex = Math.floor(Math.random() * pokemonNames.length);
    return pokemonNames[randomIndex];
}

function isValidName(name) {
    const regex = /^[A-Za-z]{4,}$/;
    return regex.test(name);
}

function calculateTransactionFee(arg) {
    let feePercentage = 0.02;
    if (arg <= 1000) feePercentage = 0.05;
    else if (arg <= 10000) feePercentage = 0.03;
    return arg * feePercentage;
}