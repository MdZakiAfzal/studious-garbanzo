const { sendDynamicMessage } = require('../services/whatsappService');
const Customer = require('../models/Customer');
const Client = require('../models/Client');

const verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
            console.log('✅ Webhook verified successfully!');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
};

const receiveMessage = async (req, res) => {
    try {
        const body = req.body;

        if (body.object === 'whatsapp_business_account') {
            for (const entry of body.entry) {
                const value = entry.changes[0].value;

                if (value.messages && value.messages[0]) {
                    const message = value.messages[0];
                    const customerPhone = message.from;
                    const businessPhoneId = value.metadata.phone_number_id;
                    const customerName = value.contacts?.[0]?.profile?.name || 'Guest';

                    // 1. Secure Client Lookup
                    const client = await Client.findOne({ phoneNumberId: businessPhoneId });
                    
                    if (!client) {
                        console.warn(`⚠️ Unregistered business phone ID: ${businessPhoneId}. Ignoring message.`);
                        continue;
                    }

                    // 2. Save or Update the Customer
                    await Customer.findOneAndUpdate(
                        { clientId: client._id, whatsappNumber: customerPhone },
                        { 
                            name: customerName,
                            lastInteracted: new Date(),
                            $setOnInsert: { tier: 'new' }
                        },
                        { upsert: true, returnDocument: 'after' }
                    );

                    // ----------------------------------------------------
                    // 3. THE DYNAMIC ROUTER
                    // ----------------------------------------------------
                    let triggerKeyword = '';

                    // Check if they typed text
                    if (message.type === 'text') {
                        triggerKeyword = message.text.body.trim();
                    } 
                    // Check if they clicked a button or list row
                    else if (message.type === 'interactive') {
                        if (message.interactive.type === 'button_reply') {
                            triggerKeyword = message.interactive.button_reply.id;
                        } else if (message.interactive.type === 'list_reply') {
                            triggerKeyword = message.interactive.list_reply.id;
                        }
                    }

                    console.log(`🎯 Incoming Trigger: "${triggerKeyword}" from ${customerPhone}`);

                    // Convert simple greetings to the 'DEFAULT' menu trigger
                    const lowerTrigger = triggerKeyword.toLowerCase();
                    if (['hi', 'hello', 'hey'].includes(lowerTrigger)) {
                        triggerKeyword = 'DEFAULT';
                    }

                    // 4. Find the matching rule in the client's database
                    let rule = client.botFlow.find(r => r.trigger === triggerKeyword);

                    // 5. Fire the Dynamic Response
                    if (rule) {
                        await sendDynamicMessage(businessPhoneId, client.accessToken, customerPhone, rule);
                    } else {
                        console.log(`🤷 No rule found for trigger: ${triggerKeyword}.`);
                    }
                }
            }
            res.status(200).send('EVENT_RECEIVED');
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        res.status(200).send('EVENT_RECEIVED');
    }
};

module.exports = {
    verifyWebhook,
    receiveMessage
};