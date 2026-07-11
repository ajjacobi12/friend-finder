// backend/classes/Message.js

class Message {
    constructor (data) {
        this.msgID = data.msgID;
        this.chatRoomID = data.chatRoomID;
        this.isDM = data.chatRoomID.includes("_");
        this.senderUUID = data.senderUUID;
        this.text = data.text || null;
        this.isEncrypted = data.isEncrypted || false;
        this.version = data.version || "1.0";
        this.serverTimestamp = data.serverTimestamp || Date.now();
        this.isEdited = data.isEdited || false;
        this.isDeleted = data.isDeleted || false;
    }

    getBroadcastRoom() {
        if(!this.isDM) return this.chatRoomID;
        const targetRoom = this.chatRoomID.split('_').find(uuid => uuid !== this.senderUUID);
        return targetRoom;
    }
}

module.exports = Message;
