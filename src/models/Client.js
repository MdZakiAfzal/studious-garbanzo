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
    wabaId: { type: String, required: true },
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
    },
    // --- THE DYNAMIC BRAIN ---
    botFlow: [{ type: mongoose.Schema.Types.Mixed }]
    /*botFlow: [{
        trigger: { type: String, required: true }, // e.g., "DEFAULT", "pricing", "btn_support"
        responseType: { 
            type: String, 
            enum: ['text', 'image', 'button', 'list', 'carousel', 'location'], 
            required: true 
        },
        
        // Used for Text, Image Captions, and the main body of Buttons/Lists
        messageText: String, 
        
        // Used ONLY for 'image' type
        mediaUrl: String, 
        
        // Used ONLY for 'button' type (Max 3 buttons)
        buttons: [{ 
            id: String, 
            title: String 
        }], 

        // Used ONLY for 'list' type (Max 10 rows total)
        listMenuText: String, // The text on the actual menu button (e.g., "View Options")
        listSections: [{
            title: String, // e.g., "Main Courses"
            rows: [{ 
                id: String, 
                title: String, 
                description: String 
            }]
        }]
    }]*/
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);