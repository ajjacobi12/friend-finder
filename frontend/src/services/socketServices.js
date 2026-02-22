// socketServices.js
import socket from '../api/socket';

const infrastructureEvents = [
    'join-session', 'create-session', 'leave-session', 'end-session',
    'update-user', 'transfer-host', 'remove-user', 
    'send-message', 'send-direct-message',                   
    'edit-message', 'delete-message'
];

// generic helper to wrap socket.emit in a promise
export const secureEmit = (eventName, data) => {
    return new Promise((resolve, reject) => {
        // timeout so app doesn't hang if server is down
        const timeout = setTimeout(() => {
            reject(new Error(`[Timeout] Server took too long to respond to ${eventName}`));
        }, 10000);

        let finalData = data;

        // future encryption
        if (!infrastructureEvents.includes(eventName)) {
            // console.log("Encrypting sensitive event:", eventName);
            // finalData = encrypt(data);
        } 

        socket.emit(eventName, finalData, (response) => {
            clearTimeout(timeout); // cancel timeout if server responds
            // handle the response
            if (!response){
                return reject(new Error(`[Network] No response received for ${eventName}. Check connection.`));
            } 
            if (response.success === false) {
                return reject(new Error(`[Server] ${eventName} failed: ${response.error || `Unknown server error.`}`));
            }
            // success
            resolve(response);
        });
    });
};

// ------ HOME FUNCTIONS --------
export const removeUserAction = (sessionID, userUUIDToRemove) => {
    return secureEmit('remove-user', { sessionID, userUUIDToRemove });
};

export const transferHostAction = (sessionID, newHostUUID) => {
    return secureEmit('transfer-host', { sessionID, newHostUUID });
};

export const endSessionAction = (sessionID) => {
    return secureEmit('end-session', { sessionID });
};

// ------- LOGIN FUNCTIONS -------
export const createSessionAction = (existingUUID) => {
    return secureEmit('create-session', { existingUUID });
};

export const joinSessionAction = (sessionID, existingUUID) => {
    return secureEmit('join-session', { sessionID, existingUUID });
};

// ------- PROFILE FUNCTIONS --------
export const updateUserAction = (name, color) => {
    return secureEmit('update-user', { name, color });
};

// ------  CHAT FUNCTIONS --------
export const sendMessageAction = (outboundData) => {
    return secureEmit('send-message', outboundData );
};

export const editMessageAction = (msgID, chatRoomID, newText) => {
    return secureEmit('edit-message', { msgID, chatRoomID, newText});
};

export const deleteMessageAction = (msgID, chatRoomID) => {
    return secureEmit('delete-message', { msgID, chatRoomID});
};

export const typingAction = (chatRoomID) => {
    socket.emit('typing', { chatRoomID });
};

export const stopTypingAction = (chatRoomID) => {
    socket.emit('stop-typing', { chatRoomID });
};

// ------ MULTI-SCREEN FUNCTIONS ------
export const leaveSessionAction = (sessionID) => {
    return secureEmit('leave-session', { sessionID });
};