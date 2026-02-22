// src/routes/webhook.js
const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// GET request for Meta to verify your server
router.get('/', webhookController.verifyWebhook);

// POST request for Meta to send WhatsApp messages
router.post('/', webhookController.receiveMessage);

module.exports = router;