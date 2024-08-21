const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const EventSchema = new Schema({
    customer_id: {
        type: String
    },
    driver_id: {
        type: String
    },
    service_id: {
        type: String
    },
    event_id: {
        type: String
    },
    status: {
        type: String,
        default: 'not completed' // not completed, completed
    },
    creation_date: {
        type: Date,
        default: Date.now
    },
    start_date: {
        type: Date
    },
    end_date: {
        type: Date
    },
    fullname: {
        type: String
    },
    phone: {
        type: String
    },
    service: {
        type: String
    },
    car: {
        type: String
    },
    location: {
        type: Object || String
    },
    time_zone: {
        type: String
    },
    duration_time: {
        type: Number
    },
    before_time: {
        type: Number
    },
    reminded: {
        type: Array,
        default: []
    }
}, { versionKey: false });

const Event = mongoose.model('Event', EventSchema);

module.exports = {
    Event
}