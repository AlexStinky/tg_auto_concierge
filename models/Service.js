const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ServiceSchema = new Schema({
    tg_id: {
        type: String,
        required: true
    },
    title: {
        type: String,
        default: '_'
    },
    date: {
        type: Date,
        default: Date.now
    },
    limits: {
        type: Number,
        default: 10
    }
}, { versionKey: false });

const Service = mongoose.model('Service', ServiceSchema);

module.exports = {
    Service
}