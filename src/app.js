const express = require('express');
const morgan = require('morgan');
const webhook_roter = require('./routes/webhook');
const app = express();

app.use(express.json());

app.use(morgan('dev'));

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'WhatsApp API is running smoothly' });
});

app.use('/webhook', webhook_roter);

module.exports = app;