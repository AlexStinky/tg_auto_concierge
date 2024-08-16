const moment = require('moment-timezone');

const messages = require('./messages');

const { calendarService } = require('../services/calendar');
const { orderDBService } = require('../services/db');
const { sender } = require('../services/sender');

const CHECK_DELAY = 3600000;

const remind = async (events, type) => {
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const _id = event.description.replace('\n', '');

        let msgs = [];

        const order = await orderDBService.get({ _id });

        if (order) {
            if (type === '1hour') {
                msgs = [
                    {
                        chat_id: order.customer_id,
                        message: messages.order('ru', 'remindCustomer1Hour_message', order)
                    },
                    {
                        chat_id: order.driver_id,
                        message: messages.order('ru', 'remindDriver1Hour_message', order)
                    }
                ];
            } else {
                msgs = [
                    {
                        chat_id: order.customer_id,
                        message: messages.order('ru', 'remindCustomer24Hours_message', order)
                    }
                ];
            }
        }

        msgs.forEach(el => sender.enqueue(el));
    }
};

const check = async () => {
    const timeZone = 'Europe/Lisbon';

    const events1HourDate = moment();
    const events24HoursDate = moment().add(22, 'hours');

    const events1Hour = await calendarService.getEvents(events1HourDate, timeZone, 1);
    const events24Hours = await calendarService.getEvents(events24HoursDate, timeZone, 1);

    console.log(events1Hour, events24Hours)

    remind(events1Hour, '1hour');
    remind(events24Hours, '24hours');

    setTimeout(check, CHECK_DELAY);
}

module.exports = {
    check
}