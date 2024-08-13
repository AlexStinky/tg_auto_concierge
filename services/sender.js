const { Queue } = require('../modules/queue');

const { userDBService } = require('./db');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class Sender extends Queue {
    constructor() {
        super();

        this.bot = {};
        this.delay = 100;
        this.counter = 0;

        this.TEXT_MAX_LENGTH = 4000;
        this.CAPTION_MAX_LENGTH = 1000;

        this.ERRORS_DESCRIPTION = [
            'Forbidden: bot was blocked by the user',
            "Forbidden: bot can't initiate conversation with a user",
            'Forbidden: user is deactivated'
        ];
    }

    async create(bot) {
        return this.bot = bot;
    }

    async start() {
        if (this.storage[this.count - 1]) {
            const { chat_id, message } = this.storage[this.count - 1];

            this.dequeue();

            await this.sendMessage(chat_id, message);

            if (this.counter % 29 === 0) {
                await sleep(1000);
            }

            this.counter++;
        }

        setTimeout(() => this.start(), 100);
    }

    async unbanUser(chatId, user) {
        try {
            return await this.bot.telegram.unbanChatMember(chatId, user.tg_id, {
                only_if_banned: true
            });
        } catch (error) {
            console.log('[Sender]', error.response);

            return null;
        }
    }

    async banUser(chatId, user) {
        try {
            return await this.bot.telegram.banChatMember(chatId, user.tg_id);
        } catch (error) {
            console.log('[Sender]', error.response);

            return null;
        }
    }

    async deleteMessage(id, message_id) {
        try {
            return await this.bot.telegram.deleteMessage(id, message_id);
        } catch (error) {
            console.log('[Sender]', error.response);

            return null;
        }
    }

    async deleteMessages(chat_id, message_ids) {
        try {
            return await this.bot.telegram.callApi('deleteMessages', {
                chat_id,
                message_ids
            });
        } catch (error) {
            console.log('[Sender]', error.response);

            return null;
        }
    }

    async sendMessage(chatId, message) {
        const MAX_LENGTH = (message.type === 'text') ?
            this.TEXT_MAX_LENGTH : this.CAPTION_MAX_LENGTH;

        let next = null,
            text = message.text,
            extra = {};

        if (text && text.length > MAX_LENGTH) {
            const temp = (message.text.split('\n'))
                .reduce((acc, el) => {
                    if ((acc['current'].length + el.length) < MAX_LENGTH) {
                        acc['current'] += el + '\n';
                    } else {
                        acc['next'] += el + '\n';
                    }

                    return acc;
                }, {
                    current: '',
                    next: ''
                });
            next = temp.next;
            text = temp.current;
            extra = {
                caption: text,
                parse_mode: 'HTML'
            };
        } else {
            extra = {
                caption: text,
                parse_mode: 'HTML',
                ...message.extra
            };
        }

        await sleep(this.delay);

        try {
            let res = null;

            switch (message.type) {
                case 'action':
                    res = await this.bot.telegram.sendChatAction(chatId, message.text);
                    break;
                case 'cb':
                    res = await this.bot.telegram.answerCbQuery(message.id, message.text, message.alert, extra);
                    break;
                case 'edit_keyboard':
                    res = await this.bot.telegram.editMessageReplyMarkup(chatId, message.message_id, null, extra.reply_markup);
                    break;
                case 'edit_text':
                    res = await this.bot.telegram.editMessageText(chatId, message.message_id, null, message.text, extra);
                    break;
                case 'edit_media':
                    res = await this.bot.telegram.editMessageMedia(chatId, message.message_id, null, message.file, extra);
                    break;
                case 'photo':
                    res = await this.bot.telegram.sendPhoto(chatId, message.file, extra);
                    break;
                case 'document':
                    res = await this.bot.telegram.sendDocument(chatId, message.file, extra);
                    break;
                case 'video':
                    res = await this.bot.telegram.sendVideo(chatId, message.file, extra);
                    break;
                case 'media_group':
                    await this.bot.telegram.sendMediaGroup(chatId, message.file, extra);
                    res = await this.bot.telegram.sendMessage(chatId, text, extra);
                    break;
                case 'invoice':
                    res = await this.bot.telegram.sendInvoice(chatId, message, extra);
                    //await this.bot.telegram.sendMessage(chatId, text, extra);
                    break;
                default:
                    res = (message.text.length > MAX_LENGTH) ?
                        await this.bot.telegram.sendMessage(chatId, text, {}) :
                        await this.bot.telegram.sendMessage(chatId, text, extra);
                    break;
            }

            /*if (this.delay >= 1000) {
                this.delay = 100;
            } else {
                this.delay += 100;
            }*/

            if (message.text && message.text.length > MAX_LENGTH) {
                const temp = {
                    type: 'text',
                    text: next,
                    extra: {
                        caption: next,
                        parse_mode: 'HTML',
                        ...message.extra
                    }
                };

                return this.sendMessage(chatId, temp);
            } else {
                return res;
            }
        } catch (error) {
            const response = (error.response) ? error.response : error;

            console.log('[Sender]', response);

            if (response.description) {
                if (response.description.includes("Bad Request: can't parse entities:")) {
                    const temp = {
                        type: message.type,
                        text: message.text.replace(/([<>\/])/g, ''),
                        extra: {}
                    };

                    return this.sendMessage(chatId, temp);
                } else if (this.ERRORS_DESCRIPTION.includes(response.description)) {
                    const update = await userDBService.update({ tg_id: chatId }, {
                        isActive: false
                    });

                    console.log(update)

                    return update;
                }
            }

            return null;
        }
    }
}

const sender = new Sender();
sender.start();

module.exports = {
    sender
}