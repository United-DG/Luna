const { get } = require('./setup');

async function handleGroupParticipantsUpdate(Luna, update) {
    const { id: groupId, participants, action } = update || {};
    if (action !== 'add' || !groupId?.endsWith('@g.us') || !participants?.length) return;

    const enabled = await get('WELCOME', groupId);
    if (enabled !== 'true') return;

    const message = await get('MESSAGE', groupId);
    if (!message.trim()) return;

    const participantJids = participants
        .map(participant => typeof participant === 'string'
            ? participant
            : participant?.id || participant?.jid || participant?.phoneNumber)
        .filter(jid => typeof jid === 'string' && jid.includes('@'));
    if (!participantJids.length) return;

    const tags = participantJids.map(jid => `@${jid.split('@')[0]}`).join(' ');
    await Luna.sendMessage(groupId, {
        text: `${message}\n\n${tags}`,
        mentions: participantJids
    });
}

module.exports = { handleGroupParticipantsUpdate };