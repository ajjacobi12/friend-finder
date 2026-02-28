// serverUtils.js
const clean = require('./services/dataCleaner');

const CLEANING_MAP = {
    existingUUID: (val) => clean.userUUID(val),
    userUUIDToRemove: (val) => clean.userUUID(val),
    newHostUUID: (val) => clean.userUUID(val),

    sessionID: (val) => clean.sessionID(val),

    profile: (val) => clean.userProfile(val),

    msgID: (val) => clean.msgID(val),
    chatRoomID: (val) => clean.chatRoom(val),

    context: (val) => clean.msgContext(val),
    newText: (val) => clean.msgText(val),
};

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
        // clean.schema retuns "null" if { success: false }
        if(value === null || value === undefined) {
            throw new Error(`[${listenerName}] Protocol Error: malformed ${key}`);
        }
    }
};

// helper for callbacks
// --> checks for existence of verified socket properties, throws new error if they don't exist
// --> checks for existence of given arguments
// --> cleans given arguments
// --> validates cleaned arguments

// calls the listener/logic
const handleEvent = (eventName, socket, requiredFields, logic) => {
    return async (data, callback) => {
        // Automatically creates the safeCallback for you
        const cb = typeof callback === 'function' ? callback : () => {};

        try {
            // skip this for 'create-session' and 'join-session' since users aren't verified yet
            // skip for 'leave-session' since !user should return success: true
            const isPublic = requiredFields.includes('isPublic');

            // authorization checks
            if (!socket.user && !isPublic) throw new Error("Authentication failed: no verified user.");
            if (!socket.sessionID && !isPublic) throw new Error("Authentication failed: no verified sessionID");

            // check that an argument exists when required
            if (!isPublic && (!data || typeof data !== 'object')) {
                throw new Error(`[${eventName}] Protocol error: Invalid or missing data object.`);
            }

            // validate given individual arguments, then clean
            const cleanedData = {};            
            for (const field of requiredFields) {
                // skip internal "isPublic" flag
                if (field === 'isPublic') continue;

                // checks for existence of individual arguments
                const rawValue = data?.[field];
                if (rawValue === undefined || rawValue === null) {
                    throw new Error(`Protocol error: missing field [${field}].`);
                }

                // cleans arguments (based on above map!!!!), adds it array cleanedData
                if (CLEANING_MAP[field]) {
                    cleanedData[field] = CLEANING_MAP[field](rawValue);
                } else {
                    cleanedData[field] = rawValue;
                }
            }

            // validate cleaned data
            checkCleanData(eventName, cleanedData);

            // pull user, userUUID, and sessionID from socket
            const userContext = { 
                user: socket.user, 
                userUUID: socket.userUUID, 
                sessionID: socket.sessionID,
                socket: socket
            };

            // if it makes it past the verifiication and existence checks, run the listener logic
            await logic(cleanedData, userContext, cb);
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