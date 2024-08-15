const moment = require('moment-timezone');

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

const getTimeSlots = (timeZone, excludedRanges, date) => {
    const now = moment().tz(timeZone);
    const startOfDay = (excludedRanges.length > 0) ?
        moment(excludedRanges[0][0]).tz(timeZone) : moment(date).tz(timeZone);
    const endOfDay = moment(startOfDay).tz(timeZone);

    if (now.date() === startOfDay.date() && now.date() === startOfDay.date()) {
        startOfDay.hours(now.hours() + 1);
    } else {
        startOfDay.hours(0);
    }

    startOfDay.set({
        minute: 0,
        second: 0
    });

    endOfDay.set({
        hour: 23,
        minute: 59,
        second: 59
    });

    const inline_keyboard = [];

    while (startOfDay <= endOfDay) {
        const timeSlot = moment(startOfDay).tz(timeZone);

        const isExcluded = excludedRanges.some(range => {
            const [start, end] = range.map(date => moment(date).tz(timeZone));
            start.hours(start.hours() - 1);
            return timeSlot >= start && timeSlot < end;
        });

        if (!isExcluded) {
            const time = timeSlot.toISOString().slice(11, 16);
            const button = { text: time, callback_data: `time-${time}` };
            const temp = inline_keyboard[inline_keyboard.length - 1];

            if (!temp || temp.length % 7 === 0) {
                inline_keyboard[inline_keyboard.length] = [button];
            } else {
                inline_keyboard[inline_keyboard.length - 1][temp.length] = button;
            }
        }

        startOfDay.minutes(startOfDay.minutes() + 30);
    }

    return inline_keyboard;
};

const paginations = (lang, inline_keyboard, data, page, key, size = 5) => {
    const length = data.length;

    if (length > 0) {
        if (page > 0 && (page * size) < length) {
            inline_keyboard[inline_keyboard.length] = [
                { text: i18n.t(lang, 'back_button'), callback_data: `next-${key}-${page - 1}` },
                { text: i18n.t(lang, 'next_button'), callback_data: `next-${key}-${page + 1}` }
            ];
        } else if (page === 0 && length > size) {
            inline_keyboard[inline_keyboard.length] = [
                { text: i18n.t(lang, 'next_button'), callback_data: `next-${key}-${page + 1}` }
            ];
        } else if (page > 0) {
            inline_keyboard[inline_keyboard.length] = [
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

const services = (lang, data, page, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, 'chooseService_message'),
        extra: {}
    };
    const key = 'srv';

    let inline_keyboard = data.reduce((acc, el) => {
        acc[acc.length] = [{
            text: el.title + ' ' + `${el.available}/${el.all}`,
            callback_data: `${key}-${el.id}`
        }];

        return acc;
    }, []);

    inline_keyboard = paginations(lang, inline_keyboard, data, page, key);

    inline_keyboard[inline_keyboard.length] = [
        { text: i18n.t(lang, 'cancel_button'), callback_data: 'cancel' }
    ];

    message.extra = {
        reply_markup: {
            inline_keyboard
        }
    };

    return message;
};

const cars = (lang, data, page, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, 'chooseCar_message'),
        extra: {}
    };
    const key = 'car';

    let inline_keyboard = data.reduce((acc, el) => {
        acc[acc.length] = [{
            text: el.brand + ' ' + el.model,
            callback_data: `${key}-${el._id}`
        }];

        return acc;
    }, []);

    inline_keyboard = paginations(lang, inline_keyboard, data, page, key);

    inline_keyboard[inline_keyboard.length] = [
        { text: i18n.t(lang, 'cancel_button'), callback_data: 'back' }
    ];

    message.extra = {
        reply_markup: {
            inline_keyboard
        }
    };

    return message;
};

const location = (lang, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, 'enterLocation_message'),
        extra: {
            reply_markup: {
                inline_keyboard: [
                    [{ text: i18n.t(lang, 'back_button'), callback_data: 'back' }],
                    [{ text: i18n.t(lang, 'cancel_button'), callback_data: 'cancel' }]
                ]
            }
        }
    };

    return message;
};

const chooseDate = (lang, calendar, message_id = null) => {
    const today = new Date();
    const minDate = new Date();
    const maxDate = new Date();
    maxDate.setMonth(today.getMonth() + 6);

    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, 'chooseDate_message'),
        extra: calendar.setMinDate(minDate).setMaxDate(maxDate).getCalendar()
    };

    inline_keyboard = message.extra.reply_markup.inline_keyboard;
    inline_keyboard[inline_keyboard.length] = [
        { text: i18n.t(lang, 'back_button'), callback_data: 'back' }
    ];

    return message;
};

const chooseTime = (lang, timeZone, free, start_date, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, 'chooseTime_message'),
        extra: {}
    };
    let isBusy = false, inline_keyboard = [], temp = [];

    for (let i = 0; i < free.length; i++) {
        const el = free[i];

        if (el.start.date || el.end.date) {
            isBusy = true;
            break;
        } else {
            const start = el.start.dateTime;
            const end = el.end.dateTime;

            temp[temp.length] = [start, end];
        }
    }

    if (isBusy) {
        message.text = i18n.t(lang, 'dayIsAlreadyBusy_message');
    } else {
        inline_keyboard = getTimeSlots(timeZone, temp, start_date);
    }

    inline_keyboard[inline_keyboard.length] = [
        { text: i18n.t(lang, 'back_button'), callback_data: 'back' }
    ];

    message.extra = {
        reply_markup: {
            inline_keyboard
        }
    };

    return message;
};

const order = (lang, key, data, message_id = null) => {
    const dateOptions = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
    };
    const temp = {
        service: data.summary,
        car: data.car.brand + ' ' + data.car.model,
        location: (typeof data.location === 'object') ?
            JSON.stringify(data.location) : data.location,
        startDate: new Date(data.start_date).toLocaleDateString('ru-RU', dateOptions),
        endDate: new Date(data.end_date).toLocaleDateString('ru-RU', dateOptions)
    };
    const message = {
        type: (typeof data.location === 'object') ?
            'location' : (message_id) ?
            'edit_text' : 'text',
        message_id,
        location: data.location,
        text: i18n.t(lang, key) + '\n' + i18n.t(lang, 'order_message', temp),
        extra: {
            reply_markup: {
                inline_keyboard: [
                    [{ text: i18n.t(lang, 'confirm_button'), callback_data: 'confirm' }],
                    [{ text: i18n.t(lang, 'back_button'), callback_data: 'back' }],
                    [{ text: i18n.t(lang, 'cancel_button'), callback_data: 'cancel' }]
                ]
            }
        }
    };

    return message;
};

const adminPanel = (lang, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, 'adminPanel_message'),
        extra: {}
    };

    return message;
};

const userInfo = (lang, user, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, 'userInfo_message', {
            user: i18n.t(lang, 'user_url', {
                id: user.tg_id,
                username: user.tg_username
            }),
            isAdmin: (user.isAdmin) ? '✅' : '❌',
            status: user.status
        }),
        extra: {}
    };

    return message;
};

module.exports = {
    start,
    about,
    subscription,
    services,
    cars,
    location,
    chooseDate,
    chooseTime,
    order,
    adminPanel,
    userInfo
}