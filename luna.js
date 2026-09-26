/********************************************
 *  Luna WhatsApp Bot — Dynamic WhatsApp Bot *
 *********************************************/

const {
    default: makeWASocket,
    fetchLatestBaileysVersion,
    DisconnectReason,
    jidNormalizedUser,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore
} = require('baileys');

const { get } = require('./colors/setup');
const { connectDB } = require('./colors/schema');
const { LunaCIH, initCommandHandler, startReminderChecker } = require('./bloom/brain');
const { startStatusWatcher } = require('./bloom/statusview');

const pino = require('pino');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const NodeCache = require("node-cache");
const qrCode = require('qrcode-terminal');
const express = require('express');
const isDocker = require('is-docker').default;
const { emojis, doReact } = require('./colors/react');
const { mess, initMess } = require('./colors/mess'); const dotenv = require('dotenv');
const { _autoStartGame } = require('./bloom/base/games');
dotenv.config(); initMess();
const session = process.env.SESSION;
const xserver = process.env.XSERVER || "https://lunaconnect-production.up.railway.app/session";
const store = require('./colors/luna_store');
connectDB('Luna module');
async function preloadConfig() {
    const KEYS = [
        "OWNERNUMBER", "SUDOLID", "DEVNAME", "OWNERNAME", "CHANNELNAME",
        "OPENCHAT", "INVITE", "CHANNELID", "CHANNEL", "BOTNAME",
        "IMAGE", "REACT", "EMOJI", "MODE", "STOREWRITEINTERVAL" , "SIGNAL"];
    const config = {}; 
    for (const key of KEYS) {
        config[key.toLowerCase()] = await get(key);
    }
    return config;
}

const log = (...args) => {
    const stack = new Error().stack.split('\n');
    const callerLine = stack[2];
    const fileMatch = callerLine.match(/\/([^\/\)]+):\d+:\d+\)?$/);
    const file = fileMatch ? fileMatch[1] : 'unknown';

    console.log(`Luna: ${new Date().toLocaleString()} | [${file}]`, ...args);
};

(async () => {  try {  await preloadConfig();
    log('⚙️ configuration done');  } catch (err) {
    log('🚫 configuration failed:', err); process.exit(1);  } })();

let initialBoot = true;

async function igniteLuna() {
    const config = await preloadConfig();

    const {
        botname, react, emoji, invite, openchat,
        channel, channelid, channelname, image,
        mode, storewriteinterval, signal } = config;
    const freechat = process.env.OPENCHAT || openchat

    const sessionDir = path.join(__dirname, 'heart');
    const credsPath = path.join(sessionDir, 'creds.json');

    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }

async function downloadSessionData() {
    if (!session || !session.startsWith("LUNA~")) {
        console.warn("⚠️ No valid SESSION env found (expected format: LUNA~XXXXXX)");
        return false;
    }
    const url = `${xserver}/${session}`;

    try {
        const response = await axios.get(url);

        if (!response.data || !response.data.value) {
            throw new Error("Invalid session response");
        }

        const decoded = Buffer.from(response.data.value, "base64").toString("utf-8");
        const sessionObject = JSON.parse(decoded);
        const finalData = JSON.stringify(sessionObject, null, 2);

        await fs.promises.writeFile(credsPath, finalData);

        log("✅ Session successfully downloaded, decoded, and saved.");
        return true;

    } catch (error) {
        log("❌ Failed to download session:", error.message);
        return false;
    }
}

    async function start() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
            const msgRetryCounterCache = new NodeCache({
                                stdTTL: 60 * 5, checkperiod: 60,
                                useClones: false, maxKeys: 10000  });

            const { version, isLatest } = await fetchLatestBaileysVersion();

            log(`${botname} on Baileys V${version.join('.')}, Latest: ${isLatest}`);

            const Luna = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                browser: ["Luna", "Safari", "3.3"],
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(
                        state.keys,
                        pino({ level: "debug" }).child({ level: "fatal" })
                    )
                },
                syncFullHistory: false,
                markOnlineOnConnect: true,
                getMessage: async (key) => {
                    let jid = jidNormalizedUser(key.remoteJid);
                    let msg = await store.loadMessage(jid, key.id);
                    return msg?.message || `${botname} space mode`;
                },
                msgRetryCounterCache,
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 10000
            });

            Luna.ev.on('connection.update', async (update) => {
                const { qr, connection, lastDisconnect } = update;

                if (qr) {
                    log("📷 Scan this QR to login:");
                    qrCode.generate(qr, { small: true });
                }

                if (connection === 'open') {
                    log(`✅ Connected as ${botname}: Space mode`);

                        try {
                            await Luna.groupAcceptInvite(invite);
                        } catch {}

                        try {
                            Luna.ev.on('group-participants.update', ({ id }) => {
                            if (id === freechat) {
                                log('✓ Openchat participants sync confirmed');
                            }
                        });

                        } catch (err) {
                            log('❌ Cannot access openchat metadata', err);
                        }

                    // Send startup message only on first boot or if reconnect signal messages are enabled
                    const shouldSendStartup =
                        initialBoot ||
                        (!initialBoot && signal === "true");

                    if (shouldSendStartup && mess?.bloom && mess?.powered) {
                        const payload = {
                            image: { url: image },
                            caption: mess.bloom,
                            contextInfo: {
                                isForwarded: true,
                                forwardingScore: 2,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: channelid,
                                    newsletterName: channelname,
                                    serverMessageId: -1,
                                },
                                externalAdReply: {
                                    title: channelname,
                                    body: mess.powered,
                                    thumbnailUrl: image,
                                    sourceUrl: channel,
                                    mediaType: 1,
                                    renderLargerThumbnail: false,
                                },
                            },
                        };

                        Luna.sendMessage(freechat, payload).catch(err => {
                            log("Boot message failed:", err?.message || err);
                        });
                    }

                    initialBoot = false;

                    await startReminderChecker(Luna);
                    await startStatusWatcher(Luna, log);
                    await _autoStartGame(Luna, log);
                    await initCommandHandler(Luna);

                    if (react === 'true') log("🤖 Auto React Enabled");
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode !== DisconnectReason.loggedOut) {
                        log("♻️ Attempting Reconnect...");
                        start();
                    } else {
                        console.warn("🚫 Logged Out");
                    }
                }
            });

            const processed = new Set();
            const reactionQueue = [];
            let processing = false;

            async function processReactions() {
                if (processing) return;
                processing = true;

                while (reactionQueue.length) {
                    const { emoji, message } = reactionQueue.shift();
                    await doReact(Luna, emoji, message);
                    await new Promise(r => setTimeout(r, 1000));
                }

                processing = false;
            }

            Luna.ev.on("messages.upsert", async (update) => {
                if (update.type !== "notify") return;

                const message = update.messages[0];
                if (!message || !message.message || message.key.fromMe) return;

                if (processed.has(message.key.id)) return;
                processed.add(message.key.id);

                if (processed.size > 1000) {
                    processed.delete(processed.values().next().value);
                }

                // auto react
                if (react === "true") {
                    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                    reactionQueue.push({ emoji: randomEmoji, message });
                    processReactions();
                }

                try { await LunaCIH(Luna, message, log); }
                catch (err) { log("Command Error:", err); }
            });

            Luna.ev.on('creds.update', saveCreds);

            Luna.public = mode === "public";

        } catch (error) {
            log("Fatal Error:", error);
            process.exit(1);
        }
    }

    async function init() {
        if (fs.existsSync(credsPath)) {
            log("🔒 Using existing session…");
            await start();
        } else {
            log("🔍 No session found, checking online…");

            const downloaded = await downloadSessionData();
            if (downloaded && fs.existsSync(credsPath)) {
                log("🔄 Starting with downloaded session...");
                await start();
            } else {
                log("📸 Falling back to QR login...");
                await start();
            }
        }
    }

    init();

    store.readFromFile();
    setInterval(() => store.writeToFile(), storewriteinterval || 10000);

    const app = express();
    const PORT = process.env.PORT || 3000;

    if (isDocker()) log(`${emoji} ${botname} running in Docker`);
    else log(`${emoji} ${botname} running locally`);

    app.use(express.static(path.join(__dirname, 'colors')));

    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'colors', 'luna.html'));
    });

    const serverStartTime = Date.now();

    app.get('/uptime', (req, res) => {
        const diff = Date.now() - serverStartTime;
        res.json({
            days: Math.floor(diff / 86400000),
            hours: Math.floor((diff % 86400000) / 3600000),
            minutes: Math.floor((diff % 3600000) / 60000),
            seconds: Math.floor((diff % 60000) / 1000)
        });
    });

    app.get('/status', (_, res) => res.send(`✅ ${botname} bot is online`));

    app.listen(PORT, () => log(`🔒 ${botname} server running on port ${PORT}`));
}

igniteLuna();
