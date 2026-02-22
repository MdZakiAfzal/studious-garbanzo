const verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Check if a token and mode were sent
    if (mode && token) {
        // Check the mode and token sent are correct
        if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
            console.log('✅ Webhook verified by Meta!');
            res.status(200).send(challenge);
        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
};

const receiveMessage = async (req, res) => {
    try {
        const body = req.body;

        // Check if this is an event from a WhatsApp API
        if (body.object === 'whatsapp_business_account') {
            
            // Loop over each entry (there may be multiple if batched)
            body.entry.forEach(function(entry) {
                const changes = entry.changes[0];
                const value = changes.value;

                // Check if the payload contains a message
                if (value.messages && value.messages[0]) {
                    const message = value.messages[0];
                    const boutiquePhoneId = value.metadata.display_phone_number;
                    const customerPhone = message.from;

                    console.log(`📥 New Message from ${customerPhone} to Client: ${boutiquePhoneId}`);
                    console.log(`💬 Message Type: ${message.type}`);
                    
                    // We will inject the MongoDB/Redis logic here in the next step!
                }
            });

            // Return a '200 OK' response to all requests instantly
            res.status(200).send('EVENT_RECEIVED');
        } else {
            // Return a '404 Not Found' if event is not from a WhatsApp API
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        res.sendStatus(500);
    }
};

module.exports = {
    verifyWebhook,
    receiveMessage
};