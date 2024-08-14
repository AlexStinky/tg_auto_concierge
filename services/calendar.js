const { google } = require('googleapis');
const moment = require('moment');

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

    async getCalendars() {
        const calendars = await this.calendar.calendarList.list();
        console.log(calendars.data.items);
    }

    async getEvents(calendarId = 'primary', maxResults = 100) {
        try {
            const res = await this.calendar.events.list({
                calendarId,
                timeMin: new Date().toISOString(),
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

        return null;
    }

    async getBusy(days = 30) {
        try {
            const res = await this.calendar.freebusy.query({
                requestBody: {
                    timeMin: new Date().toISOString(),
                    timeMax: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
                    items: [{ id: 'primary' }]
                }
            });

            const busyTimes = res.data.calendars.primary.busy;

            console.log(busyTimes)

            if (busyTimes.length) {
                return busyTimes;
            }
        } catch (err) {
            console.error('[get] The API returned an error:', err.errors ? err.errors : err);
        }

        return null;
    }

    async addEvent(calendarId = 'primary', data) {
        const resource = {
            summary: data.summary,
            location: data.location,
            description: data.description,
            start: {
                dateTime: data.startTime.toISOString(),
                timeZone: 'UTC',
            },
            end: {
                dateTime: data.endTime.toISOString(),
                timeZone: 'UTC',
            }
        };

        console.log(resource)

        try {
            const eventRes = await this.calendar.events.insert({
                calendarId,
                resource
            });

            return eventRes.data.htmlLink;
        } catch (err) {
            console.error('[add] The API returned an error:', err.errors ? err.errors : err);
        }

        return null;
    }

    async deleteEvent(calendarId = 'primary', eventId) {
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
calendarService.getEvents();
calendarService.getCalendars();

module.exports = {
    calendarService
}