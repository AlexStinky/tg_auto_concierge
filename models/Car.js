const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CarSchema = new Schema({
    tg_id: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    date: {
        type: Date,
        default: Date.now
    },
    brand: {
        type: String,
        default: '_'
    },
    model: {
        type: String,
        default: '_'
    },
    color: {
        type: String,
        default: '_'
    },
    VIN: {
        type: String,
        default: '_'
    },
    numbers: {
        type: String,
        default: '_'
    },
    registration_number: {
        type: String,
        default: '_'
    },
    techpassport: {
        type: String,
        default: '_'
    }
}, { versionKey: false });

const Car = mongoose.model('Car', CarSchema);

module.exports = {
    Car
}