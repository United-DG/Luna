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
        run: async (Bloom, message, fulltext) => {
            const groupId = message.key.remoteJid;
            if (!groupId.endsWith('@g.us')) {
                return Bloom.sendMessage(groupId, { text: 'This command can only be used in a group.' });
            }

            if (!await isGroupAdminContext(Bloom, message)) return;

            const welcomeMessage = fulltext.trim().split(/\s+/).slice(1).join(' ');
            if (!welcomeMessage) {
                return Bloom.sendMessage(groupId, { text: 'Usage: message <welcome text>' });
            }

            await set('MESSAGE', welcomeMessage, groupId);
            return Bloom.sendMessage(groupId, { text: '✅ Group welcome message updated.' });
        }
    }
};