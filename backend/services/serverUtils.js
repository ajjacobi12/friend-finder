// backend/services/serverUtils.js
const clean = require('./dataCleaner');

// -------------------------------------- CHAT HELPERS --------------------------------------
// helper to get target chat room for start/stopping typing
const getChatRoomData = (chatRoomID, senderUUID) => {
    if (!chatRoomID || typeof chatRoomID !== 'string') return { targetChatRoom: null, isDM: false };

    const isDM = chatRoomID.includes('_');
    const targetChatRoom = isDM 
    ? chatRoomID.split('_').find(uuid => uuid !== senderUUID)
    : chatRoomID;

    // Safety check: if it's a DM but we couldn't find the 'other' UUID
    if (!targetChatRoom) return { targetChatRoom: null, isDM };

    return { targetChatRoom, isDM };
};

// -------------------------------------- DATA CLEANING HELPERS --------------------------------------
const CLEANING_MAP = {
    existingUUID: (val) => clean.userUUID(val),
    userUUIDToRemove: (val) => clean.userUUID(val),
    newHostUUID: (val) => clean.userUUID(val),

    sessionID: (val) => clean.sessionID(val),

    profile: (val) => clean.userProfile(val),
    existingProfile: (val) => clean.userProfile(val),

    msgID: (val) => clean.msgID(val),
    chatRoomID: (val) => clean.chatRoom(val),

    context: (val) => clean.msgContext(val),
    newText: (val) => clean.msgText(val),
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

// -------------------------------------- GENERAL LISTENER HELPERS --------------------------------------
// helper for callbacks
// --> checks for existence of verified socket properties, throws new error if they don't exist
// --> checks for existence of given arguments
// --> cleans given arguments
// --> validates cleaned arguments

// calls the listener/logic
const handleEvent = (eventName, socket, requiredFields, logic, isAuthRequired = true) => {
    return async (data, callback) => {
        // Automatically creates the safeCallback for you
        const cb = typeof callback === 'function' ? callback : () => {};

        try {
            // skip this for 'create-session' and 'join-session' since users aren't verified yet
            // skip for 'leave-session' since !user should return success: true
            if (isAuthRequired) 
            {
                // authorization checks
                if (!socket.user) throw new Error("Authentication failed: no verified user.");
                if (!socket.sessionID) throw new Error("Authentication failed: no verified sessionID");

                // check that an argument exists when required
                if (!data || typeof data !== 'object') {
                    throw new Error(`[${eventName}] Protocol error: Invalid or missing data object.`);
                }
            }

            // validate given individual arguments, then clean
            const cleanedData = {};            
            for (const field of requiredFields) {
                // checks for existence of individual arguments
                const isRequired = !field.startsWith('?');
                const fieldName = isRequired ? field : field.substring(1);

                const rawValue = data?.[fieldName];

                if (isRequired && (rawValue === undefined || rawValue === null)) {
                    throw new Error(`Protocol error: missing field [${fieldName}].`);
                }
                if (!isRequired && (rawValue !== null && !rawValue)) {
                    throw new Error(`Protocol error: missing field [${fieldName}].`);    
                }

                // console.log("Field name: ", fieldName, ", Value: ", rawValue);

                // if value exists, clean and store it
                if (rawValue !== undefined && rawValue !== null) {
                    // cleans arguments (based on above map!!!!), adds it array cleanedData
                    if (CLEANING_MAP[fieldName]) {
                        cleanedData[fieldName] = CLEANING_MAP[fieldName](rawValue);
                    } else {
                        cleanedData[fieldName] = rawValue;
                    }
                }
            }

            // validate cleaned data
            checkCleanData(eventName, cleanedData);

            // pull user, userUUID, and sessionID from socket
            const userContext = { 
                user: socket.user, 
                userUUID: socket.userUUID, 
                sessionID: socket.sessionID,
                socket
            };

            // if it makes it past the verification and existence checks, run the listener logic
            await logic(cleanedData, userContext, cb);
        } catch (err) {
            // Check if it's a "Protocol Error" (User's fault) or "Server Error" (Your fault)
            const isProtocolError = err.message.includes("Protocol") || err.message.includes("Authentication");
            
            if (isProtocolError) {
                console.warn(`[PROTOCOL VIOLATION] ${eventName}: ${err.message}`);
            } else {
                console.error(`[SERVER ERROR] ${eventName}:`, err.stack);
            }

            if (cb) cb({ 
                success: false, 
                error: isProtocolError ? err.message : "An internal server error occurred." 
            });
        }
    };
};

module.exports = {
    getChatRoomData,
    checkCleanData,
    handleEvent
};