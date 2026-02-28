const Customer = require('../models/Customer');
const Client = require('../models/Client');
const { sendTextMessage, sendTemplateMessage } = require('../services/whatsappService');
const axios = require('axios');

// GET /api/customers - Fetches the tiered database for the dashboard
const getCustomers = async (req, res) => {
    try {
        // In the real app, we get the Client ID from the logged-in user's JWT token.
        // For the MVP, we will just grab the first client in the database.
        const client = await Client.findOne(); 

        if (!client) {
            return res.status(404).json({ error: 'No client found' });
        }

        const customers = await Customer.find({ clientId: client._id }).sort({ lastInteracted: -1 });
        
        res.status(200).json({
            success: true,
            count: customers.length,
            data: customers
        });
    } catch (error) {
        console.error('❌ API Error:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// POST /api/clients/register - Onboards a new business into your SaaS
const registerClient = async (req, res) => {
    try {
        const { businessName, phoneNumberId, wabaId, accessToken } = req.body;

        // 1. Validate incoming data
        if (!businessName || !phoneNumberId || !wabaId || !accessToken) {
            return res.status(400).json({ 
                success: false, 
                error: 'Please provide businessName, phoneNumberId, wabaId, and accessToken' 
            });
        }

        // 2. Prevent duplicates
        let existingClient = await Client.findOne({ phoneNumberId });
        if (existingClient) {
            return res.status(400).json({ 
                success: false, 
                error: 'A business with this WhatsApp Phone ID is already registered' 
            });
        }

        // 3. Save to Tiered Database
        const newClient = await Client.create({
            businessName,
            phoneNumberId,
            accessToken,
            wabaId
        });

        console.log(`🏢 New Client Registered: ${businessName}`);

        res.status(201).json({
            success: true,
            data: {
                id: newClient._id,
                businessName: newClient.businessName,
                phoneNumberId: newClient.phoneNumberId,
                wabaId: newClient.wabaId
            }
        });
    } catch (error) {
        console.error('❌ API Error (registerClient):', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// POST /api/broadcast - Blasts a template or text message to a tier
const sendBroadcast = async (req, res) => {
    try {
        const { clientId, tier, broadcastType, messageText, templateName, mediaUrl, languageCode } = req.body;

        if (!clientId) return res.status(400).json({ success: false, error: 'Missing clientId' });

        const client = await Client.findById(clientId);
        if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

        const query = { clientId: client._id };
        if (tier && tier !== 'all') query.tier = tier;

        const targetAudience = await Customer.find(query);
        if (targetAudience.length === 0) return res.status(404).json({ success: false, error: 'No customers found' });

        console.log(`📣 Broadcasting to ${targetAudience.length} customers. Type: ${broadcastType || 'text'}`);

        let successCount = 0;
        let failCount = 0;

        for (const customer of targetAudience) {
            try {
                if (broadcastType === 'template') {
                    // Send an approved template
                    await sendTemplateMessage(
                        client.phoneNumberId, 
                        client.accessToken, 
                        customer.whatsappNumber, 
                        templateName, 
                        languageCode || 'en_US',
                        mediaUrl
                    );
                } else {
                    // Send standard text (Only works if 24hr window is open)
                    await sendTextMessage(client.phoneNumberId, client.accessToken, customer.whatsappNumber, messageText);
                }
                successCount++;
            } catch (err) {
                failCount++;
                console.error(`❌ Failed to send to ${customer.whatsappNumber}. Reason:`, err.response?.data?.error || err.message);
            }
        }

        res.status(200).json({
            success: true,
            message: 'Broadcast complete',
            stats: { total: targetAudience.length, success: successCount, failed: failCount }
        });

    } catch (error) {
        console.error('❌ API Error (sendBroadcast):', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// PUT /api/clients/:id/flow - Updates the dynamic chatbot rules for a specific client
const updateBotFlow = async (req, res) => {
    try {
        const clientId = req.params.id;
        const { botFlow } = req.body; // Expecting an array of rules

        if (!Array.isArray(botFlow)) {
            return res.status(400).json({ success: false, error: 'botFlow must be an array of rules' });
        }

        // Find the client and update their flow
        const updatedClient = await Client.findByIdAndUpdate(
            clientId,
            { botFlow: botFlow },
            { new: true, runValidators: true } // runValidators ensures the new schema rules are enforced
        );

        if (!updatedClient) {
            return res.status(404).json({ success: false, error: 'Client not found' });
        }

        console.log(`🧠 Updated Bot Flow for Client: ${updatedClient.businessName}`);

        res.status(200).json({
            success: true,
            message: 'Bot flow updated successfully',
            data: updatedClient.botFlow
        });

    } catch (error) {
        console.error('❌ API Error (updateBotFlow):', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// PUT /api/customers/:id/tier - Upgrades or downgrades a customer's tier
const updateCustomerTier = async (req, res) => {
    try {
        const customerId = req.params.id;
        const { tier } = req.body;

        // 1. Validate the input to ensure bad data doesn't corrupt the DB
        const validTiers = ['new', 'regular', 'vip'];
        if (!tier || !validTiers.includes(tier)) {
            return res.status(400).json({ 
                success: false, 
                error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` 
            });
        }

        // 2. Update the customer in MongoDB
        const updatedCustomer = await Customer.findByIdAndUpdate(
            customerId,
            { tier: tier },
            { new: true, runValidators: true }
        );

        if (!updatedCustomer) {
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }

        console.log(`⭐ Customer ${updatedCustomer.whatsappNumber} tier updated to: ${tier}`);

        res.status(200).json({
            success: true,
            message: 'Tier updated successfully',
            data: updatedCustomer
        });

    } catch (error) {
        console.error('❌ API Error (updateCustomerTier):', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// GET /api/templates?clientId=YOUR_CLIENT_ID - Fetches approved templates from Meta
const getTemplates = async (req, res) => {
    try {
        const { clientId } = req.query;

        if (!clientId) {
            return res.status(400).json({ success: false, error: 'Missing clientId query parameter' });
        }

        const client = await Client.findById(clientId);
        if (!client || !client.wabaId) {
            return res.status(404).json({ success: false, error: 'Client or WABA ID not found' });
        }

        // Call the Meta Graph API to get the templates
        const response = await axios({
            method: 'GET',
            url: `https://graph.facebook.com/v18.0/${client.wabaId}/message_templates`,
            headers: {
                'Authorization': `Bearer ${client.accessToken}`
            }
        });

        // Meta returns a lot of data. Let's filter only the ones that are approved and ready to send.
        const approvedTemplates = response.data.data
            .filter(template => template.status === 'APPROVED')
            .map(template => ({
                id: template.id,
                name: template.name,
                language: template.language,
                category: template.category,
                mediaUrl: template.components?.find(c => c.type === 'MEDIA')?.media?.url || null // Extract media URL if it exists
            }));

        res.status(200).json({
            success: true,
            count: approvedTemplates.length,
            data: approvedTemplates
        });

    } catch (error) {
        console.error('❌ API Error (getTemplates):', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch templates from Meta' });
    }
};

module.exports = {
    getCustomers,
    registerClient,
    sendBroadcast,
    updateBotFlow,
    updateCustomerTier,
    getTemplates
};