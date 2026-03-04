// chatHandlers.js
const { getChatRoomData } = require('../services/serverUtils');

// --- MESSAGING ----
const formatInboundMessage = (user, chatRoomID, context, msgID) => ({
    chatRoomID,
    msgID,
    senderUUID: user.uuid,
    context: {
        text: context.text || "",
        isEncrypted: context.isEncrypted || false,
        version: context.version || "1.0"
    },
    serverTimestamp: Date.now()
});

const handleSendMsg = async ({ msgID, chatRoomID, context }, { user, socket }, cb) => {
    
    // protocol/system guards
    // messageData.chatRoomID is either Auuid_Buuid or sessionID
    // targetChatRoom is the uuid of the DM recipient or the sessionID
    const { targetChatRoom, isDM } = getChatRoomData(chatRoomID, user.uuid);
    if(!targetChatRoom) throw new Error("targetChatRoom unable to be retrived.");

    if (!isDM && user.sessionID !== chatRoomID) {
        return cb({ success: false, error: "Unauthorized: Session mismatch." });
    }

    // reconstruct package, don't just send 'outboundData', only emit what's necessary
    const formattedMessage = formatInboundMessage(
        user, 
        chatRoomID, 
        context,
        msgID
    );

    // send message to everyone but sender
    socket.to(targetChatRoom).emit('receive-message', formattedMessage);
    cb({ 
        success: true, 
        msgID,
        serverTimestamp: formattedMessage.serverTimestamp 
    });

    console.log(`[${isDM ? `DM` : `CHAT`}] ${user.name} -> ${targetChatRoom}: ${context.text}`);
    // console.log("data being sent to receive-message: ", outboundData);
};

const handleEditMsg = async ({ msgID, chatRoomID, newText }, { user, socket }, cb) => {
    
    const { targetChatRoom } = getChatRoomData(chatRoomID, user.uuid);
    if(!targetChatRoom) throw new Error("targetChatRoom unable to be retrived.");

    socket.to(targetChatRoom).emit('message-edited', {
        chatRoomID,
        msgID,
        newText
    });

    cb({ success: true });
    console.log(`[EDIT] Chat room ${chatRoomID} | Message ${msgID} edited to: ${newText}`);
};

const handleDeleteMsg = async ({ msgID, chatRoomID }, { user, socket }, cb) => {

    const { targetChatRoom } = getChatRoomData(chatRoomID, user.uuid);
    if(!targetChatRoom) throw new Error("targetChatRoom unable to be retrieved.");

    socket.to(targetChatRoom).emit('message-deleted', {
        chatRoomID,
        msgID,
        senderUUID: user.uuid
    });

    cb({ success: true });
    console.log(`[DELETE] Chat room ${chatRoomID} | Message ${msgID} deleted by ${user.name}`);
};

const handleTyping = async ({ chatRoomID }, { user, socket }, cb) => {

    const { targetChatRoom } = getChatRoomData(chatRoomID, user.uuid);
    if (!targetChatRoom) return;

    // data.chatRoomID is either sessionID or DMRoomID
    socket.to(targetChatRoom).emit('user-typing', {
        chatRoomID,
        userUUID: user.uuid, 
    }); 
};

const handleStopTyping = async ({ chatRoomID }, { user, socket }, cb) => {

    const { targetChatRoom } = getChatRoomData(chatRoomID, user.uuid);
    if(!targetChatRoom) return;

    socket.to(targetChatRoom).emit('user-stop-typing', {
        userUUID: user.uuid
    });
};

module.exports = { handleSendMsg, handleEditMsg, handleDeleteMsg, handleTyping, handleStopTyping };