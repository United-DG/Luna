const { Exp } = require('./schema');
const { RedisClient } = require("./redis");
const { get } = require('./setup');

const WARNING_LIMIT = 6;
const TEMPBAN_LIMIT = 9;
const KICK_LIMIT = 12;
const TEMPBAN_TIME = 60 * 5; // 5 minutes
const REDIS_TIMEOUT = 1000; // Don't let Redis block commands for more than 1 second

let redis;
let redisDisabled = false;

// Initialize Redis, but never make it mandatory
async function initRedis() {
    if (redis || redisDisabled) return;

    try {
        const redisurl = process.env.REDIS || await get('REDIS');

        redis = new RedisClient(redisurl);

        console.log("[trackUsage] Redis initialized");
    } catch (e) {
        redis = null;
        redisDisabled = true;
        console.warn("[trackUsage] Redis unavailable - continuing without Redis");
    }
}

// Run a Redis operation without allowing it to block command processing
async function redisCall(fn) {
    if (!redis || redisDisabled) return null;

    try {
        const result = await Promise.race([
            fn(redis),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Redis operation timeout")), REDIS_TIMEOUT)
            )
        ]);

        return result;
    } catch (e) {
        console.warn("[trackUsage] Redis unavailable - disabling Redis for this process");
        redis = null;
        redisDisabled = true;
        return null;
    }
}

async function trackUsage(Luna, message) {
    // Try Redis, but failure must never stop the command
    if (!redis && !redisDisabled) {
        await initRedis();
    }

    const jid = message.key?.participant || message.key?.remoteJid;
    const sender = message.key?.remoteJid;

    if (!jid) return { shouldProceed: false };

    // If Redis isn't available, completely bypass rate limiting
    if (!redis) {
        return {
            shouldProceed: true,
            action: "redis_unavailable"
        };
    }

    const keyCount = `msgcount:${jid}`;
    const keyStrike = `strikes:${jid}`;
    const keyBan = `tempban:${jid}`;

    // Check temporary ban
    const isBanned = await redisCall(r => r.ttl(keyBan));

    // Redis failed → let command continue
    if (isBanned === null) {
        return {
            shouldProceed: true,
            action: "redis_unavailable"
        };
    }

    if (isBanned > 0) {
        await Luna.sendMessage(sender, {
            text: `⛔ You are temporarily banned. Try again in ${isBanned} seconds.`
        }, { quoted: message });

        return {
            shouldProceed: false,
            action: "still_banned",
            timeLeft: isBanned
        };
    }

    // Count messages
    const count = await redisCall(r => r.incr(keyCount));

    // Redis failed → let command continue
    if (count === null) {
        return {
            shouldProceed: true,
            action: "redis_unavailable"
        };
    }

    if (count === 1) {
        await redisCall(r => r.expire(keyCount, 60));
    }

    // Permanent-ban logic
    if (count > KICK_LIMIT) {
        const strikes = await redisCall(r => r.incr(keyStrike));

        if (strikes === null) {
            return {
                shouldProceed: true,
                action: "redis_unavailable"
            };
        }

        if (strikes >= 3) {
            await Exp.findOneAndUpdate(
                { jid },
                { isBanned: true },
                { upsert: true }
            );

            await Luna.updateBlockStatus(jid, "block");

            await Luna.sendMessage(sender, {
                text: "🚫 You have been permanently banned."
            }, { quoted: message });

            return {
                shouldProceed: false,
                action: "perm_ban"
            };
        }

        await redisCall(r =>
            r.set(keyBan, "1", { EX: 60 * 30 })
        );

        if (sender.endsWith("@g.us")) {
            await Luna.groupParticipantsUpdate(
                sender,
                [jid],
                'remove'
            );
        }

        await Luna.sendMessage(sender, {
            text: "⏳ You have been temporarily banned for 30 minutes."
        }, { quoted: message });

        return {
            shouldProceed: false,
            action: "30min_ban"
        };
    }

    // Temporary-ban logic
    if (count > TEMPBAN_LIMIT) {
        await redisCall(r =>
            r.set(keyBan, "1", { EX: TEMPBAN_TIME })
        );

        await redisCall(r =>
            r.incr(keyStrike)
        );

        await Luna.sendMessage(sender, {
            text: `⏳ You are temporarily banned for ${TEMPBAN_TIME / 60} minutes.`
        }, { quoted: message });

        return {
            shouldProceed: false,
            action: "temp_ban"
        };
    }

    // Warning
    if (count > WARNING_LIMIT) {
        await Luna.sendMessage(sender, {
            text: "⚠️ Warning: You are sending messages too fast!"
        }, { quoted: message });

        return {
            shouldProceed: true,
            action: "warning"
        };
    }

    // Normal usage tracking
    await Exp.findOneAndUpdate(
        { jid },
        { $inc: { points: 1, messageCount: 1 } },
        { upsert: true }
    );

    return {
        shouldProceed: true
    };
}

module.exports = {
    trackUsage,
    initRedis
};