const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

router.get('/customers', apiController.getCustomers);
router.post('/clients/register', apiController.registerClient);
router.post('/broadcast', apiController.sendBroadcast);
router.put('/clients/:id/flow', apiController.updateBotFlow);
router.put('/customers/:id/tier', apiController.updateCustomerTier);
router.get('/templates', apiController.getTemplates);

module.exports = router;