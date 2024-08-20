const moment = require('moment-timezone');

const { google } = require('googleapis');

const messages = require('../scripts/messages');

const {
    userDBService,
    eventDBService
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

    getDate(date, timeZone, hours = 0) {
        console.log('getDate', date)
        const start_date = moment(date).tz(timeZone);
        const end_date = moment(date).tz(timeZone).add(hours, 'hours');

        console.log('getDate', start_date, end_date)

        return {
            start_date,
            end_date
        };
    }

    async notification(data, key) {
        const driver = await userDBService.get({ tg_id: data.driver_id });

        if (driver) {
            const message = messages.event(driver.lang, key, data);
            message.extra = {};

            sender.enqueue({
                chat_id: driver.tg_id,
                message
            });
        }
    }

    async getCalendars() {
        const calendars = await this.calendar.calendarList.list();
        console.log(calendars.data.items);
    }

    async getEvents(date, timeZone, hours, calendarId = process.env.GOOGLE_EMAIL, maxResults = 100) {
        try {
            const {
                start_date,
                end_date
            } = this.getDate(date, timeZone, hours);

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

    async addEvent(data, calendarId = process.env.GOOGLE_EMAIL) {
        const start = data.start_date.toISOString();
        const end = data.end_date.toISOString();

        const event = await eventDBService.create(data);
        const resource = {
            summary: data.service,
            location: data.location,
            description: event._id,
            start: {
                dateTime: start,
                timeZone: data.time_zone
            },
            end: {
                dateTime: end,
                timeZone: data.time_zone
            }
        };

        console.log(resource)

        try {
            const eventRes = await this.calendar.events.insert({
                calendarId,
                resource
            });

            await eventDBService.update({ _id: event._id }, { event_id: eventRes.data.id });

            await this.notification(data, 'newOrder_message');

            return eventRes.data.htmlLink;
        } catch (err) {
            console.error('[add] The API returned an error:', err.errors ? err.errors : err);
        }

        return null;
    }

    async updateEvent(eventId, data, calendarId = process.env.GOOGLE_EMAIL) {
        const start = data.start_date.toISOString();
        const end = data.end_date.toISOString();

        const requestBody = {
            summary: data.service,
            location: data.location,
            description: data._id,
            start: {
                dateTime: start,
                timeZone: data.time_zone
            },
            end: {
                dateTime: end,
                timeZone: data.time_zone
            }
        };

        try {
            const response = await this.calendar.events.update({
                calendarId,
                eventId,
                requestBody
            });

            await eventDBService.update({ _id: data._id }, data);

            await this.notification(data, 'updateOrder_message');
      
            console.log('Event updated successfully:', response.data);
        } catch (error) {
            console.error('Error updating event:', error);
        }
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