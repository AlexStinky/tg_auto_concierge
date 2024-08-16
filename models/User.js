const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    tg_id: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    tg_username: {
        type: String,
        required: true
    },
    lang: {
        type: String,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    start_date: {
        type: Date,
        default: Date.now
    },
    sub_end_date: {
        type: Date
    },
    status: {
        type: String,
        default: 'free' // free, subscription, driver
    },
    fullname: {
        type: String,
        default: ''
    },
    phone: {
        type: String,
        default: ''
    },
    time_zone: {
        type: String,
        default: 'Europe/Lisbon'
    },
    calendar_id: {
        type: String
    }
}, { versionKey: false });

const User = mongoose.model('User', UserSchema);

module.exports = {
    User
}