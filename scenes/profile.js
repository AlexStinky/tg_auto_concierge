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

function changePersonal() {
    const personal = new Scene('personal');

    personal.use(middlewares.start);
    personal.use(middlewares.commands);
    personal.use(middlewares.cb);

    personal.enter(async (ctx) => {
        const user = await userDBService.get({ tg_id: ctx.from.id });

        const message = messages.personal(user.lang, user, null);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    personal.action(/change-(fullname|phone)/, async (ctx) => {
        const { user } = ctx.state;
        const { message_id } = ctx.update.callback_query.message;

        ctx.scene.state.key = ctx.match[1];

        const message = messages.personal(user.lang, user, ctx.scene.state.key, message_id);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    personal.action('back', async (ctx) => {
        await ctx.deleteMessage();
        await ctx.scene.reenter();
    });

    personal.on('text', async (ctx) => {
        const { key } = ctx.scene.state;
        const { message_id } = ctx.update.message;
        const { text } = ctx.message;

        await userDBService.update({ tg_id: ctx.from.id }, { [key]: text });

        sender.deleteMessage(ctx.from.id, message_id - 1);

        await ctx.scene.reenter();
    });

    return personal;
}

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
            fullname: user.fullname,
            phone: user.phone,
            time_zone: user.time_zone
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

            order.service = service.title;

            message = messages.cars(user.lang, cars, 0, false, message_id);
        } else if (key === 'car') {
            const car = await carDBService.get({ _id });
            const driver = await userDBService.get({ status: 'driver' });

            if (car && driver) {
                order.car = car.brand + ' ' + car.model;
                order.driver_id = driver.tg_id;

                message = messages.location(user.lang, message_id);
            }
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
            message = messages.cars(user.lang, cars, page, false, message_id);
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

        const {
            start_date,
            end_date
        } = calendarService.getDate(order.start_date, user.time_zone);

        start_date.set({
            hour: hours,
            minute: minutes
        });
        end_date.set({
            hour: hours + 1,
            minutes: minutes
        });

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
                message = messages.cars(user.lang, cars, 0, false, message_id);
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

function addCar() {
    const car = new Scene('car');

    car.use(middlewares.start);
    car.use(middlewares.commands);
    car.use(middlewares.cb);

    car.enter(async (ctx) => {
        const { user } = ctx.state;

        ctx.scene.state.step = 0;
        ctx.scene.state.cars = await carDBService.getAll({ tg_id: user.tg_id });

        const message = messages.cars(user.lang, ctx.scene.state.cars, 0, true);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    car.action('add', async (ctx) => {
        const { user } = ctx.state;
        const { step } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        ctx.scene.state.data = {
            tg_id: ctx.from.id
        };

        const message = messages.addCar(user.lang, step, ctx.scene.state.data, message_id);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    car.action(/car-([0-9a-z]+)/, async (ctx) => {
        const { user } = ctx.state;
        const { step } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        const _id = ctx.match[1];

        ctx.scene.state.data = await carDBService.get({ _id });

        const message = messages.addCar(user.lang, step, ctx.scene.state.data, message_id);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    car.action(/next-([a-z]+)-([0-9]+)/, async (ctx) => {
        const { user } = ctx.state;
        const { cars } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        const page = Number(ctx.match[2]);

        const message = messages.cars(user.lang, cars, page, true, message_id);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    car.action('confirm', async (ctx) => {
        const { user } = ctx.state;
        const { data } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        if (data._id) {
            await carDBService.update({ _id: data._id }, data);
        } else {
            await carDBService.create(data);
        }

        const message = messages.start(user.lang, user, message_id);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });

        await ctx.answerCbQuery(ctx.i18n.t('carIsAdded_message'), true);
        await ctx.scene.leave();
    });

    car.action('back', async (ctx) => {
        const { user } = ctx.state;
        const { data } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        ctx.scene.state.step--;

        const message = messages.addCar(user.lang, ctx.scene.state.step, data, message_id);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    car.on('text', async (ctx) => {
        const { user } = ctx.state;
        const {
            step,
            data
        } = ctx.scene.state;
        const { text } = ctx.message;

        ctx.scene.state.step++;

        if (step === 0) {
            data.brand = text;
        } else if (step === 1) {
            data.model = text;
        } else if (step === 2) {
            data.color = text;
        } else if (step === 3) {
            data.registration_number = text;
        } else if (step === 4) {
            data.VIN = text;
        } else if (step === 5) {
            data.techpassport = text;
        }

        const message = messages.addCar(user.lang, ctx.scene.state.step, data);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    return car;
}

module.exports = {
    changePersonal,
    createOrder,
    addCar
}