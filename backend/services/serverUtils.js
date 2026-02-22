// serverUtils.js

// helper to get target chat room for start/stopping typing
const getChatRoomData = (chatRoomID, senderUUID) => {
    const isDM = chatRoomID.includes('_');
    const targetChatRoom = isDM 
    ? chatRoomID.split('_').find(uuid => uuid !== senderUUID)
    : chatRoomID;
    return { targetChatRoom, isDM };
};


// helper for callbacks
const handleEvent = (handler) => {
    return async (data, callback) => {
        // Automatically creates the safeCallback for you
        const cb = typeof callback === 'function' ? callback : () => {};
        try {
            await handler(data, cb);
        } catch (err) {
            console.error("Socket Error:", err);
            cb({ success: false, error: err.message || "Internal Server Error" });
        }
    };
};

module.exports = {
    getChatRoomData,
    handleEvent
};