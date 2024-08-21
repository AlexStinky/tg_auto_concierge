const Scene = require('telegraf/scenes/base');

const middlewares = require('../scripts/middlewares');
const messages = require('../scripts/messages');

const {
    userDBService,
    carDBService,
    serviceDBService,
    eventDBService
} = require('../services/db');
const { calendarService } = require('../services/calendar');
const { sender } = require('../services/sender');

const getServices = async (ctx) => {
    const { user } = ctx.state;

    const now = new Date();
    const startMonth = new Date();
    startMonth.setDate(1);
    startMonth.setHours(0);
    startMonth.setMinutes(0);

    const services = await serviceDBService.getAll({});

    const temp = [];

    for (let i = 0; i < services.length; i++) {
        const service = services[i];
        const events = await eventDBService.getCount({
            customer_id: user.tg_id,
            service_id: service._id,
            creation_date: {
                $gt: startMonth,
                $lt: now
            }
        });
        const available = service.limits - events;

        if (available > 0) {
            temp[temp.length] = {
                id: service._id,
                title: service.title,
                available: service.limits - events,
                all: service.limits
            };
        }
    }

    return temp;
};

const eventTime = async (ctx, isEdit = false) => {
    const { user } = ctx.state;
    const { data } = ctx.scene.state;
    const { message_id } = ctx.update.callback_query.message;

    const hours = Number(ctx.match[1]);
    const minutes = Number(ctx.match[2]);

    const {
        start_date,
        end_date
    } = calendarService.getDate(data.start_date, user.time_zone);

    start_date.set({
        hour: hours,
        minute: minutes
    });
    end_date.set({
        hour: hours,
        minutes: minutes
    });
    end_date.add(data.duration_time, 'minutes');

    data.start_date = start_date;
    data.end_date = end_date;

    let message = null;

    if (isEdit) {
        ctx.scene.state.key = null;

        message = messages.editEvent(user.lang, data, message_id);

        await calendarService.updateEvent(data.event_id, data);

        await ctx.answerCbQuery(ctx.i18n.t('dateIsUpdated_message'), true);
    } else {
        ctx.scene.state.step++;

        message = messages.event(user.lang, 'checkOrder_message', data, message_id);

        if (message.type === 'location') {
            sender.deleteMessage(ctx.from.id, message_id);
        }
    }

    sender.enqueue({
        chat_id: ctx.from.id,
        message
    });
};

function addEvent() {
    const event = new Scene('event');

    event.use(middlewares.start);
    event.use(middlewares.commands);
    //event.use(middlewares.cb);

    event.enter(async (ctx) => {
        const { user } = ctx.state;

        ctx.scene.state.step = 0;
        ctx.scene.state.data = {
            customer_id: user.tg_id,
            fullname: user.fullname,
            phone: user.phone,
            time_zone: user.time_zone
        };
        ctx.scene.state.services = await getServices(ctx);
        ctx.scene.state.cars = await carDBService.getAll({ tg_id: user.tg_id });

        const message = messages.services(user.lang, ctx.scene.state.services, 0, false);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    event.action(/(srv|car)-([a-z0-9]+)/, async (ctx) => {
        const { user } = ctx.state;
        const {
            data,
            cars,
        } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        const key = ctx.match[1];
        const _id = ctx.match[2];

        let message = null;

        if (key === 'srv') {
            const service = await serviceDBService.get({ _id });

            data.service_id = _id;
            data.service = service.title;

            message = messages.cars(user.lang, cars, 0, false, message_id);
        } else if (key === 'car') {
            const car = await carDBService.get({ _id });
            const driver = await userDBService.get({ status: 'driver' });

            if (car && driver) {
                data.car = car.brand + ' ' + car.model;
                data.driver_id = driver.tg_id;
                data.duration_time = driver.duration_time;
                data.before_time = driver.before_time;

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

    event.action(/next-([a-z]+)-([0-9]+)/, async (ctx) => {
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
            message = messages.services(user.lang, services, page, false, message_id);
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

    event.action(/time-([0-9]+):([0-9]+)/, async (ctx) => await eventTime(ctx));

    event.action('confirm', async (ctx) => {
        const { user } = ctx.state;
        const { data } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        const res = await calendarService.addEvent(data);

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

    event.action('back', async (ctx) => {
        const { user } = ctx.state;
        const {
            step,
            services,
            cars
        } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        let isLeave = false,
            message = null;

        if (step > 0) {
            ctx.scene.state.step--;

            if (step === 1) {
                message = messages.services(user.lang, services, 0, false, message_id);
            } else if (step === 2) {
                message = messages.cars(user.lang, cars, 0, false, message_id);
            } else if (step === 3) {
                message = messages.location(user.lang, message_id);
            } else if (step === 4 || step === 5 || step === 6) {
                ctx.scene.state.step = 3;
                message = messages.chooseDate(user.lang, sender.calendar, message_id);
            }
        } else {
            isLeave = true;
            message = messages.start(user.lang, user, message_id);
        }

        if (message) {
            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        }

        if (isLeave) {
            await ctx.scene.leave();
        }
    });

    event.on('location', async (ctx) => {
        const { user } = ctx.state;
        const { step } = ctx.scene.state;
        const { location } = ctx.update.message;

        if (step === 2) {
            ctx.scene.state.step++;
            ctx.scene.state.data.location = location;

            const message = messages.chooseDate(user.lang, sender.calendar);

            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        }
    });

    event.on('text', async (ctx) => {
        const { user } = ctx.state;
        const { step } = ctx.scene.state;
        const { text } = ctx.message;

        let message = null;

        if (step === 2) {
            ctx.scene.state.step++;
            ctx.scene.state.data.location = text;

            message = messages.chooseDate(user.lang, sender.calendar);
        }

        if (message) {
            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        }
    });

    return event;
}

function addCar() {
    const car = new Scene('car');

    car.use(middlewares.start);
    car.use(middlewares.commands);
    //car.use(middlewares.cb);

    car.enter(async (ctx) => {
        const { user } = ctx.state;

        const tg_id = (ctx.scene.state.user) ?
            ctx.scene.state.user.tg_id : user.tg_id;

        ctx.scene.state.isEdit = false;
        ctx.scene.state.step = 0;
        ctx.scene.state.cars = await carDBService.getAll({ tg_id });

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
        const { message_id } = ctx.update.callback_query.message;

        const _id = ctx.match[1];

        ctx.scene.state.isEdit = true;
        ctx.scene.state.data = await carDBService.get({ _id });

        const message = messages.editCar(user.lang, message_id);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    car.action(/edit-([a-z_0-9]+)/, async (ctx) => {
        const { user } = ctx.state;
        const { data } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        ctx.scene.state.step = Number(ctx.match[1]);

        const message = messages.addCar(user.lang, ctx.scene.state.step, data, message_id);

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

    car.action('delete', async (ctx) => {
        const { data } = ctx.scene.state;

        await carDBService.delete({ _id: data._id });

        await ctx.deleteMessage();
        await ctx.scene.reenter();
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
        const {
            isEdit,
            step,
            data
        } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        let isLeave = true, message = null;

        if (isEdit) {
            await ctx.deleteMessage();

            return await ctx.scene.reenter();
        } else if (step > 0) {
            ctx.scene.state.step--;

            message = messages.addCar(user.lang, ctx.scene.state.step, data, message_id);
        } else {
            if (ctx.scene.state.user && user.isAdmin) {
                await ctx.deleteMessage();

                return await ctx.scene.enter('adminka');
            } else {
                message = messages.start(user.lang, user, message_id);
            }
        }

        if (message) {
            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        }

        if (isLeave) {
            await ctx.scene.leave();
        }
    });

    car.on('text', async (ctx) => {
        const { user } = ctx.state;
        const {
            isEdit,
            step,
            data
        } = ctx.scene.state;
        const { text } = ctx.message;

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

        let message = null;

        if (isEdit) {
            await carDBService.update({ _id: data._id }, data);

            message = messages.editCar(user.lang);
        } else {
            ctx.scene.state.step++;

            message = messages.addCar(user.lang, ctx.scene.state.step, data);
        }

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    return car;
}

function editPersonal() {
    const personal = new Scene('personal');

    personal.use(middlewares.start);
    personal.use(middlewares.commands);
    //personal.use(middlewares.cb);

    personal.enter(async (ctx) => {
        const user = await userDBService.get({ tg_id: ctx.from.id });

        const message = messages.personal(user.lang, user, null);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    personal.action(/edit-(fullname|phone)/, async (ctx) => {
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

function editEvent() {
    const edit_event = new Scene('edit_event');

    edit_event.use(middlewares.start);
    edit_event.use(middlewares.commands);
    //edit_event.use(middlewares.cb);

    edit_event.enter(async (ctx) => {
        const { user } = ctx.state;

        ctx.scene.state.key = null;
        ctx.scene.state.order = null;
        ctx.scene.state.events = await eventDBService.getAll({
            customer_id: ctx.from.id,
            status: 'not completed',
            start_date: {
                $gt: new Date()
            }
        });

        const message = messages.events(user.lang, ctx.scene.state.events, 0);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    edit_event.action(/evnt-([0-9a-z]+)/, async (ctx) => {
        const { user } = ctx.state;
        const { message_id } = ctx.update.callback_query.message;

        const _id = ctx.match[1];

        ctx.scene.state.data = await eventDBService.get({ _id });
        ctx.scene.state.data.reminded = [];

        if (ctx.scene.state.data) {
            const message = messages.editEvent(user.lang, ctx.scene.state.data, message_id);

            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        } else {
            await ctx.scene.leave();
        }
    });

    edit_event.action(/edit-(car|location|date)/, async (ctx) => {
        const { user } = ctx.state;
        const { message_id } = ctx.update.callback_query.message;

        const key = ctx.match[1];

        let message = null;

        ctx.scene.state.key = key;

        if (key === 'car') {

        } else if (key === 'location') {
            message = messages.location(user.lang, message_id);
        } else if (key === 'date') {
            message = messages.chooseDate(user.lang, sender.calendar, message_id);
        }

        if (message) {
            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        }
    });

    edit_event.action(/time-([0-9]+)/, async (ctx) => await eventTime(ctx, true));

    edit_event.action(/next-([a-z]+)-([0-9]+)/, async (ctx) => {
        const { user } = ctx.state;
        const { events } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        const page = Number(ctx.match[2]);

        const message = messages.events(user.lang, events, page, message_id);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    edit_event.action('back', async (ctx) => {
        const { user } = ctx.state;
        const {
            key,
            data
        } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        if (key) {
            const message = messages.editEvent(user.lang, data, message_id);

            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        } else {
            await ctx.deleteMessage();
            await ctx.scene.reenter();
        }
    });

    edit_event.on('location', async (ctx) => {
        const { user } = ctx.state;
        const { data } = ctx.scene.state;
        const { location } = ctx.update.message;

        ctx.scene.state.key = null;

        data.location = location;

        console.log(data)

        await calendarService.updateEvent(data.event_id, data);

        const message = messages.editEvent(user.lang, data);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    edit_event.on('text', async (ctx) => {
        const { user } = ctx.state;
        const {
            key,
            data
        } = ctx.scene.state;
        const { text } = ctx.message;

        let message = null;

        if (key === 'location') {
            ctx.scene.state.key = null;

            data.location = text;

            message = messages.editEvent(user.lang, data);

            await calendarService.updateEvent(data.event_id, data);
        }

        if (message) {
            sender.enqueue({
                chat_id: ctx.from.id,
                message
            });
        }
    });

    return edit_event;
}

module.exports = {
    addEvent,
    addCar,
    editPersonal,
    editEvent
}