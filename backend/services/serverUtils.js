// serverUtils.js

// helper to get target chat room for start/stopping typing
const getChatRoomData = (chatRoomID, senderUUID) => {
    const isDM = chatRoomID.includes('_');
    const targetChatRoom = isDM 
    ? chatRoomID.split('_').find(uuid => uuid !== senderUUID)
    : chatRoomID;
    return { targetChatRoom, isDM };
};

// helper to check cleaned data
const checkCleanData = (listenerName, dataMap)=> {
    // get an array of name (key) and value (what it's defined as) of cleanData
    // eg. [key, value] = [["cleanMsgID", "123..."]]
    for (const [key, value] of Object.entries(dataMap)) {
        if(!value) {
            throw new Error(`[${listenerName}] Protocol Error: malformed ${key}`);
        }
    }
};

// helper for callbacks
// --> checks for existence of verified socket properties, throws new error if they don't exist
// --> checks for existence of given arguments
// calls the listener/logic
const handleEvent = (socket, requiredFields, logic) => {
    return async (data, callback) => {
        // Automatically creates the safeCallback for you
        const cb = typeof callback === 'function' ? callback : () => {};
        try {
            // skip this for 'create-session' and 'join-session' since users aren't verified yet
            // skip for 'leave-session' since !user should return success: true
            // checks for verified existence of user && sessionID 
            const isPublic = requiredFields.includes('isPublic');

            if (!socket.user && !isPublic) throw new Error("Authentication failed: no verified user.");
            if (!socket.sessionID && !isPublic) throw new Error("Authentication failed: no verified sessionID");
            
            // checks for existence of arguments of specific listener
            for (const field of requiredFields) {
                // skip internal "isPublic" flag
                if (field === 'isPublic') continue;
                if (!data || data[field] === undefined || data[field] === null) {
                    throw new Error(`Protocol error: missing field [${field}].`);
                }
            }

            // if it makes it past the verifiication and existence checks, run the listener logic
            await logic(data, cb);
        } catch (err) {
            console.error("SECURE EVENT ERROR: ", err.message);
            if (cb) cb({ success: false, error: err.message || "Internal Server Error" });
        }
    };
};

module.exports = {
    getChatRoomData,
    checkCleanData,
    handleEvent
};