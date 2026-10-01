const { isGroupAdminContext } = require('../../colors/auth');
const { set } = require('../../colors/setup');

module.exports = {
    welcome: {
        type: 'group',
        desc: 'Enable or disable welcome messages',
        usage: 'welcome on/off',
        run: async (Bloom, message, fulltext) => {
            const groupId = message.key.remoteJid;
            if (!groupId.endsWith('@g.us')) {
                return Bloom.sendMessage(groupId, { text: 'This command can only be used in a group.' });
            }

            if (!await isGroupAdminContext(Bloom, message)) return;

            const action = fulltext.trim().split(/\s+/)[1]?.toLowerCase();
            if (!['on', 'off'].includes(action)) {
                return Bloom.sendMessage(groupId, { text: 'Usage: welcome on/off' });
            }

            await set('WELCOME', action === 'on', groupId);
            return Bloom.sendMessage(groupId, {
                text: action === 'on' ? '✅ Welcome messages enabled.' : '🚫 Welcome messages disabled.'
            });
        }
    },
    message: {
        type: 'group',
        desc: 'Set this group\'s welcome message',
        usage: 'message <welcome text>',
        run: async (Bloom, message) => {
            const groupId = message.key.remoteJid;
            if (!groupId.endsWith('@g.us')) {
                return Bloom.sendMessage(groupId, { text: 'This command can only be used in a group.' });
            }

            if (!await isGroupAdminContext(Bloom, message)) return;

            const welcomeMessage = getRawCommandBody(message, 'message');
            if (!welcomeMessage.trim()) {
                return Bloom.sendMessage(groupId, { text: 'Usage: message <welcome text>' });
            }

            await set('MESSAGE', welcomeMessage, groupId);
            return Bloom.sendMessage(groupId, { text: '✅ Group welcome message updated.' });
        }
    }
};

function getRawCommandBody(message, commandName) {
    const text = extractText(message.message);
    const commandPrefix = new RegExp(`^\\s*!?${commandName}(?:[ \\t]|\\r?\\n|$)`, 'i');
    return text.replace(commandPrefix, '');
}

function extractText(content) {
    if (!content) return '';
    if (content.conversation) return content.conversation;
    if (content.extendedTextMessage?.text) return content.extendedTextMessage.text;
    if (content.ephemeralMessage) return extractText(content.ephemeralMessage.message);
    if (content.viewOnceMessage) return extractText(content.viewOnceMessage.message);
    return '';
}