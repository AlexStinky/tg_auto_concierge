const moment = require('moment-timezone');

const messages = require('./messages');

const { calendarService } = require('../services/calendar');
const { eventDBService } = require('../services/db');
const { sender } = require('../services/sender');

const remind = async (events, type) => {
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const _id = event.description.replace('\n', '');

        let msgs = [];

        const event_db = await eventDBService.get({ _id });

        if (event_db) {
            if (type === '1hour') {
                msgs = [
                    {
                        chat_id: event_db.customer_id,
                        message: messages.event('ru', 'remindCustomer1Hour_message', event_db)
                    },
                    {
                        chat_id: event_db.driver_id,
                        message: messages.event('ru', 'remindDriver1Hour_message', event_db)
                    }
                ];
            } else {
                msgs = [
                    {
                        chat_id: event_db.customer_id,
                        message: messages.event('ru', 'remindCustomer24Hours_message', event_db)
                    }
                ];
            }
        }

        msgs.forEach(el => sender.enqueue(el));
    }
};

const check = async () => {
    const timeZone = 'Europe/Lisbon';

    const events1HourDate = moment().add(1, 'hours');
    const events24HoursDate = moment().add(23, 'hours');

    const events1Hour = await calendarService.getEvents(events1HourDate, timeZone, 1);
    const events24Hours = await calendarService.getEvents(events24HoursDate, timeZone, 1);

    console.log(events1Hour, events24Hours)

    //remind(events1Hour, '1hour');
    //remind(events24Hours, '24hours');

    const now = moment();
    const nextChecking = moment();
    nextChecking.add(1, 'hours');
    nextChecking.minutes(0);

    const delay = nextChecking - now;

    setTimeout(check, delay);
}

module.exports = {
    check
}