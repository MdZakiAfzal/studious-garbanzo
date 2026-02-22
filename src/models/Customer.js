const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    clientId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Client', 
        required: true 
    }, // Links this shopper to a specific boutique
    whatsappNumber: { 
        type: String, 
        required: true 
    },
    name: { 
        type: String, 
        default: 'Guest' 
    },
    tier: { 
        type: String, 
        enum: ['new', 'regular', 'vip'], 
        default: 'new' 
    }, // Crucial for your Targeted Broadcast feature
    lastInteracted: { 
        type: Date, 
        default: Date.now 
    }
}, { timestamps: true });

// Ensure a phone number is only saved once per boutique
customerSchema.index({ clientId: 1, whatsappNumber: 1 }, { unique: true });

module.exports = mongoose.model('Customer', customerSchema);