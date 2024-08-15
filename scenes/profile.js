const Scene = require('telegraf/scenes/base');

const middlewares = require('../scripts/middlewares');
const messages = require('../scripts/messages');

const {
    userDBService,
    carDBService,
    serviceDBService,
    orderDBService
} = require('../services/db');
const { calendarService } = require('../services/calendar');
const { sender } = require('../services/sender');

const getServices = async () => {
    const now = new Date();
    const startMonth = new Date();
    startMonth.setDate(1);
    startMonth.setHours(0);
    startMonth.setMinutes(0);

    const services = await serviceDBService.getAll();

    const temp = [];

    for (let i = 0; i < services.length; i++) {
        const service = services[i];
        const orders = await orderDBService.getCount({
            service_id: service._id,
            creation_date: {
                $gt: startMonth,
                $lt: now
            }
        });
        const available = service.limits - orders;

        if (available > 0) {
            temp[temp.length] = {
                id: service._id,
                title: service.title,
                available: service.limits - orders,
                all: service.limits
            };
        }
    }

    return temp;
};

function createOrder() {
    const order = new Scene('order');

    order.use(middlewares.start);
    order.use(middlewares.commands);
    order.use(middlewares.cb);

    order.enter(async (ctx) => {
        const { user } = ctx.state;

        ctx.scene.state.step = 0;
        ctx.scene.state.order = {
            customer_id: user.tg_id,
            timeZone: 'Europe/Lisbon'
        };
        ctx.scene.state.services = await getServices();
        ctx.scene.state.cars = await carDBService.getAll({ tg_id: user.tg_id });

        const message = messages.services(user.lang, ctx.scene.state.services, 0);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    order.action(/(srv|car)-([a-z0-9]+)/, async (ctx) => {
        const { user } = ctx.state;
        const {
            order,
            cars,
        } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        const key = ctx.match[1];
        const _id = ctx.match[2];

        let message = null;

        if (key === 'srv') {
            const service = await serviceDBService.get({ _id });

            order.service_id = _id;
            order.summary = service.title;

            message = messages.cars(user.lang, cars, 0, message_id);
        } else if (key === 'car') {
            const car = await carDBService.get({ _id });
            const driver = await userDBService.get({ status: 'driver' });

            order.car_id = _id;
            order.driver_id = driver.tg_id;
            order.car = car;

            message = messages.location(user.lang, message_id);
        }

        ctx.scene.state.step++;

        if (message) {
            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        }
    });

    order.action(/next-([a-z]+)-([0-9]+)/, async (ctx) => {
        const { user } = ctx.state;
        const {
            services,
            cars
        } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        const key = ctx.match[1];
        const page = Number(ctx.match[2]);

        let message = null;

        if (key === 'srv') {
            message = messages.services(user.lang, services, page, message_id);
        } else if (key === 'car') {
            message = messages.cars(user.lang, cars, page, message_id);
        }

        if (message) {
            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        }
    });

    order.action(/time-([0-9]+):([0-9]+)/, async (ctx) => {
        const { user } = ctx.state;
        const { order } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        const hours = Number(ctx.match[1]);
        const minutes = Number(ctx.match[2]);

        order.start_date.setHours(hours);
        order.start_date.setMinutes(minutes);

        const {
            start_date,
            end_date
        } = calendarService.getDate(order.start_date, 1);

        order.start_date = start_date;
        order.end_date = end_date;

        ctx.scene.state.step++;

        const message = messages.order(user.lang, 'checkOrder_message', order, message_id);

        if (message.type === 'location') {
            sender.deleteMessage(ctx.from.id, message_id);
        }

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    order.action('confirm', async (ctx) => {
        const { user } = ctx.state;
        const { order } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        const res = await calendarService.addEvent(order);

        if (res) {
            await ctx.answerCbQuery(ctx.i18n.t('eventIsAdded_message'), true);
        }

        const message = messages.start(user.lang, user, message_id);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });

        await ctx.scene.leave();
    });

    order.action('back', async (ctx) => {
        const { user } = ctx.state;
        const {
            step,
            services,
            cars
        } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        if (step > 0) {
            let message = null;

            ctx.scene.state.step--;

            if (step === 1) {
                message = messages.services(user.lang, services, 0, message_id);
            } else if (step === 2) {
                message = messages.cars(user.lang, cars, 0, message_id);
            } else if (step === 3) {
                message = messages.location(user.lang, message_id);
            } else if (step === 4 || step === 5 || step === 6) {
                ctx.scene.state.step = 3;
                message = messages.chooseDate(user.lang, sender.calendar, message_id);
            }

            if (message) {
                sender.enqueue({
                    chat_id: ctx.from.id,
                    message
                });
            }
        }
    });

    order.on('location', async (ctx) => {
        const { user } = ctx.state;
        const { step } = ctx.scene.state;
        const { location } = ctx.update.message;

        if (step === 2) {
            ctx.scene.state.step++;
            ctx.scene.state.order.location = location;

            const message = messages.chooseDate(user.lang, sender.calendar);

            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        }
    });

    order.on('text', async (ctx) => {
        const { user } = ctx.state;
        const { step } = ctx.scene.state;
        const { text } = ctx.message;

        let message = null;

        if (step === 2) {
            ctx.scene.state.step++;
            ctx.scene.state.order.location = text;

            message = messages.chooseDate(user.lang, sender.calendar);
        }

        if (message) {
            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        }
    });

    return order;
}

module.exports = {
    createOrder
}