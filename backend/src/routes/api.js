const express = require('express');
const router = express.Router();
const chatController = require('../controllers/ChatController');

router.post('/chat', chatController.sendMessage);
router.get('/history', chatController.getHistory);
router.get('/conversation/:id', chatController.getConversation);

module.exports = router;
