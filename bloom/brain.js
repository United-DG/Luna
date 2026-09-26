/********************************************************************
 *  Luna Brain Module — Dynamic Commands & Mongo Configuration
 ********************************************************************/

const fs = require('fs');
const path = require('path');
const { mess, initMess } = require('../colors/mess');
const { get } = require('../colors/setup');
const { trackUsage } = require('../colors/exp');
const { isSenderAdmin, isBotAdmin, isBloomKing } = require('../colors/auth');
const { tttmove, startReminderChecker } = require('./ttthandle');
const { Settings, UserCounter, AFK } = require('../colors/schema');
initMess();

let commandRegistry = {};
let activeLunaInstance = null;
/* -----------------------------------------------------------
   0. CUSTOM LOGGER FOR BRAIN
----------------------------------------------------------- */
 const log = (...args) => {
    const stack = new Error().stack.split('\n');
    const callerLine = stack[2];
    const fileMatch = callerLine.match(/\/([^\/\)]+):\d+:\d+\)?$/);
    const file = fileMatch ? fileMatch[1] : 'unknown';

    console.log(`Luna: ${new Date().toLocaleString()} | [${file}]`, ...args);
};
/* -----------------------------------------------------------
   1. INIT COMMAND HANDLER
----------------------------------------------------------- */
async function initCommandHandler(Luna) {
    activeLunaInstance = Luna;
    commandRegistry = {};
    await loadCommands();
    log('♻️ Command handler initialized');
}

/* -----------------------------------------------------------
   2. COMMAND LOADER
----------------------------------------------------------- */
async function loadCommands() {
    try {
        const currentDir = __dirname;

        const subdirs = fs
            .readdirSync(currentDir)
            .filter(file => {
                try {
                    return fs.statSync(path.join(currentDir, file)).isDirectory();
                } catch {
                    return false;
                }
            });

        for (const dir of subdirs) {
            const files = fs.readdirSync(path.join(currentDir, dir));
            for (const file of files) {
                if (!file.endsWith('.js') || file.startsWith('_')) continue;

                try {
                    const modulePath = path.join(currentDir, dir, file);
                    delete require.cache[require.resolve(modulePath)];
                    const module = require(modulePath);

                    for (const [cmd, data] of Object.entries(module)) {
                        if (cmd.startsWith('_') || typeof data?.run !== 'function') continue;

                        const type = typeof data.type === 'string' ? data.type.toLowerCase() : '';
                        const description = typeof data.desc === 'string' ? data.desc : '';
                        const cooldown = typeof data.cooldown === 'number' ? data.cooldown : 0;

                        commandRegistry[cmd] = { run: data.run, type, desc: description, cooldown };
                        log(`✅ Loaded command: ${cmd} from ${dir}/${file}`);
                    }
                } catch (err) { log(err);}
            }
        }

        log(`📦 Total loaded commands: ${Object.keys(commandRegistry).length}`);
    } catch (err) {log(err);}
}

/* -----------------------------------------------------------
   3. LUNA COMMAND EXECUTION HANDLER
----------------------------------------------------------- */
async function LunaCEH(Luna, message, fulltext, commands) {
    const commandName = fulltext.split(' ')[0].toLowerCase();
    const commandModule = commands[commandName];
    if (!commandModule?.run) return;

    try {
        await commandModule.run(Luna, message, fulltext, commands);
    } catch (err) {
        log(`❌ Fatal error: Command "${commandName}" failed:`, err);
        await Luna.sendMessage(message.key.remoteJid, {
            text: '❗ An error occurred while executing the command.'
        });
    }
}

/* -----------------------------------------------------------
   4. HOT RELOAD — FIXED (NO TOP-LEVEL AWAIT)
----------------------------------------------------------- */
async function setupHotReload() {
    const node = await get('NODE');
    if (node === 'production') return;

    const watchedDirs = fs
        .readdirSync(__dirname)
        .filter(file => {
            try {
                return (
                    fs.statSync(path.join(__dirname, file)).isDirectory() &&
                    !file.startsWith('_') &&
                    file !== 'colors'
                );
            } catch {
                return false;
            }
        });

    watchedDirs.forEach(dir => {
        const dirPath = path.join(__dirname, dir);
        const reloadQueue = new Set();
        fs.watch(dirPath, { recursive: false }, (event, filename) => {
            if (!filename?.endsWith('.js')) return;
            reloadQueue.add(path.join(dirPath, filename));
            setTimeout(async () => {
                for (const file of reloadQueue) await reloadFile(file);
                reloadQueue.clear();
            }, 100);
        });
    });

    fs.watch(__dirname, { recursive: false }, (event, filename) => {
        if (
            filename?.endsWith('.js') &&
            filename !== 'brain.js' &&
            !filename.startsWith('_')
        ) {
            reloadFile(path.join(__dirname, filename));
        }
    });

   async function reloadFile(filePath) {
    try {
        delete require.cache[require.resolve(filePath)];
        const mod = require(filePath);
        if (filePath.endsWith('colors/mess.js')) {
            if (mod.reload) await mod.reload();
            return;
        }
        if (!filePath.includes('colors')) await loadCommands();
    } catch (err) { log(err);}
}
}

/* -----------------------------------------------------------
   5. MAIN Luna Command Input hanlder
----------------------------------------------------------- */
const LunaCIH = async (Luna, message) => {
    try {
        if (!Luna || !message?.key) return false;

        if (!activeLunaInstance) await initCommandHandler(Luna);

        if (message.key.remoteJid === 'status@broadcast') return false;

        const { command, fulltext } = extractCommand(message);
        if (!command || command.trim() === "") { return false; }
        if (/^[1-9]$/.test(command)) {
            await tttmove(Luna, message, fulltext);
            return true;
        }

        const checks = [
            async () => (await trackUsage(Luna, message)).shouldProceed,
            async () => checkMode(Luna, message),
            async () => checkGroupCommandLock(Luna, message),
            async () => checkMessageType(Luna, message),
            async () => checkCommandTypeFlags(Luna, message),
            async () => checkAFK(Luna, message),
        ];

        for (const check of checks) {
            if (!(await check())) return false;
        }

        if (commandRegistry[command]) {
            await LunaCEH(Luna, message, fulltext, commandRegistry);
        }

        return true;
    } catch {
        return false;
    }
};

/* -----------------------------------------------------------
   6. UTILITY FUNCTIONS
----------------------------------------------------------- */
function extractTextFromMessage(msg) {
    if (!msg) return '';
    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.ephemeralMessage) return extractTextFromMessage(msg.ephemeralMessage.message);
    if (msg.viewOnceMessage) return extractTextFromMessage(msg.viewOnceMessage.message);
    return '';
}

function extractCommand(message) {
    try {
        const text = extractTextFromMessage(message.message);
        const fulltext = text.trim().replace(/^\s*!/, '').replace(/\s+/g, ' ');
        const command = fulltext.split(' ')[0]?.toLowerCase() || '';
        return { command, fulltext };
    } catch {
        return { command: '', fulltext: '' };
    }
}

/* -----------------------------------------------------------
   7. MODE CHECK
----------------------------------------------------------- */
async function checkMode(Luna, message) {
    try {
        const mode = await get('MODE');
        const sender = message.key.participant || message.key.remoteJid;

        const { command } = extractCommand(message);
        const isGroup = message.key.remoteJid.endsWith('@g.us');

        if (!commandRegistry[command]) return true;

        if (mode === 'public') return true;

        if (mode === 'private' && !(await isBloomKing(sender,message))) {
            let user = await UserCounter.findOne({ user: sender }) ||  await UserCounter.create({ user: sender, count: 0 });

            user.count++;

            if (user.count >= 3) {
                await Luna.sendMessage(sender, { text: mess.blocked });
                await Luna.updateBlockStatus(sender, 'block');
                return false;
            }

            await user.save();
            await Luna.sendMessage(sender, { text: mess.privateMode });
            return false;
        }

        if (mode === 'group' && !isGroup && !(await isBloomKing(sender,message))) {
            await Luna.sendMessage(sender, { text: mess.groupOnly });
            return false;
        }

        return true;
    } catch {
        return true;
    }
}

/* -----------------------------------------------------------
   8. MESSAGE TYPE / ANTI-LINK / NO-IMAGE
----------------------------------------------------------- */
async function checkMessageType(Luna, message) {
    try {
        const groupId = message.key.remoteJid;
        if (!groupId.endsWith('@g.us')) return true;

        const sender = message.key.participant;
        const settings = await getGroupSettings(groupId);
        if (!settings) return true;

        const isAdmin = await isSenderAdmin(Luna, message);
        const botAdmin = await isBotAdmin(Luna, message);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';

        const messageType = Object.keys(message.message)[0];

        // Anti-Link
        if (settings.antiLink && !isAdmin) {
            const hasLink = /https?:\/\/|www\./gi.test(text);
            if (hasLink) {
                if (botAdmin) {
                    await Luna.groupParticipantsUpdate(groupId, [sender], 'remove');
                }
                return false;
            }
        }

        // No-Image
        if (settings.noImage && messageType === 'imageMessage' && !isAdmin) {
            settings.warns = new Map(Object.entries(settings.warns || {}));

            const safeSender = sender.replace(/\./g, '(dot)');
            const newWarn = (settings.warns.get(safeSender) || 0) + 1;

            settings.warns.set(safeSender, newWarn);

            if (newWarn >= 3) {
                if (botAdmin) {
                    await Luna.groupParticipantsUpdate(groupId, [sender], 'remove');
                }
                settings.warns.delete(safeSender);
                await settings.save();
                return false;
            }

            await Luna.sendMessage(groupId, {
                text: `⚠️ @${sender.split('@')[0]}, no images allowed! Warning ${newWarn}/3.`,
                mentions: [sender]
            });

            await settings.save();
        }

        return true;
    } catch {
        return true;
    }
}

/* -----------------------------------------------------------
   9. COMMAND TYPE FLAGS (GAME / NSFW)
----------------------------------------------------------- */
async function checkCommandTypeFlags(Luna, message) {
    try {
        const groupId = message.key.remoteJid;
        if (!groupId.endsWith('@g.us')) return true;

        const { command } = extractCommand(message);
        const data = commandRegistry[command];
        if (!data) return true;

        const settings = await getGroupSettings(groupId);

        if (!settings) return true;
        const type = data.type?.toLowerCase() || '';
        const gameEnabled = !!settings?.gameEnabled;
        const nsfwEnabled = !!settings?.nsfwEnabled;

        if (['game', 'economy'].includes(type) && !gameEnabled) {
            await Luna.sendMessage(groupId, { text: mess.games });
            return false;
        }

        if (type === 'nsfw' && !nsfwEnabled) {
            await Luna.sendMessage(groupId, { text: mess.nsfwoff });
            return false;
        }


        return true;
    } catch {
        return true;
    }
}

/* -----------------------------------------------------------
   10. COMMAND LOCK
----------------------------------------------------------- */
async function checkGroupCommandLock(message) {
    try {
        const groupId = message.key.remoteJid;
        if (!groupId.endsWith('@g.us')) return true;

        const { command } = extractCommand(message);

        const settings = await getGroupSettings(groupId);
        if (!settings) return true;

        if (!settings.commandsEnabled && command !== 'cmds') {
            return false;
        }

        return true;
    } catch {
        return true;
    }
}

/* -----------------------------------------------------------
   11. AFK CHECK
----------------------------------------------------------- */
async function checkAFK(Luna, message) {
    try {
        const participant =
            message.message?.extendedTextMessage?.contextInfo?.participant;

        if (!participant) return true;

        const afk = await AFK.findOne({ user: participant });

        if (afk) {
            await Luna.sendMessage(message.key.remoteJid, {
                text: `💤 That user is AFK: ${afk.reason || 'No reason'}`,
                mentions: [participant]
            });
            return false;
        }

        return true;
    } catch {
        return true;
    }
}

/* -----------------------------------------------------------
   12. HOT RELOAD STARTER
----------------------------------------------------------- */
(async () => {
    const node = await get('NODE');
    if (node !== 'production') setupHotReload();
})();
/* -----------------------------------------------------------
   x. HELLPER COMMANDS
----------------------------------------------------------- */
async function getGroupSettings(groupId) {
    const settings = await Settings.findOne({ group: groupId });
    return settings || {}; }
/* -----------------------------------------------------------
   EXPORTS
----------------------------------------------------------- */
module.exports = { LunaCIH, initCommandHandler, commands: commandRegistry, startReminderChecker };
