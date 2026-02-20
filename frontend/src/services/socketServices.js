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
export const removeUserAction = async (roomID, userUUIDToRemove) => {
    return await secureEmit('remove-user', { roomID, userUUIDToRemove });
};

export const transferHostAction = async (roomID, newHostUUID) => {
    return await secureEmit('transfer-host', { roomID, newHostUUID });
};

export const endSessionAction = async (roomID) => {
    return await secureEmit('end-session', { roomID });
};

// ------- LOGIN FUNCTIONS -------
export const createSessionAction = async (existingUUID) => {
    return await secureEmit('create-session', { existingUUID });
};

export const joinSessionAction = async (roomID, existingUUID) => {
    return await secureEmit('join-session', { roomID, existingUUID });
};

// ------- PROFILE FUNCTIONS --------
export const updateUserAction = async (name, color) => {
    return await secureEmit('update-user', { name, color });
};

// ------  CHAT FUNCTIONS --------
export const sendMessageAction = async (outboundData) => {
    return await secureEmit('send-message', outboundData );
};

export const editMessageAction = async (msgID, roomID, newText) => {
    return await secureEmit('edit-message', { msgID, roomID, newText});
};

export const deleteMessageAction = async (msgID, roomID) => {
    return await secureEmit('delete-message', { msgID, roomID});
};

export const typingAction = (roomID) => {
    socket.emit('typing', { roomID });
};

export const stopTypingAction = (roomID) => {
    socket.emit('stop-typing', { roomID });
};

// ------ MULTI-SCREEN FUNCTIONS ------
export const leaveSessionAction = async (roomID) => {
    return await secureEmit('leave-session', { roomID });
};