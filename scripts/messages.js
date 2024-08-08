const fs = require('fs');

const TelegrafI18n = require('telegraf-i18n/lib/i18n');

const i18n = new TelegrafI18n({
    directory: './locales',
    defaultLanguage: 'ru',
    sessionName: 'session',
    useSession: true,
    templateData: {
        pluralize: TelegrafI18n.pluralize,
        uppercase: (value) => value.toUpperCase()
    }
});

const DELETE_DELAY = 10000;

const paginations = (lang, data, page, length, key, size = 5) => {
    let inline_keyboard = [];

    if (data.length > 0) {
        if (page > 0 && page * size < length) {
            inline_keyboard = [
                { text: i18n.t(lang, 'back_button'), callback_data: `next-${key}-${page - 1}` },
                { text: i18n.t(lang, 'next_button'), callback_data: `next-${key}-${page + 1}` }
            ];
        } else if (page === 0 && length > size) {
            inline_keyboard = [
                { text: i18n.t(lang, 'next_button'), callback_data: `next-${key}-${page + 1}` }
            ];
        } else if (page > 0) {
            inline_keyboard = [
                { text: i18n.t(lang, 'back_button'), callback_data: `next-${key}-${page - 1}` }
            ];
        }
    }

    return inline_keyboard;
};

const start = (lang, user, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, 'start_message'),
        extra: {}
    };

    let inline_keyboard = [];

    if (user.status === 'subscription') {
        inline_keyboard = [
            [{ text: i18n.t(lang, 'order_button'), callback_data: 'order' }],
            [{ text: i18n.t(lang, 'renewSubscription_button'), callback_data: 'subscription' }],
            [{ text: i18n.t(lang, 'editCars_button'), callback_data: 'edit-cars' }],
            [{ text: i18n.t(lang, 'editPersonal_button'), callback_data: 'edit-personal' }],
            [{ text: i18n.t(lang, 'calendar_button'), callback_data: 'calendar' }]
        ];
    } else {
        inline_keyboard = [
            [{ text: i18n.t(lang, 'aboutService_button'), callback_data: 'about' }],
            [{ text: i18n.t(lang, 'buySubscription_button'), callback_data: 'subscription' }]
        ];
    }

    message.extra = {
        reply_markup: {
            inline_keyboard
        }
    };

    return message;
};

const about = (lang, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, 'aboutService_message'),
        extra: {
            reply_markup: {
                inline_keyboard: [
                    [{ text: i18n.t(lang, 'back_button'), callback_data: 'cancel' }]
                ]
            }
        }
    };

    return message;
};

const subscription = (lang, user, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: (user.status === 'subscription') ?
            i18n.t(lang, 'renewSubscription_message') :
            i18n.t(lang, 'buySubscription_message'),
        extra: {
            reply_markup: {
                inline_keyboard: [
                    [{ text: i18n.t(lang, 'pay_button'), callback_data: 'pay' }],
                    [{ text: i18n.t(lang, 'back_button'), callback_data: 'cancel' }]
                ]
            }
        }
    };

    return message;
};

module.exports = {
    start,
    about,
    subscription
}