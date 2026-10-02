const { isGroupAdminContext } = require('../../colors/auth');
const { mess } = require('../../colors/mess');
const { Settings } = require('../../colors/schema');

const toggles = {
    antilink: 'antiLink',
    noimage: 'noImage',
    game: 'gameEnabled',
    nsfw: 'nsfwEnabled',
    cmds: 'commandsEnabled'
};

module.exports = {
    add: {
        type: 'group',
        desc: 'Add a participant to the group',
        run: async (Bloom, message, fulltext) => {
            try {
                if (!await isGroupAdminContext(Bloom, message)) return;

                const arg = fulltext.split(' ')[1]?.replace(/[^0-9]/g, '');
                if (!arg || arg.length < 10) return await Bloom.sendMessage(message.key.remoteJid, { text: '❌ Invalid number format' });

                const jid = arg.includes('@') ? arg : `${arg}@s.whatsapp.net`;
                const groupJid = message.key.remoteJid;

                const [userCheck] = await Bloom.onWhatsApp(jid);
                if (!userCheck?.exists) return await Bloom.sendMessage(groupJid, { text: '❌ Number not on WhatsApp' });

                const metadata = await Bloom.groupMetadata(groupJid);
                if (metadata.participants.some(p => p.id === jid)) return await Bloom.sendMessage(groupJid, { text: '❌ Already in group' });
                // Detect LID-based group
                const isLidGroup = metadata.participants.some(p => p.id.endsWith('@lid'));
                if (isLidGroup) {
                    return await Bloom.sendMessage(groupJid, {
                        text: '❌ This group uses Linked Identity (LID), and adding users by number is not supported yet by this bot.'
                    });
                }

                const result = await Bloom.groupParticipantsUpdate(groupJid, [jid], 'add');

                if (result[0]?.status === 200) {
                    await Bloom.sendMessage(groupJid, { text: '✅ Added' });
                }
                else if (result[0]?.status === 403 && result[0]?.content?.content?.[0]?.tag === 'add_request') {
                    const inviteCode = result[0].content.content[0].attrs.code;
                    try {
                        await Bloom.sendMessage(jid, { text: `📨 Join link: https://chat.whatsapp.com/${inviteCode}` });
                        await Bloom.sendMessage(groupJid, { text: `📬 Invite sent to ${jid.split('@')[0]}` });
                    } catch {
                        await Bloom.sendMessage(groupJid, { text: `📨 Invite Link: https://chat.whatsapp.com/${inviteCode}` });
                    }
                }
                else if (result[0]?.status === 409) {
                    await Bloom.sendMessage(groupJid, { text: '❌ User already in group' });
                }
                else {
                    const inviteCode = await Bloom.groupInviteCode(groupJid);
                    await Bloom.sendMessage(groupJid, { text: `📨 Group link: https://chat.whatsapp.com/${inviteCode}` });
                }
            } catch (err) {
                await Bloom.sendMessage(message.key.remoteJid, { text: `❌ Error: ${err.message || 'Failed to add'}` });
            }
        }
    },
        kick: {
            type: 'group',
            desc: 'Remove a participant from the group',
            usage: 'kick @user',
            run: async (Bloom, message, fulltext) => {
                if (!await isGroupAdminContext(Bloom, message)) return;

                const arg = fulltext.split(' ')[1];
                let targetJid = arg ? `${arg.replace(/[^0-9]/g, '')}@s.whatsapp.net` :
                message.message?.extendedTextMessage?.contextInfo?.participant;
                if (!targetJid) return await Bloom.sendMessage(message.key.remoteJid, { text: '❌ Tag or provide a number' });

                const metadata = await Bloom.groupMetadata(message.key.remoteJid);
                const targetUser = metadata.participants.find(p => p.id === targetJid);

                if (!targetUser) return await Bloom.sendMessage(message.key.remoteJid, { text: '❌ User not found' });
                if (targetUser.admin === 'superadmin') return await Bloom.sendMessage(message.key.remoteJid, { text: '👑 Cannot remove group owner' });

                await Bloom.groupParticipantsUpdate(message.key.remoteJid, [targetJid], 'remove');
                await Bloom.sendMessage(message.key.remoteJid, {
                    text: `👢 Removed @${targetJid.split('@')[0]}`,
                                        mentions: [targetJid]
                });
            }
        },
        promote: {
            type: 'group',
            desc: 'Promote user to admin',
            usage: 'promote @user',
            run: async (Bloom, message, fulltext) => {
                if (!await isGroupAdminContext(Bloom, message)) return;

                const arg = fulltext.split(' ')[1];
                let targetJid = arg ? `${arg.replace(/[^0-9]/g, '')}@s.whatsapp.net` :
                message.message?.extendedTextMessage?.contextInfo?.participant;
                if (!targetJid) return await Bloom.sendMessage(message.key.remoteJid, { text: '❌ Tag or provide a number' });

                const metadata = await Bloom.groupMetadata(message.key.remoteJid);
                const targetUser = metadata.participants.find(p => p.id === targetJid);

                if (!targetUser) return await Bloom.sendMessage(message.key.remoteJid, { text: '❌ User not found' });
                if (targetUser.admin === 'admin') return await Bloom.sendMessage(message.key.remoteJid, { text: '❌ Already admin' });
                if (targetUser.admin === 'superadmin') return await Bloom.sendMessage(message.key.remoteJid, { text: '👑 Cannot modify owner' });

                await Bloom.groupParticipantsUpdate(message.key.remoteJid, [targetJid], 'promote');
                await Bloom.sendMessage(message.key.remoteJid, {
                    text: `⬆️ Promoted @${targetJid.split('@')[0]}`,
                                        mentions: [targetJid]
                });
            }
        },
        demote: {
            type: 'group',
            desc: 'Demote admin to member',
            usage: 'demote @user',
            run: async (Bloom, message, fulltext) => {
                if (!await isGroupAdminContext(Bloom, message)) return;

                const arg = fulltext.split(' ')[1];
                let targetJid = arg ? `${arg.replace(/[^0-9]/g, '')}@s.whatsapp.net` :
                message.message?.extendedTextMessage?.contextInfo?.participant;
                if (!targetJid) return await Bloom.sendMessage(message.key.remoteJid, { text: '❌ Tag or provide a number' });

                const metadata = await Bloom.groupMetadata(message.key.remoteJid);
                const targetUser = metadata.participants.find(p => p.id === targetJid);

                if (!targetUser) return await Bloom.sendMessage(message.key.remoteJid, { text: '❌ User not found' });
                if (!targetUser.admin) return await Bloom.sendMessage(message.key.remoteJid, { text: '❌ Not an admin' });
                if (targetUser.admin === 'superadmin') return await Bloom.sendMessage(message.key.remoteJid, { text: '👑 Cannot demote owner' });

                await Bloom.groupParticipantsUpdate(message.key.remoteJid, [targetJid], 'demote');
                await Bloom.sendMessage(message.key.remoteJid, {
                    text: `⬇️ Demoted @${targetJid.split('@')[0]}`,
                                        mentions: [targetJid]
                });
            }
        },
        open: {
            type: 'group',
            desc: 'Open group (anyone can send messages)',
            run: async (Bloom, message) => {
                if (!await isGroupAdminContext(Bloom, message)) return;
                const metadata = await Bloom.groupMetadata(message.key.remoteJid);
                if (metadata.announce === false) return await Bloom.sendMessage(message.key.remoteJid, { text: 'ℹ️ Group is already open' });
                await Bloom.groupSettingUpdate(message.key.remoteJid, 'not_announcement');
                await Bloom.sendMessage(message.key.remoteJid, { text: '🔓 Group is now open' });
            }
        },
        close: {
            type: 'group',
            desc: 'Close group (only admins can send)',
            run: async (Bloom, message) => {
                if (!await isGroupAdminContext(Bloom, message)) return;
                const metadata = await Bloom.groupMetadata(message.key.remoteJid);
                if (metadata.announce === true) return await Bloom.sendMessage(message.key.remoteJid, { text: 'ℹ️ Group is already closed' });
                await Bloom.groupSettingUpdate(message.key.remoteJid, 'announcement');
                await Bloom.sendMessage(message.key.remoteJid, { text: '🔒 Group is now closed' });
            }
        },
        lock: {
            type: 'group',
            desc: 'Lock group settings (only admins can edit)',
            run: async (Bloom, message) => {
                if (!await isGroupAdminContext(Bloom, message)) return;
                const metadata = await Bloom.groupMetadata(message.key.remoteJid);
                if (metadata.locked === true) return await Bloom.sendMessage(message.key.remoteJid, { text: 'ℹ️ Group is already locked' });
                await Bloom.groupSettingUpdate(message.key.remoteJid, 'locked');
                await Bloom.sendMessage(message.key.remoteJid, { text: '🔒 Group settings locked' });
            }
        },
        unlock: {
            type: 'group',
            desc: 'Unlock group settings (members can edit)',
            run: async (Bloom, message) => {
                if (!await isGroupAdminContext(Bloom, message)) return;
                const metadata = await Bloom.groupMetadata(message.key.remoteJid);
                if (metadata.locked === false) return await Bloom.sendMessage(message.key.remoteJid, { text: 'ℹ️ Group is already unlocked' });
                await Bloom.groupSettingUpdate(message.key.remoteJid, 'unlocked');
                await Bloom.sendMessage(message.key.remoteJid, { text: '🔓 Group settings unlocked' });
            }
        },

    disap: {
        type: 'group',
        desc: 'Set disappearing messages:\n(0=off, 24=1 day, 7=1 week, 90=3 months)',
        run: async (Bloom, message, fulltext) => {
            if (!await isGroupAdminContext(Bloom, message)) return;

            const parts = fulltext.trim().split(' ');
            const input = parseInt(parts[1]); // e.g., !disappear 24

            const durations = {
                0: 0,
                24: 86400,
                7: 604800,
                90: 7776000
            };

            if (!durations.hasOwnProperty(input)) {
                return await Bloom.sendMessage(message.key.remoteJid, {
                    text: '❗ Invalid value. Use: 0 (off), 24, 7, or 90'
                });
            }

            await Bloom.sendMessage(message.key.remoteJid, { disappearingMessagesInChat: durations[input] });
            const statusMsg = input === 0 ? '❌ Disappearing messages disabled' : `💨 Disappearing messages set to ${input} hour(s)/day(s).`;
            await Bloom.sendMessage(message.key.remoteJid, { text: statusMsg });
        }
    },

    rename: {
        type: 'group',
        desc: 'Change group subject',
        run: async (Bloom, message, fulltext) => {

            if (!await isGroupAdminContext(Bloom, message)) return;
            const newName = fulltext.split(' ').slice(1).join(' ').trim();
            if (!newName) return Bloom.sendMessage(message.key.remoteJid, { text: '❌ Please provide a new name.' });
            await Bloom.groupUpdateSubject(message.key.remoteJid, newName);
            await Bloom.sendMessage(message.key.remoteJid, { text: `✏️ Group name updated to:\n\n${newName}` });
        }
    },

    desc: {
        type: 'group',
        desc: 'Change group description',
        run: async (Bloom, message, fulltext) => {
            if (!await isGroupAdminContext(Bloom, message)) return;
            const de = fulltext.split(' ').slice(1).join(' ').trim();
            if (!de) return Bloom.sendMessage(message.key.remoteJid, { text: '❌ Please provide a new description.' });
            await Bloom.groupUpdateDescription(message.key.remoteJid, de);
            await Bloom.sendMessage(message.key.remoteJid, { text: `📄 Description updated to.\n\n${de}` });
        }
    },

    revoke: {
        type: 'group',
        desc: 'Revoke group invite link',
        run: async (Bloom, message) => {
            if (!await isGroupAdminContext(Bloom, message)) return;
            await Bloom.groupRevokeInvite(message.key.remoteJid);
            await Bloom.sendMessage(message.key.remoteJid, { text: '🔗 Invite link revoked.' });
        }
    },
        revoke: {
            type: 'group',
            desc: 'Revoke current group invite link',
            run: async (Bloom, message, fulltext) => {
                if (!await isGroupAdminContext(Bloom, message)) return;

                try {
                    const code = await Bloom.groupRevokeInvite(message.key.remoteJid);
                    await Bloom.sendMessage(message.key.remoteJid, {
                        text: `🔁 Group invite link has been revoked.\ncheck new link or use *invite* to view`
                    });
                } catch (err) {
                    await Bloom.sendMessage(message.key.remoteJid, { text: `❌ Failed to revoke link.` });
                    console.error('Revoke error:', err);
                }
            }
        },
        invite: {
            type: 'group',
            desc: 'Get group invite link',
            run: async (Bloom, message) => {
                if (!await isGroupAdminContext(Bloom, message)) return;

                try {
                    const code = await Bloom.groupInviteCode(message.key.remoteJid);
                    await Bloom.sendMessage(message.key.remoteJid, {
                        text: `🔗 Group invite link:\n\nhttps://chat.whatsapp.com/${code}`,
                        detectLinks: true
                    });
                } catch (err) {
                    await Bloom.sendMessage(message.key.remoteJid, {
                        text: '❌ Failed to generate invite link. Bot needs admin privileges.'
                    });
                }
            }
        },
            poll: {
                type: 'group',
                desc: 'Creates a poll in the group (admin only)',
                usage: 'poll Question | Option 1 | Option 2 | ...',
                run: async (Bloom, message, fulltext) => {
                    if (!await isGroupAdminContext(Bloom, message)) return;

                    const groupId = message.key.remoteJid;
                    const pollText = fulltext.trim().split(' ').slice(1).join(' ').trim(); // remove 'poll'

                    const segments = pollText.split('|').map(s => s.trim()).filter(Boolean);

                    if (segments.length < 2) {
                        return await Bloom.sendMessage(groupId, {
                            text: '❌ Invalid format.\nUsage: poll Question | Option 1 | Option 2 | ...'
                        }, { quoted: message });
                    }

                    const pollName = segments[0];
                    const pollOptions = segments.slice(1);

                    if (pollOptions.length < 2) {
                        return await Bloom.sendMessage(groupId, {
                            text: '❌ A poll requires at least 2 options.'
                        }, { quoted: message });
                    }

                    try {
                        await Bloom.sendMessage(groupId, {
                            poll: {
                                name: pollName,
                                values: pollOptions,
                                selectableCount: 1,
                                toAnnouncementGroup: false
                            }
                        });
                    } catch (error) {
                        console.error('Poll error:', error);
                        await Bloom.sendMessage(groupId, {
                            text: '❌ Failed to create poll.'
                        }, { quoted: message });
                    }
                }
            },
            purge: {
                type: 'group',
                desc: '💣 Wipes the group (demotes, kicks, locks, leaves)',
                run: async (Bloom, message, fulltext) => {
                    const jid = message.key.remoteJid;
                    const sender = message.key.participant || message.key.remoteJid;

                    // ✅ Mandatory permission check
                    const allowed = await isGroupAdminContext(Bloom, message);
                    if (!allowed) return;

                    // 🚨 Safety warning unless --no-warning is used
                    if (!fulltext.includes('--no-warning')) {
                        return await Bloom.sendMessage(jid, {
                            text: `⚠️ *DANGEROUS COMMAND: PURGE*\n\nThis will:\n• Demote all admins\n• Lock the group\n• Kick all members\n• Nullify name & description\n• Send a final message\n• Leave group\n\nTo proceed anyway, send:\n*purge --no-warning*`
                        }, { quoted: message });
                    }

                    try {
                        const metadata = await Bloom.groupMetadata(jid);
                        const groupOwner = metadata.owner || metadata.participants.find(p => p.admin === 'superadmin')?.id;
                        const botId = Bloom.user.id.split(':')[0] + '@s.whatsapp.net';

                        // 🧹 Demote all admins (except owner and bot)
                        for (const p of metadata.participants) {
                            if (p.admin && p.id !== groupOwner && p.id !== botId) {
                                await Bloom.groupParticipantsUpdate(jid, [p.id], 'demote').catch(e =>
                                console.warn(`⛔ Failed to demote ${p.id}: ${e.message}`)
                                );
                            }
                        }

                        // 🔒 Lock group
                        await Bloom.groupSettingUpdate(jid, 'announcement');

                        // 🔁 Revoke group invite
                        await Bloom.groupRevokeInvite(jid);

                        // 👢 Kick all members (except owner and bot)
                        const toKick = metadata.participants
                        .filter(p => p.id !== groupOwner && p.id !== botId)
                        .map(p => p.id);

                        for (const id of toKick) {
                            await Bloom.groupParticipantsUpdate(jid, [id], 'remove').catch(e =>
                            console.warn(`⛔ Failed to remove ${id}: ${e.message}`)
                            );
                        }

                        // 🚫 Reset name and description
                        await Bloom.groupUpdateSubject(jid, 'null');
                        await Bloom.groupUpdateDescription(jid, '');

                        // 💬 Final message
                        await Bloom.sendMessage(jid, {
                            text: '☢️ This group has been purged.\n\nI now return to the void.\n💀 Goodbye.'
                        }, { quoted: message });

                        // 🚪 Leave group
                        await Bloom.groupLeave(jid);

                    } catch (err) {
                        console.error('❌ Purge error:', err);
                        await Bloom.sendMessage(jid, { text: `❌ Purge failed:\n\`\`\`\n${err.message}\n\`\`\`` }, { quoted: message });
                    }
                }
            },
            leave: {
                type: 'group',
                desc: 'Make bot leave the group',
                run: async (Bloom, message) => {
                    const metadata = await Bloom.groupMetadata(message.key.remoteJid);
                    const participant = metadata.participants.find(p => p.id === message.key.participant);

                    if (!['admin', 'superadmin'].includes(participant?.admin)) {
                        return await Bloom.sendMessage(message.key.remoteJid, { text: '❌ Only admins can use this command' });
                    }

                    await Bloom.sendMessage(message.key.remoteJid, { text: '👋 Leaving group... \nIt was nice serving you...\nHope we meet again..' });
                    await Bloom.groupLeave(message.key.remoteJid);
                }
            },
           antilink: {
                type: 'group',
                desc: 'Toggle Anti-Link protection',
                usage: 'antilink on/off',
                run: async (Bloom, message, fulltext) =>
                toggleSetting(Bloom, message, fulltext, 'antilink')
            },
            noimage: {
                type: 'group',
                desc: 'Toggle image restrictions',
                usage: 'noimage on/off',
                run: async (Bloom, message, fulltext) =>
                toggleSetting(Bloom, message, fulltext, 'noimage')
            },
            games: {
                type: 'group',
                desc: 'Toggle game commands',
                usage: 'games on/off',
                run: async (Bloom, message, fulltext) =>
                toggleSetting(Bloom, message, fulltext, 'game')
            },
            nsfw: {
                type: 'group',
                desc: 'Toggle NSFW commands',
                usage: 'nsfw on/off',
                run: async (Bloom, message, fulltext) =>
                toggleSetting(Bloom, message, fulltext, 'nsfw')
            },
            cmds: {
                type: 'group',
                desc: 'Toggle commands on or off',
                usage: 'cmds on/off',
                run: async (Bloom, message, fulltext) =>
                toggleSetting(Bloom, message, fulltext, 'cmds')
            },
    tag: {
    type: 'group',
    desc: 'Send a message tagging all users silently',
    usage: 'hidetag <message>',
    run: async (Bloom, message, fulltext) => {
        // Only allow admins
        if (!await isGroupAdminContext(Bloom, message)) return;
        const args = fulltext.trim().split(' ');
        if (args.length < 2) {
            return await Bloom.sendMessage(message.key.remoteJid, { text: 'Usage: tag <message>' });
        }
        const input = args.slice(1).join(' ');
        const metadata = await Bloom.groupMetadata(message.key.remoteJid);
        const participants = metadata.participants.map(p => p.id);
        await Bloom.sendMessage(message.key.remoteJid, {
            text: input || "\u200b", // default to invisible if empty
            contextInfo: {
                mentionedJid: participants
            }
        });
    }
}

};

async function toggleSetting(Bloom, message, fulltext, alias) {
    const jid = message.key.remoteJid;
    const arg = fulltext.split(' ')[1]?.toLowerCase();

    if (!await isGroupAdminContext(Bloom, message)) return;

    if (!['on', 'off'].includes(arg)) {
        return await Bloom.sendMessage(jid, { text: `❗ Usage: ${alias} on/off` });
    }

    const update = { [toggles[alias]]: arg === 'on' };

    await Settings.findOneAndUpdate(
        { group: jid },
        { $set: update },
        { new: true, upsert: true }
    );

    const status = arg === 'on' ? '✅ Enabled' : '🚫 Disabled';
    return await Bloom.sendMessage(jid, { text: `${status} ${alias}` });
}