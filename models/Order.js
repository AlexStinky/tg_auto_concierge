const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OrderSchema = new Schema({
    service_id: {
        type: String
    },
    customer_id: {
        type: String
    },
    driver_id: {
        type: String
    },
    cat_id: {
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
    location: {
        type: String
    }
}, { versionKey: false });

const Order = mongoose.model('Order', OrderSchema);

module.exports = {
    Order
}