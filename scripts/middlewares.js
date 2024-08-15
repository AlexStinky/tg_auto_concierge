const TelegrafI18n = require('telegraf-i18n/lib/i18n');

const messages = require('./messages');

const { sender } = require('../services/sender');
const { calendarService } = require('../services/calendar');
const {
    userDBService,
    serviceDBService,
    carDBService
} = require('../services/db');

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

const stnk = process.env.STNK_ID;

const LANGUAGES = /ru/;

const start = async (ctx, next) => {
    const { message } = ctx.update.callback_query || ctx.update;

    if (message && message.chat.type === 'private') {
        try {
            const lang = (LANGUAGES.test(ctx.from.language_code)) ?
                ctx.from.language_code : 'ru';
            const username = ctx.chat.username || ctx.from.username || ctx.from.first_name;

            ctx.state.user = await userDBService.get({ tg_id: ctx.from.id });

            if (!ctx.state.user) {
                ctx.state.user = await userDBService.create({
                    tg_id: ctx.from.id,
                    tg_username: username,
                    lang
                });
            }

            await ctx.i18n.locale(lang);

            if (ctx.state.user.tg_username !== username ||
                ctx.state.user.lang !== lang) {
                    ctx.state.user = await userDBService.update({ tg_id: ctx.from.id }, {
                        isActive: true,
                        tg_username:  username,
                        lang
                    }, 'after');
            }
        } catch (error) {
            //...
        }
    }

    return next();
};

const commands = async (ctx, next) => {
    const {
        message
    } = ctx.update;

    const { user } = ctx.state;

    if (message && message.chat.type === 'private' && message.text) {
        const { text } = message;

        const match = text.split(' ');

        let response_message = null;

        if (text.includes('/start')) {
            response_message = messages.start(user.lang, user);
        }

        if (text === '/test') {
            const start_date = new Date();
            const end_date = new Date();
            start_date.setDate(start_date.getDate() + 1);
            end_date.setDate(end_date.getDate() + 1);
            const event = {
                summary: 'Заказ водителя',
                location: '123',
                description: 'description',
                start_date,
                end_date
            };
            const res = await calendarService.addEvent(event);

            console.log(res)

            /*await carDBService.create({
                tg_id: ctx.from.id,
                title: 'title'
            });
            await serviceDBService.create({
                tg_id: ctx.from.id
            });*/
        }

        if (response_message) {
            sender.enqueue({
                chat_id: ctx.from.id,
                message: response_message
            });
        }
    }

    return next();
};

const cb = async (ctx, next) => {
    const {
        callback_query
    } = ctx.update;

    const { user } = ctx.state;

    if (callback_query && callback_query.message.chat.type === 'private') {
        const { message_id } = callback_query.message;

        const match = callback_query.data.split('-');

        let deleteMessage = false,
            deleteRemind = false,
            response_message = null;

        if (match[0] === 'cancel') {
            response_message = messages.start(user.lang, user, message_id);
        }

        if (match[0] === 'about') {
            response_message = messages.about(user.lang, message_id);
        }

        if (match[0] === 'subscription') {
            response_message = messages.subscription(user.lang, user, message_id);
        }

        if (match[0] === 'pay') {
            const sub_end_date = new Date();
            sub_end_date.setDate(sub_end_date.getDate() + 30);

            const _user = await userDBService.update({ tg_id: ctx.from.id }, {
                status: 'subscription',
                sub_end_date
            }, 'after');

            response_message = messages.start(_user.lang, _user, message_id);
        }

        if (user.status === 'subscription' || user.isAdmin) {
            if (match[0] === 'order') {
                const drivers = await userDBService.getAll({ status: 'driver' });
                const cars = await carDBService.getAll({ tg_id: ctx.from.id });

                if (drivers.length && cars.length) {
                    await ctx.deleteMessage();
                    await ctx.scene.enter('order');
                } else {
                    await ctx.answerCbQuery(ctx.i18n.t('driversOrCarNotFound_message'), true);
                }
            }
        }

        if (response_message) {
            if (deleteMessage) {
                await ctx.deleteMessage();
            }

            if (deleteRemind) {
                sender.deleteMessage(ctx.from.id, user.last_message_id).catch(console.log);
            }

            sender.enqueue({
                chat_id: ctx.from.id,
                message: response_message
            });
        }
    }

    return next();
};

const calendar = async (ctx, date) => {
    const { user } = ctx.state;
    const {
        step,
        order
    } = ctx.scene.state;
    const { message_id } = ctx.update.callback_query.message;

    const date_obj = new Date(date);

    let message = null;

    if (order) {
        if (step === 3) {
            ctx.scene.state.step++;
            ctx.scene.state.order.start_date = date_obj;

            const free = await calendarService.getEvents(date, 24);

            message = messages.chooseTime(user.lang, free, date_obj, message_id);
        }
    }

    if (message) {
        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    }
};

module.exports = {
    start,
    commands,
    cb,
    calendar
}