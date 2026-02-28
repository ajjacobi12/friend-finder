const { getChatRoomData } = require('../services/serverUtils');

// --- MESSAGING ----
const formatInboundMessage = (user, chatRoomID, context, msgID) => ({
    chatRoomID,
    msgID,
    senderUUID: user.uuid,
    senderName: user.name,
    color: user.color,
    context: {
        text: context.text || "",
        isEncrypted: context.isEncrypted || false,
        version: context.version || "1.0"
    },
    serverTimestamp: Date.now()
});

const handleSendMsg = async ({ msgID, chatRoomID, context }, { user, userUUID, socket }, cb) => {
    
    // messageData.chatRoomID is either Auuid_Buuid or sessionID
    // targetChatRoom is the uuid of the DM recipient or the sessionID
    const { targetChatRoom, isDM } = getChatRoomData(chatRoomID, userUUID);
    if(!targetChatRoom) throw new Error("targetChatRoom unable to be retrived.");

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

const handleEditMsg = async ({ msgID, chatRoomID, newText }, { userUUID, socket }, cb) => {
    
    const { targetChatRoom } = getChatRoomData(chatRoomID, userUUID);
    if(!targetChatRoom) throw new Error("targetChatRoom unable to be retrived.");

    socket.to(targetChatRoom).emit('message-edited', {
        chatRoomID,
        msgID,
        newText
    });

    cb({ success: true });
    console.log(`[EDIT] Chat room ${chatRoomID} | Message ${msgID} edited to: ${newText}`);
};

const handleDeleteMsg = async ({ msgID, chatRoomID }, { user, userUUID, socket }, cb) => {

    const { targetChatRoom } = getChatRoomData(chatRoomID, userUUID);
    if(!targetChatRoom) throw new Error("targetChatRoom unable to be retrieved.");

    socket.to(targetChatRoom).emit('message-deleted', {
        chatRoomID,
        msgID,
        senderName: user.name,
    });

    cb({ success: true });
    console.log(`[DELETE] Chat room ${chatRoomID} | Message ${msgID} deleted by ${user.name}`);
};

const handleTyping = async ({ chatRoomID }, { user, userUUID, socket }, cb) => {

    const { targetChatRoom } = getChatRoomData(chatRoomID, userUUID);
    if (!targetChatRoom) return;

    // data.chatRoomID is either sessionID or DMRoomID
    socket.to(targetChatRoom).emit('user-typing', {
        chatRoomID,
        userUUID, 
        senderName: user.name
    }); 
};

const handleStopTyping = async ({ chatRoomID }, { userUUID, socket }, cb) => {

    const { targetChatRoom } = getChatRoomData(chatRoomID, userUUID);
    if(!targetChatRoom) return;

    socket.to(targetChatRoom).emit('user-stop-typing', {
        userUUID
    });
};

module.exports = { handleSendMsg, handleEditMsg, handleDeleteMsg, handleTyping, handleStopTyping };