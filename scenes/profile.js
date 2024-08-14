const Scene = require('telegraf/scenes/base');

const middlewares = require('../scripts/middlewares');
const messages = require('../scripts/messages');

const {
    userDBService,
    carDBService,
    serviceDBService,
    orderDBService
} = require('../services/db');
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
            status: 'completed',
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
            customer_id: user.tg_id
        };
        ctx.scene.state.services = await getServices();
        ctx.scene.state.cars = await carDBService.getAll({ tg_id: user.tg_id });

        const message = messages.services(user.lang, temp, 1);

        sender.enqueue({
            chat_id: ctx.from.id,
            message
        });
    });

    order.action(/(srv|car)-([a-z0-9]+)/, async (ctx) => {
        const { user } = ctx.state;
        const { cars } = ctx.scene.state;
        const { message_id } = ctx.update.callback_query.message;

        const key = ctx.match[1];
        const id = ctx.match[2];

        let message = null;

        if (key === 'srv') {
            ctx.scene.state.order.service_id = id;

            message = messages.cars(user.lang, cars, 1, message_id);
        } else if (key === 'car') {
            ctx.scene.state.order.car_id = id;
            ctx.scene.state.order.driver_id = id;

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

    order.on('text', async (ctx) => {
        const { user } = ctx.state;
        const {
            step,
            order
        } = ctx.scene.state;

        let message = null;

        if (step === 2) {
            /*const service = await serviceDBService.get({ _id: order.service_id });
            const car = await carDBService.get({ _id: order.car_id });
            const temp = {
                service: service.title,
                car: car.brand + ' ' + car.model,
                location: order.location,
                startDate: order.start_date.toLocaleDateString('ru-RU'),
                endDate: order.end_date.toLocaleDateString('ru-RU')
            };
            message = messages.checkOrder(user.lang, order);*/
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