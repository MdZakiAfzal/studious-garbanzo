const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
    businessName: { 
        type: String, 
        required: true 
    },
    phoneNumberId: { 
        type: String, 
        required: true, 
        unique: true 
    }, // Meta's unique ID for the boutique's phone number
    accessToken: { 
        type: String, 
        required: true 
    }, // Meta's access token for API authentication
    catalogId: { 
        type: String, 
        default: null 
    }, // Optional: Meta's unique ID for the boutique's product catalog
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);