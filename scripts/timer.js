const moment = require('moment-timezone');

const messages = require('./messages');

const { calendarService } = require('../services/calendar');
const { eventDBService } = require('../services/db');
const { sender } = require('../services/sender');

const CHECK_DELAY = 1800000;

const remind = async (events, type) => {
    for (let i = 0; i < events.length; i++) {
        const _id = events[i].description.replace('\n', '');

        let msgs = [];

        const event = await eventDBService.get({ _id });

        if (event && !event.reminded.includes(type)) {
            if (type === '1hour') {
                msgs = [
                    {
                        chat_id: event.customer_id,
                        message: messages.event('ru', 'remindCustomer1Hour_message', event)
                    },
                    {
                        chat_id: event.driver_id,
                        message: messages.event('ru', 'remindDriver1Hour_message', event)
                    }
                ];
            } else {
                msgs = [
                    {
                        chat_id: event.customer_id,
                        message: messages.event('ru', 'remindCustomer24Hours_message', event)
                    }
                ];
            }

            await eventDBService.update({ _id }, { $addToSet: { reminded: type } });
        }

        msgs.forEach(el => sender.enqueue(el));
    }
};

const check = async () => {
    const timeZone = 'Europe/Lisbon';

    const events1Start = moment().tz(timeZone).add(1, 'hours');
    const events1End = moment(events1Start).add(1, 'minutes');

    const events24Start = moment().tz(timeZone).add(23, 'hours');
    const events24End = moment(events24Start).add(1, 'minutes');

    const events1Hour = await calendarService.getEvents(events1Start, events1End);
    const events24Hours = await calendarService.getEvents(events24Start, events24End);

    remind(events1Hour, '1hour');
    remind(events24Hours, '24hours');

    setTimeout(check, CHECK_DELAY);
}

module.exports = {
    check
}