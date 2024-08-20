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

const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD HH:mm';

const eventText = (lang, data) => ({
    fullname: data.fullname,
    phone: data.phone,
    service: data.service,
    car: data.car,
    location: (typeof data.location === 'object') ?
        i18n.t(lang, 'eventAddress_message') : data.location,
    startDate: moment(data.start_date).tz(data.time_zone).format(DEFAULT_DATE_FORMAT),
    endDate: moment(data.end_date).tz(data.time_zone).format(DEFAULT_DATE_FORMAT)
});

const getTimeSlots = (timeZone, excludedRanges, dayDate, before) => {
    let now = moment(dayDate).tz(timeZone).startOf('hour').add(before, 'minutes');
    
    const endOfDay = moment(dayDate).tz(timeZone).endOf('day');

    const inline_keyboard = [];

    while (now <= endOfDay) {
        const timeSlot = moment(now);

        const isExcluded = excludedRanges.some(range => {
            const [start, end] = range.map(date => {
                const momentDate = moment(date);
                if (!momentDate.isValid()) {
                    return moment.tz(date, 'UTC').tz(timeZone);
                }
                return momentDate.tz(timeZone);
            });
            return timeSlot.isBetween(start, end, null, '[)');
        });

        if (!isExcluded) {
            const time = timeSlot.format('HH:mm');
            const button = { text: time, callback_data: `time-${time}` };
            const temp = inline_keyboard[inline_keyboard.length - 1];

            if (!temp || temp.length % 6 === 0) {
                inline_keyboard[inline_keyboard.length] = [button];
            } else {
                inline_keyboard[inline_keyboard.length - 1][temp.length] = button;
            }
        }

        now.add(30, 'minutes');
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

const simple = (lang, key, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, key),
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
            [{ text: i18n.t(lang, 'createOrder_button'), callback_data: 'event' }],
            [{ text: i18n.t(lang, 'renewSubscription_button'), callback_data: 'subscription' }],
            [{ text: i18n.t(lang, 'editCars_button'), callback_data: 'edit-cars' }],
            [{ text: i18n.t(lang, 'editPersonal_button'), callback_data: 'edit-personal' }],
            [{ text: i18n.t(lang, 'editEvent_button'), callback_data: 'edit-event' }]
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

const services = (lang, data, page, isAdmin, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, 'chooseService_message'),
        extra: {}
    };
    const key = 'srv';

    let inline_keyboard = (isAdmin) ?
        [[{ text: i18n.t(lang, 'addService_button'), callback_data: `add-${key}` }]] : [];
    inline_keyboard = data.reduce((acc, el) => {
        const text = (isAdmin) ?
            el.title : el.title + ' ' + `${el.available}/${el.all}`;
        const callback_data = (isAdmin) ?
            `edit-${key}-${el._id}` : `${key}-${el.id}`;
        acc[acc.length] = [{
            text,
            callback_data
        }];

        return acc;
    }, inline_keyboard);

    inline_keyboard = paginations(lang, inline_keyboard, data, page, key);

    inline_keyboard[inline_keyboard.length] = [
        { text: i18n.t(lang, 'back_button'), callback_data: 'back' }
    ];
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

const cars = (lang, data, page, isAdd = false, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, 'chooseCar_message'),
        extra: {}
    };
    const key = 'car';

    let inline_keyboard = (isAdd) ?
        [[{ text: i18n.t(lang, 'addNewCar_button'), callback_data: 'add' }]] : [];

    inline_keyboard = data.reduce((acc, el) => {
        acc[acc.length] = [{
            text: el.brand + ' ' + el.model,
            callback_data: `${key}-${el._id}`
        }];

        return acc;
    }, inline_keyboard);

    inline_keyboard = paginations(lang, inline_keyboard, data, page, key);

    inline_keyboard[inline_keyboard.length] = [
        { text: i18n.t(lang, 'back_button'), callback_data: 'back' }
    ];
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

const chooseTime = (lang, timeZone, busy, date, before_time, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, 'chooseTime_message'),
        extra: {}
    };
    let isBusy = false, inline_keyboard = [], temp = [];

    for (let i = 0; i < busy.length; i++) {
        const el = busy[i];

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
        inline_keyboard = getTimeSlots(timeZone, temp, date, before_time);
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

const events = (lang, data, page, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, 'chooseEvent_message'),
        extra: {}
    };
    const key = 'evnt';

    let inline_keyboard = data.reduce((acc, el) => {
        const start = moment(el.start_date).tz(el.time_zone).format(DEFAULT_DATE_FORMAT);
        acc[acc.length] = [{
            text: el.service + ' - ' + start,
            callback_data: `${key}-${el._id}`
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

const event = (lang, key, data, message_id = null) => {
    const temp = eventText(lang, data);
    const message = {
        type: (typeof data.location === 'object') ?
            'location' : (message_id) ?
            'edit_text' : 'text',
        message_id,
        location: data.location,
        text: i18n.t(lang, key) + '\n' + i18n.t(lang, 'event_message', temp),
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

    if (key && key.includes('remind')) {
        message.extra = {};
    }

    return message;
};

const personal = (lang, user, key, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, 'personal_message', {
            fullname: user.fullname,
            phone: user.phone
        }),
        extra: {}
    };
    let inline_keyboard = [];

    if (!key) {
        inline_keyboard = [
            [{ text: i18n.t(lang, 'editFullname_button'), callback_data: 'edit-fullname' }],
            [{ text: i18n.t(lang, 'editPhone_button'), callback_data: 'edit-phone' }]
        ];
    } else {
        message.text = i18n.t(lang, `enter_${key}_message`);
        inline_keyboard = [
            [{ text: i18n.t(lang, 'back_button'), callback_data: 'back' }]
        ];
    }

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

const tariffs = (lang, data, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, 'chooseTariff_message'),
        extra: {}
    };
    const inline_keyboard = data.reduce((acc, el) => {
        acc[acc.length] = [{ text: el.title, callback_data: `tariff-${el.id}` }];

        return acc;
    }, []);

    inline_keyboard[inline_keyboard.length] = [{
        text: i18n.t(lang, 'back_button'), callback_data: 'back'
    }];
    inline_keyboard[inline_keyboard.length] = [{
        text: i18n.t(lang, 'cancel_button'), callback_data: 'cancel'
    }];

    message.extra = {
        reply_markup: {
            inline_keyboard
        }
    };

    return message;
};

const editEvent = (lang, data, message_id = null) => {
    const temp = eventText(lang, data);
    const message = {
        type: (typeof data.location === 'object') ?
            'location' : (message_id) ?
            'edit_text' : 'text',
        message_id,
        location: data.location,
        text: i18n.t(lang, 'event_message', temp),
        extra: {
            reply_markup: {
                inline_keyboard: [
                    //[{ text: i18n.t(lang, 'editCar_button'), callback_data: 'edit-car' }],
                    [{ text: i18n.t(lang, 'editLocation_button'), callback_data: 'edit-location' }],
                    [{ text: i18n.t(lang, 'editDate_button'), callback_data: 'edit-date' }],
                    [{ text: i18n.t(lang, 'back_button'), callback_data: 'back' }],
                    [{ text: i18n.t(lang, 'cancel_button'), callback_data: 'cancel' }]
                ]
            }
        }
    };

    return message;
};

const addCar = (lang, step, data, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: '',
        extra: {}
    };
    let inline_keyboard = [];

    if (step === 0) {
        message.text = i18n.t(lang, 'enterCarBrand_message');
    } else if (step === 1) {
        message.text = i18n.t(lang, 'enterCarModel_message');
    } else if (step === 2) {
        message.text = i18n.t(lang, 'enterCarColor_message');
    } else if (step === 3) {
        message.text = i18n.t(lang, 'enterCarRegistrationNumber_message');
    } else if (step === 4) {
        message.text = i18n.t(lang, 'enterCarVIN_message');
    } else if (step === 5) {
        message.text = i18n.t(lang, 'enterCarTechpassport_message');
    } else if (step > 5) {
        message.text = i18n.t(lang, 'checkCar_message', {
            brand: data.brand,
            model: data.model,
            color: data.color,
            registration_number: data.registration_number,
            VIN: data.VIN,
            techpassport: data.techpassport
        });

        inline_keyboard[inline_keyboard.length] = [
            { text: i18n.t(lang, 'confirm_button'), callback_data: 'confirm' }
        ];
    }

    inline_keyboard[inline_keyboard.length] = [
        { text: i18n.t(lang, 'back_button'), callback_data: 'back' }
    ];
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

const editCar = (lang, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, 'editCar_message'),
        extra: {
            reply_markup: {
                inline_keyboard: [
                    [{ text: i18n.t(lang, 'deleteCar_button'), callback_data: 'delete' }],
                    [{ text: i18n.t(lang, 'editCarBrand_button'), callback_data: 'edit-0' }],
                    [{ text: i18n.t(lang, 'editCarModel_button'), callback_data: 'edit-1' }],
                    [{ text: i18n.t(lang, 'editCarColor_button'), callback_data: 'edit-2' }],
                    [{ text: i18n.t(lang, 'editCarRegistrationNumber_button'), callback_data: 'edit-3' }],
                    [{ text: i18n.t(lang, 'editCarVIN_button'), callback_data: 'edit-4' }],
                    [{ text: i18n.t(lang, 'editCarTechpassport_button'), callback_data: 'edit-5' }],
                    [{ text: i18n.t(lang, 'back_button'), callback_data: 'back' }],
                    [{ text: i18n.t(lang, 'cancel_button'), callback_data: 'cancel' }]
                ]
            }
        }
    };

    return message;
};

const addService = (lang, data, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: '',
        extra: {}
    };
    let inline_keyboard = [];

    if (data.step === 0) {
        message.text = i18n.t(lang, 'enterServiceTitle_message');
    } else if (data.step === 1) {
        message.text = i18n.t(lang, 'enterServiceLimitsOnMonth_message');
    } else {
        message.text = i18n.t(lang, 'checkService_message') +
            '\n' +
            i18n.t(lang, 'service_message', {
                title: data.title,
                limits: data.limits
            });

        inline_keyboard = [
            [{ text: i18n.t(lang, 'confirm_button'), callback_data: 'confirm' }]
        ];
    }

    inline_keyboard[inline_keyboard.length] = [
        { text: i18n.t(lang, 'back_button'), callback_data: 'back' }
    ];
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

const editService = (lang, data, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, 'editService_message') +
            '\n' +
            i18n.t(lang, 'service_message', {
                title: data.title,
                limits: data.limits
            }),
        extra: {
            reply_markup: {
                inline_keyboard: [
                    [{ text: i18n.t(lang, 'deleteService_button'), callback_data: 'srv-delete' }],
                    [{ text: i18n.t(lang, 'editServiceTitle_button'), callback_data: 'srv-title' }],
                    [{ text: i18n.t(lang, 'editServiceLimits_button'), callback_data: 'srv-limits' }],
                    [{ text: i18n.t(lang, 'back_button'), callback_data: 'back' }],
                    [{ text: i18n.t(lang, 'cancel_button'), callback_data: 'cancel' }]
                ]
            }
        }
    };

    return message;
};

const editTariff = (lang, data, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, 'editTariff_message', data),
        extra: {
            reply_markup: {
                inline_keyboard: [
                    [{ text: i18n.t(lang, 'editPrice_button'), callback_data: 'edit-price' }],
                    [{ text: i18n.t(lang, 'back_button'), callback_data: 'back' }]
                ]
            }
        }
    };

    return message;
};

const editDriver = (lang, data, message_id = null) => {
    const message = {
        type: (message_id) ? 'edit_text' : 'text',
        message_id,
        text: i18n.t(lang, 'editDriver_message', {
            user: i18n.t(lang, 'user_url', {
                id: data.tg_id,
                username: data.tg_username
            }),
            phone: data.phone,
            before_time: data.before_time,
            duration_time: data.duration_time
        }),
        extra: {
            reply_markup: {
                inline_keyboard: [
                    [{ text: i18n.t(lang, 'editPhone_button'), callback_data: 'edit-phone' }],
                    [{ text: i18n.t(lang, 'editBeforeTime_button'), callback_data: 'edit-before_time' }],
                    [{ text: i18n.t(lang, 'editDurationTime_button'), callback_data: 'edit-duration_time' }],
                    [{ text: i18n.t(lang, 'back_button'), callback_data: 'back' }]
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
        extra: {
            reply_markup: {
                inline_keyboard: [
                    [{ text: i18n.t(lang, 'services_button'), callback_data: 'services' }],
                    [{ text: i18n.t(lang, 'cars_button'), callback_data: 'cars' }],
                    [{ text: i18n.t(lang, 'tariffs_button'), callback_data: 'tariffs' }],
                    [{ text: i18n.t(lang, 'drivers_button'), callback_data: 'drivers' }],
                    [{ text: i18n.t(lang, 'cancel_button'), callback_data: 'cancel' }]
                ]
            }
        }
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
    simple,
    start,
    about,
    subscription,
    services,
    cars,
    location,
    chooseDate,
    chooseTime,
    events,
    event,
    personal,
    tariffs,
    editEvent,
    addCar,
    editCar,
    addService,
    editService,
    editTariff,
    editDriver,
    adminPanel,
    userInfo
}