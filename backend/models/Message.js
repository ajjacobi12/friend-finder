// backend/models/Message.js
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    msgID: { type: String, required: true, unique: true },
    chatRoomID: { type: String, required: true },
    senderUUID: { type: String, required: true },
    text: { type: String, default: null },
    isEncrypted: { type: Boolean, default: false },
    version: { type: String, default: "1.0" },
    serverTimestamp: { type: Number, default: Date.now },
    isEdited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false }
});

module.exports = mongoose.model('Message', MessageSchema);