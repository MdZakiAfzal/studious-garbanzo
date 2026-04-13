const { sendDynamicMessage, sendTextMessage } = require('../services/whatsappService');
const Customer = require('../models/Customer');
const Client = require('../models/Client');

// Add this to the very top of webhookController.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // Put your key in .env

// The AI Brain Function
// The Upgraded AI Brain Function (JSON Router)
const askAI = async (userQuestion, businessName, botFlow) => {
    try {
        // Force Gemini to strictly output JSON
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" } 
        });
        
        // 1. Map the available flows so the AI knows what it can trigger
        const availableFlows = botFlow.map(rule => {
            // If the rule has no text (like a map or carousel), give the AI a generic description
            const description = rule.messageText || rule.locationName || "Interactive Visual Menu";
            return `- ID: "${rule.trigger}" | Description: ${description.substring(0, 100).replace(/\n/g, ' ')}`;
        }).join('\n');

        // 2. The System Prompt
        // 2. The System Prompt (Tailored for WSS Couture)
        const prompt = `
            You are a smart, luxurious styling assistant for WSS Couture (also known as we_sewsexy) on WhatsApp.
            The user just said: "${userQuestion}"
            
            BUSINESS KNOWLEDGE:
            - Brand: WSS Couture, a customisation-only clothing brand established in 2016.
            - Model: "You design, we create." Made-to-order luxury apparel.
            - Location: 22-B Prem Nagar, Manik Bagh road, Indore, MP 452010.
            - Hours: Strictly "By Appointment Only" from Monday to Saturday. Closed on Sundays.
            - Contact: Calls on 8815874745. Email: wesewsexy2@gmail.com.
            
            You have the ability to trigger these specific automated interactive menus:
            ${availableFlows}
            (Note: The ID "DEFAULT" always opens the main Welcome Menu).
            
            STRICT RULES:
            1. Write a friendly, elegant 1-sentence reply using an emoji (like ✨, 👗, or 🤍).
            2. Match Intent: If the user's request clearly matches one of our automated menus, set "triggerId" to that exact ID.
            3. ANTI-HALLUCINATION PROTOCOL: You must NEVER guess prices, fabrics, delivery times, or policies. If the user asks a question where the answer is NOT 100% found in the BUSINESS KNOWLEDGE above, you MUST respond with a variation of: "I don't have the exact details on that, but our senior styling team would love to help!" AND you MUST set "triggerId" to "DEFAULT" to instantly show them the menu.
            4. If it's just a casual greeting or a "thank you", reply politely and set "triggerId" to null.
            
            OUTPUT STRICTLY IN THIS JSON FORMAT:
            {
                "replyText": "your friendly response",
                "triggerId": "ID_OR_NULL"
            }
        `;

        const result = await model.generateContent(prompt);
        // Parse the JSON string Gemini returns into a real JavaScript object
        return JSON.parse(result.response.text());

    } catch (error) {
        console.error("🧠 AI Error:", error);
        // THE BULLETPROOF DEMO FALLBACK:
        // If Google rate-limits us, don't show an error. Just act like a standard bot and drop the main menu!
        return { 
            replyText: "I'm experiencing a high volume of requests right now, but I don't want to leave you waiting! ✨ Here is our main menu:", 
            triggerId: "DEFAULT" 
        };
    }
};

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
        const entry = req.body.entry?.[0];
        const changes = entry?.changes?.[0]?.value;

        // 🔍 PINPOINT THE CAROUSEL ERROR HERE:
        if (changes?.statuses) {
            const status = changes.statuses[0];
            console.log(`📡 STATUS UPDATE: [${status.status}] for Message ID: ${status.id}`);
            
            if (status.status === 'failed') {
                console.error("❌ DELIVERY FAILED! Meta says:", JSON.stringify(status.errors, null, 2));
            }
            return res.status(200).send('EVENT_RECEIVED');
        }
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
                    // 3. THE TRAFFIC COP (Text vs Buttons)
                    // ----------------------------------------------------
                    if (message.type === 'interactive') {
                        // THEY CLICKED A BUTTON OR MENU LIST
                        let triggerKeyword = '';
                        if (message.interactive.type === 'button_reply') {
                            triggerKeyword = message.interactive.button_reply.id;
                        } else if (message.interactive.type === 'list_reply') {
                            triggerKeyword = message.interactive.list_reply.id;
                        } else if (message.interactive.type === 'nfm_reply') {
                            // 🚨 THEY SUBMITTED THE ADDRESS FORM!
                            console.log(`📦 Address received from ${customerPhone}!`);
                            
                            // Send the final Order Confirmation
                            const confirmText = "✅ *VIP Order Confirmed!*\n\nWe have received your address. Our styling team will review your details and contact you shortly with fabric swatches. Thank you for choosing WSS Couture! ✨";
                            await sendTextMessage(businessPhoneId, client.accessToken, customerPhone, confirmText);
                            
                            return res.status(200).send('EVENT_RECEIVED'); // Stop here so the AI doesn't reply
                        }

                        console.log(`🔘 User clicked button: "${triggerKeyword}"`);

                        // Find the exact rule and send the Flow
                        let rule = client.botFlow.find(r => r.trigger === triggerKeyword);
                        if (rule) {
                            await sendDynamicMessage(businessPhoneId, client.accessToken, customerPhone, rule);
                        } else {
                            console.log(`🤷 No flow rule found for button: ${triggerKeyword}.`);
                        }

                    } else if (message.type === 'text') {
                        // THEY TYPED FREE TEXT (Send to AI)
                        const userText = message.text.body.trim();
                        const lowerText = userText.toLowerCase();

                        console.log(`💬 User typed: "${userText}"`);

                        // DEMO HACK: If they say 'hi', trigger the Main Menu directly
                        if (['hi', 'hello', 'hey', 'menu'].includes(lowerText)) {
                            let rule = client.botFlow.find(r => r.trigger === 'DEFAULT');
                            if (rule) await sendDynamicMessage(businessPhoneId, client.accessToken, customerPhone, rule);
                            return res.status(200).send('EVENT_RECEIVED'); // Stop here
                        }

                        // --- YOUR AI LOGIC GOES HERE ---
                        // Keep it brief for the demo so it looks like a real assistant
                        // --- YOUR AI LOGIC GOES HERE ---
                        console.log(`🧠 Sending question to AI for ${client.businessName}...`);
                        
                        // Pass the user text, business name, AND the client's flow database
                        const aiResponse = await askAI(userText, client.businessName, client.botFlow);
                        
                        // 1. Send the AI's conversational text first
                        await sendTextMessage(businessPhoneId, client.accessToken, customerPhone, aiResponse.replyText);

                        // 2. If the AI decided to trigger a flow, fire it immediately after the text!
                        if (aiResponse.triggerId) {
                            console.log(`🎯 AI decided to route user to flow: ${aiResponse.triggerId}`);
                            let rule = client.botFlow.find(r => r.trigger === aiResponse.triggerId);
                            if (rule) {
                                await sendDynamicMessage(businessPhoneId, client.accessToken, customerPhone, rule);
                            }
                        }
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