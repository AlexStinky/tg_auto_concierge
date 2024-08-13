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
                console.log(events)

                for (let i = 0; i < events.length; i++) {
                    const event = events[i];

                    await this.deleteEvent(event.id);
                }

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

    async addEvent(data) {
        const resource = {
            'summary': 'Google I/O 2015',
            'location': '800 Howard St., San Francisco, CA 94103',
            'description': 'A chance to hear more about Google\'s developer products.',
            'start': {
              'dateTime': '2024-08-28T09:00:00-07:00',
              'timeZone': 'America/Los_Angeles',
            },
            'end': {
              'dateTime': '2024-08-28T17:00:00-07:00',
              'timeZone': 'America/Los_Angeles',
            }
        };

        console.log(resource)

        try {
            const eventRes = await this.calendar.events.insert({
                auth: this.JWT,
                calendarId: 'primary', // d94a179fb2cafb7de4dac921f2c0af4c56e797dc1110c1712ad3deef4bc25054@group.calendar.google.com
                resource
            });

            return eventRes.data.htmlLink;
        } catch (err) {
            console.error('[add] The API returned an error:', err.errors ? err.errors : err);
        }

        return null;
    }

    async deleteEvent(eventId) {
        try {
            await this.calendar.events.delete({
                calendarId: 'primary',
                eventId
            });
        } catch (err) {
            console.error('[delete] The API returned an error::', err.errors ? err.errors : err);
        }
      }
}

const calendarService = new Calendar();
calendarService.getEvents();

module.exports = {
    calendarService
}