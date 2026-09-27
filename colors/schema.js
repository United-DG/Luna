const mongoose = require('mongoose');
const pokemonSchema = new mongoose.Schema({
    name: { type: String, required: true },
    weight: { type: Number, required: true },
    height: { type: Number, required: true },
    image: { type: String, required: true },
    description: { type: String, required: true },
    timeout: { type: Date, required: true },
});

const userSchema = new mongoose.Schema({
    _id: { type: String },
    name: { type: String, required: true },
    walletBalance: { type: Number, default: 0 },
    bankBalance: { type: Number, default: 0 },
    inventory: {
        mining: [{
            name: { type: String, required: true },
            miningUses: { type: Number, default: 0 },
        }],
        magic: [{
            name: { type: String, required: true },
            miningUses: { type: Number, default: 0 },
        }],
        fishing: [{
            name: { type: String, required: true },
            miningUses: { type: Number, default: 0 },
        }],
        healing: [{
            name: { type: String, required: true },
            miningUses: { type: Number, default: 0 },
        }],
        animals: [{
            name: { type: String, required: true },
            value: { type: Number, required: true },
        }],
        stones: [{
            name: { type: String, required: true },
            value: { type: Number, required: true },
        }],
        pokemons: [{
            name: { type: String, required: true },
            height: { type: Number, required: true },
            weight: { type: Number, require: true },
            image: { type: String, required: true },
            description: { type: String, required: true },
        }],
    },
    transactionHistory: [{
        type: Object,
        arg: Number,
        item: String,
        result: String,
        transactionFee: { type: Number, default: 0 },
        animal: String,
        date: { type: Date, default: Date.now },
    }],
    lastDailyClaim: { type: Date, default: Date.now },
    lastZooCatch: { type: Date, default: Date.now },
    lastGamble: { type: Date, default: Date.now },
    lastWork: { type: Date, default: Date.now },
    lastFishCatch: { type: Date, default: Date.now },
});

const expSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    points: { type: Number, default: 0 },
    lastDaily: Date,
    streak: { type: Number, default: 0 },
    messageCount: { type: Number, default: 0 },
    isBanned: { type: Boolean, default: false},
}, { timestamps: true });

const settingsSchema = new mongoose.Schema({
    group: { type: String, required: true, unique: true },
    antiLink: { type: Boolean, default: false },
    noImage: { type: Boolean, default: false },
    gameEnabled: { type: Boolean, default: true },
    nsfwEnabled: { type: Boolean, default: false },
    commandsEnabled: { type: Boolean, default: true },
    warns: { type: Map, of: Number, default: {} }
});


const userCounterSchema = new mongoose.Schema({
    user: { type: String, required: true, unique: true },
    count: { type: Number, default: 1 },
    lastUpdated: { type: Date, default: Date.now }
});

const afkSchema = new mongoose.Schema({
    user: { type: String, required: true, unique: true }, // WhatsApp JID
    reason: { type: String, default: '' },
    since: { type: Date, default: Date.now }
});


const TicTacToeSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    groupId: { type: String },
    player1: {
        jid: { type: String, required: true },
        name: { type: String }, // Add this
        symbol: { type: String, default: '❌' }
    },
   player2: {
        jid: { type: String, default: null },
        name: { type: String },
        symbol: { type: String, default: '⭕' }
    },
    board: { type: [String], default: [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '] },
    currentTurn: { type: String },
    status: { type: String, enum: ['waiting', 'active', 'ended'], default: 'waiting' },
    isAI: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    timeoutAt: { type: Date }
});
const reminderSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    chatId: { type: String, required: true },
    text: { type: String, required: true },
    remindAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
    reminded: { type: Boolean, default: false }
});

const settingSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // key name
  value: { type: String, required: true } // always string
}, { collection: 'setup', versionKey: false });

let isConnected = false;

async function connectDB(source = 'Unknown Module') {
    if (isConnected) {
        console.log(`✓ ${source}: Already connected to MongoDB`);
        return;
    }

    try {
        const mongo = process.env.MONGO
         if (!mongo) {
            throw new Error('MongoDB URI is missing (env MONGO or config store)');
        }
        await mongoose.connect(mongo, {
            serverSelectionTimeoutMS: 60000,
            socketTimeoutMS: 60000,
        });
        isConnected = true;
        console.log(`✓ ${source}: Connected to MongoDB`);
    } catch (err) {
        console.error(`❌ MongoDB Connection Error in ${source}: ${err.message}`);
        process.exit(0);
       // console.error(err.stack);
       // throw err;
    }
}

module.exports = { connectDB };


// ------------------ SCHEMAS & MODELS ------------------ //
const ticketSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true },
        issue: { type: String, required: true },
        user: { type: String, required: true },
        status: {
            type: String,
            default: 'open',
                enum: ['open', 'ongoing', 'resolved']
        },
    },
    { timestamps: true }
);

const counterSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    number: { type: Number, default: 0 },
    letter: { type: String, default: 'A' }
});


// ---- TICKET ID GENERATOR //
async function TicketId() {
    try {
        const counter = await Counter.findOneAndUpdate(
            { name: 'ticket' }, {},
            { upsert: true, new: true }
        );

        let { number, letter } = counter;
        const id = `BB-${number.toString().padStart(4, '0')}${letter}`;

        if (letter === 'Z') { letter = 'A'; number += 1;
        } else {
            letter = String.fromCharCode(letter.charCodeAt(0) + 1);
        }

        counter.number = number;
        counter.letter = letter;
        await counter.save();

        return id;
    } catch (err) {
        console.error('Error generating ticket ID:', err.message);
        throw err;
    }
}


const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);
const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);
const Reminder = mongoose.models.Reminder || mongoose.model('Reminder', reminderSchema);
const TicTacToe = mongoose.models.TicTacToe || mongoose.model('TicTacToe', TicTacToeSchema);
const AFK = mongoose.models.AFK || mongoose.model('AFK', afkSchema);
const Pokemon = mongoose.models.Pokemon || mongoose.model('Pokemon', pokemonSchema);
const UserCounter = mongoose.models.UserCounter || mongoose.model('UserCounter', userCounterSchema);
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema); // group
const Setting = mongoose.model('Setup', settingSchema); // bot
const Exp = mongoose.models.Exp || mongoose.model('Exp', expSchema);

module.exports = { Pokemon, UserCounter, User , Settings, Setting, Exp, AFK, TicTacToe, Reminder, Ticket, TicketId, connectDB };