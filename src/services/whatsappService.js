const axios = require('axios');

// A generic function to hit the Meta Graph API
const sendToMeta = async (phoneNumberId, accessToken, to, messagePayload) => {
    try {
        const response = await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
            data: {
                messaging_product: 'whatsapp',
                to: to,
                ...messagePayload // Spreads the specific message type (text, interactive, etc.)
            },
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        // This will print the exact reason Meta rejected the request
        if (error.response && error.response.data && error.response.data.error) {
            console.error('❌ Meta API Error Detail:', JSON.stringify(error.response.data.error, null, 2));
        } else {
            console.error('❌ Meta API General Error:', error.message);
        }
        throw error;
    }   
};

// ----------------------------------------------------
// THE OMNI-SENDER ENGINE (Text, Image, Button, List)
// ----------------------------------------------------
const sendDynamicMessage = async (phoneNumberId, accessToken, to, rule) => {
    let payload = {};

    switch (rule.responseType) {
        case 'text':
            payload = {
                type: 'text',
                text: { body: rule.messageText }
            };
            break;

        case 'image':
            payload = {
                type: 'image',
                image: { 
                    link: rule.mediaUrl,
                    caption: rule.messageText || '' // Optional text below the image
                }
            };
            break;

        case 'button':
            const formattedButtons = rule.buttons.map(btn => ({
                type: 'reply',
                reply: { id: btn.id, title: btn.title }
            }));
            
            payload = {
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: { text: rule.messageText },
                    action: { buttons: formattedButtons }
                }
            };

            // 👇 INJECT THE IMAGE HEADER IF IT EXISTS 👇
            if (rule.mediaUrl) {
                payload.interactive.header = {
                    type: 'image',
                    image: { link: rule.mediaUrl }
                };
            }
            break;

        case 'list':
            const formattedSections = rule.listSections.map(section => ({
                title: section.title,
                rows: section.rows.map(row => ({
                    id: row.id,
                    title: row.title,
                    description: row.description || ''
                }))
            }));

            payload = {
                type: 'interactive',
                interactive: {
                    type: 'list',
                    body: { text: rule.messageText },
                    action: {
                        button: rule.listMenuText || 'View Menu',
                        sections: formattedSections
                    }
                }
            };
            break;
        case 'location':
            // 1. Log exactly what the database gave us so you can debug later
            console.log("📍 DEBUG - Rule from DB:", rule);

            // 2. THE DEMO SAVIOR: If DB is empty, force the WSS Couture coordinates
            const finalLat = rule.latitude ? parseFloat(rule.latitude) : 22.7051;
            const finalLng = rule.longitude ? parseFloat(rule.longitude) : 75.8647;

            payload = {
                type: 'location',
                location: {
                    latitude: finalLat,
                    longitude: finalLng,
                    name: rule.locationName || "WSS Couture Studio",
                    address: rule.locationAddress || "22-B Prem Nagar, Manik Bagh Road, Indore, MP 452010"
                }
            };
            break;

        case 'carousel':
            payload = {
                type: 'interactive',
                interactive: {
                    type: 'carousel',
                    body: {
                        text: rule.messageText || "✨ Swipe to explore our collections"
                    },
                    action: {
                        cards: rule.cards.map((card, index) => ({
                            card_index: index,
                            type: 'cta_url', // 👈 Matching Meta's official docs exactly
                            header: {
                                type: 'image',
                                image: { link: card.imageUrl }
                            },
                            body: {
                                text: card.text
                            },
                            action: {
                                // Formatting the quick reply buttons exactly per the cURL snippet
                                buttons: card.buttons.map(btn => ({
                                    type: 'quick_reply',
                                    quick_reply: {
                                        id: btn.id,
                                        title: btn.title
                                    }
                                }))
                            }
                        }))
                    }
                }
            };
            break;
        case 'address':
            // Drops the Native WhatsApp Address Form
            payload = {
                type: 'interactive',
                interactive: {
                    type: 'address_message',
                    body: {
                        text: rule.messageText || "Please provide your delivery address."
                    },
                    action: {
                        name: 'address_message',
                        parameters: {
                            country: rule.country || "IN" // Defaulting to India for WSS Couture
                        }
                    }
                }
            };
            break;
        default:
            throw new Error(`Unsupported responseType: ${rule.responseType}`);
    }

    return await sendToMeta(phoneNumberId, accessToken, to, payload);
};

// A generic function for sending plain text messages
const sendTextMessage = async (phoneNumberId, accessToken, to, text) => {
    const textPayload = {
        type: 'text',
        text: {
            body: text
        }
    };
    return await sendToMeta(phoneNumberId, accessToken, to, textPayload);
};

// A generalized template sender (Handles plain text templates OR image templates)
const sendTemplateMessage = async (phoneNumberId, accessToken, to, templateName, languageCode = 'en_US', mediaUrl = null) => {
    
    const templatePayload = {
        type: 'template',
        template: {
            name: templateName,
            language: { code: languageCode }
        }
    };

    // If the broadcast includes an image, dynamically attach the header component
    if (mediaUrl) {
        templatePayload.template.components = [
            {
                type: 'header',
                parameters: [
                    {
                        type: 'image',
                        image: { link: mediaUrl }
                    }
                ]
            }
        ];
    }

    return await sendToMeta(phoneNumberId, accessToken, to, templatePayload);
};

module.exports = { sendDynamicMessage, sendTextMessage, sendTemplateMessage };