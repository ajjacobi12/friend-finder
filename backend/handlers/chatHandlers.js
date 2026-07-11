// backend/handlers/chatHandlers.js
const Message = require('../classes/Message');
const MessageModel = require('../models/Message');

// --- MESSAGING ----
const handleSendMsg = async ({ msgID, chatRoomID, context }, { user, socket }, cb) => {
    
    const message = new Message({
        msgID,
        chatRoomID,
        senderUUID: user.uuid,
        ...context
    });

    // save message to database
    try {
        const dbMessage = new MessageModel(message); // convert to DB format
        await dbMessage.save(); // sends it to cloud
    } catch (err) {
        console.error("DB save error:", err);
        return cb({ success: false, error: "Failed to save message." });
    }

    // protocol/system guards
    // chatRoomID is either Auuid_Buuid or sessionID
    // targetChatRoom is the uuid of the DM recipient or the sessionID
    const targetChatRoom = message.getBroadcastRoom();
    if(!targetChatRoom) throw new Error("targetChatRoom unable to be retrived.");

    if (!message.isDM && user.sessionID !== chatRoomID) {
        return cb({ success: false, error: "Unauthorized: Session mismatch." });
    }

    // send message to everyone but sender
    socket.to(targetChatRoom).emit('receive-message', message);
    cb({ 
        success: true, 
        msgID,
        serverTimestamp: message.serverTimestamp 
    });

    console.log(`[${message.isDM ? `DM` : `CHAT`}] ${user.getName()} -> ${targetChatRoom}: ${context.text}`);
    // console.log("data being sent to receive-message: ", outboundData);
};

const handleEditMsg = async ({ msgID, chatRoomID, newText }, { user, socket }, cb) => {
    
    // update message in database
    const message = await MessageModel.findOneAndUpdate(
        { msgID: msgID },
        {
            $set: {
                text: newText,
                isEdited: true
            }
        },
        { new: true } // return updated document
    );
    if (!message) {
        return cb({ success: false, error:"Message not found. Unable to be edited."});
    };

    // send update to frontend
    const targetChatRoom = Message.getBroadcastTarget(chatRoomID, user.uuid);
    if(!targetChatRoom) throw new Error("targetChatRoom unable to be retrived.");

    socket.to(targetChatRoom).emit('message-edited', {
        chatRoomID,
        msgID,
        newText,
        isEdited: true
    });

    cb({ success: true });
    console.log(`[EDIT] Chat room ${chatRoomID} | Message ${msgID} edited to: ${newText}`);
};

const handleDeleteMsg = async ({ msgID, chatRoomID }, { user, socket }, cb) => {

    // detete in database
    const message = await MessageModel.findOneAndUpdate(
        { msgID: msgID },
        {
            $set: {
                text: "deleted",
                isDeleted: true
            }
        }
    );
    if (!message) {
        return cb({ success: false, error: "Message not found. Cannot be deleted." });
    }

    const targetChatRoom = Message.getBroadcastTarget(chatRoomID, user.uuid);
    if(!targetChatRoom) throw new Error("targetChatRoom unable to be retrieved.");

    socket.to(targetChatRoom).emit('message-deleted', {
        chatRoomID,
        msgID,
        senderUUID: user.uuid
    });

    cb({ success: true });
    console.log(`[DELETE] Chat room ${chatRoomID} | Message ${msgID} deleted by ${user.getName()}`);
};

const handleTyping = async ({ chatRoomID }, { user, socket }, cb) => {

    const targetChatRoom = Message.getBroadcastTarget(chatRoomID, user.uuid);
    if (!targetChatRoom) return;

    // data.chatRoomID is either sessionID or DMRoomID
    socket.to(targetChatRoom).emit('user-typing', {
        chatRoomID,
        userUUID: user.uuid, 
    }); 
};

const handleStopTyping = async ({ chatRoomID }, { user, socket }, cb) => {

    const targetChatRoom = Message.getBroadcastTarget(chatRoomID, user.uuid);
    if(!targetChatRoom) return;

    socket.to(targetChatRoom).emit('user-stop-typing', {
        userUUID: user.uuid
    });
};

module.exports = { handleSendMsg, handleEditMsg, handleDeleteMsg, handleTyping, handleStopTyping };