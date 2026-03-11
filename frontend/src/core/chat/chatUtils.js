// frontend/src/core/chat/chatUtils.js

// --- DESANITIZE INCOMING TEXT ---
export const desanitize = (text) => {
    if (typeof text !== 'string') return '';
    return text
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
};

// --- FORMAT INBOUND MESSAGE DATA FROM USER-->SERVER  ---
export const formatMsgData = (msgData, status) => {
    const {
        chatRoomID, msgID, senderUUID, context, 
        serverTimestamp, timestamp,
    } = msgData;

    return {
        chatRoomID,
        msgID,
        senderUUID,
        context: {
            isEncrypted: false,
            text: desanitize(context.text),
            version: "1.0"
        },
        timestamp: serverTimestamp || timestamp || Date.now(),
        status
    };
};

// --- RETURN UPDATED LOCAL MESSAGE DATA ---
// returns all messages with the selected message updated
export const returnUpdatedMsg = (prevMsgs, chatRoomID, msgID, updates) => {
    // get all room messages, stop if there currently aren't any 
    const roomMsgs = prevMsgs[chatRoomID] || {};
    if(!roomMsgs) return prevMsgs;

    // find old message
    const oldMsg = roomMsgs[msgID];
    if (!oldMsg) return prevMsgs;

    // append updates, and if new text, update the context: text
    const { newText, serverTimestamp, ...otherUpdates } = updates;
    const updatedMsg = { ...oldMsg, ...otherUpdates };

    if (newText !== undefined) updatedMsg.context = { ...oldMsg.context, text: desanitize(newText) };
    if (serverTimestamp !== undefined) updatedMsg.timestamp = serverTimestamp;

    return {
        ...prevMsgs,
        [chatRoomID]: { ...roomMsgs, [msgID]: updatedMsg }
    };
};  