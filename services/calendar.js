const moment = require('moment');

const { google } = require('googleapis');

const messages = require('../scripts/messages');

const {
    userDBService,
    orderDBService
} = require('./db');
const { sender } = require('./sender');

class Calendar {
    constructor() {
        this.JWT = new google.auth.JWT(
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            null,
            process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            [
                'https://www.googleapis.com/auth/calendar',
                'https://www.googleapis.com/auth/calendar.events'
            ]
        );

        this.calendar = google.calendar({ version: 'v3', auth: this.JWT });
    }

    getDate(date, hours) {
        const start_date = moment(date);
        const end_date = moment(date).add(hours, 'hours');

        return {
            start_date,
            end_date
        };
    }

    async getCalendars() {
        const calendars = await this.calendar.calendarList.list();
        console.log(calendars.data.items);
    }

    async getEvents(start_date, end_date, calendarId = process.env.GOOGLE_EMAIL, maxResults = 100) {
        try {
            /*const {
                start_date,
                end_date
            } = this.getDate(date, hours);

            console.log(start_date, end_date)*/
            console.log(start_date, end_date)

            const res = await this.calendar.events.list({
                calendarId,
                timeMin: start_date.toISOString(),
                timeMax: end_date.toISOString(),
                maxResults,
                singleEvents: true,
                orderBy: 'startTime',
            });
        
            const events = res.data.items;

            if (events.length) {
                return events;
            }
        } catch (err) {
            console.error('[getEvents] The API returned an error:', err.errors ? err.errors : err);
        }

        return [];
    }

    async getBusy(startDate, endDate, id = process.env.GOOGLE_EMAIL) {
        try {
            const res = await this.calendar.freebusy.query({
                requestBody: {
                    timeMin: startDate.toISOString(),
                    timeMax: endDate.toISOString(),
                    items: [{ id }]
                }
            });

            console.log(res.data)

            const busyTimes = res.data.calendars[id].busy;

            if (busyTimes.length) {
                return busyTimes;
            }
        } catch (err) {
            console.error('[get] The API returned an error:', err.errors ? err.errors : err);
        }

        return null;
    }

    async addEvent(data, calendarId = process.env.GOOGLE_EMAIL) {
        const start = data.start_date.toISOString();
        const end = data.end_date.toISOString();

        const order = await orderDBService.create(data);
        const resource = {
            summary: data.summary,
            location: data.location,
            description: order._id,
            start: {
                dateTime: start,
                timeZone: 'UTC'
            },
            end: {
                dateTime: end,
                timeZone: 'UTC'
            }
        };

        console.log(resource)

        try {
            const eventRes = await this.calendar.events.insert({
                calendarId,
                resource
            });
            const driver = await userDBService.get({ tg_id: data.driver_id });

            if (driver) {
                const message = messages.order(driver.lang, 'newOrder_message', data);
                message.extra = {};

                sender.enqueue({
                    chat_id: driver.tg_id,
                    message
                });

                return eventRes.data.htmlLink;
            }
        } catch (err) {
            console.error('[add] The API returned an error:', err.errors ? err.errors : err);
        }

        return null;
    }

    async deleteEvent(eventId, calendarId = process.env.GOOGLE_EMAIL) {
        try {
            await this.calendar.events.delete({
                calendarId,
                eventId
            });
        } catch (err) {
            console.error('[delete] The API returned an error::', err.errors ? err.errors : err);
        }
      }
}

const calendarService = new Calendar();

module.exports = {
    calendarService
}