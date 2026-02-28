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

// Sends a pre-approved Meta Template (Can include Images, Variables, and Buttons)
const sendTemplateMessage = async (phoneNumberId, accessToken, to, templateName, languageCode = 'en_US', mediaUrl = null) => {
    
    // Base template structure
    const templatePayload = {
        type: 'template',
        template: {
            name: templateName,
            language: { code: languageCode },
            components: []
        }
    };

    // If you want to send an image in the template header, we inject it here
    if (mediaUrl) {
        templatePayload.template.components.push({
            type: 'header',
            parameters: [
                {
                    type: 'image',
                    image: { link: mediaUrl }
                }
            ]
        });
    }

    return await sendToMeta(phoneNumberId, accessToken, to, templatePayload);
};

module.exports = {
    sendDynamicMessage,
    sendTextMessage,
    sendTemplateMessage 
};