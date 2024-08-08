const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ServiceSchema = new Schema({
    title: {
        type: String,
        default: '_'
    },
    date: {
        type: Date,
        default: Date.now
    }
}, { versionKey: false });

const Service = mongoose.model('Service', ServiceSchema);

module.exports = {
    Service
}