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
        required: false,
        default: '',
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
        default: 'free'
    },
    phone: {
        type: Number
    }
}, { versionKey: false });

const User = mongoose.model('User', UserSchema);

module.exports = {
    User
}