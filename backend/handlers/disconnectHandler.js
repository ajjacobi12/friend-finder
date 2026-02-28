// disconnectHandler.js

module.exports = (socketToUUID, activeUsers, sessionService) => {
    return {
        handleOnDisconnect: (socket) => { 
            const { user, userUUID, sessionID } = socket;

            // system/protocol guards
            if (!user || !userUUID || !sessionID) return;

            const userName = user.name || "Unknown User";

            console.log(`[BLINK] User ${userName} disconnected. Waiting for grace period...`);

            // immediate UI cleanup, stop anytyping indicaters
            socket.to(sessionID).emit('user-stop-typing', { senderUUID: userUUID });
            
            // remove old socket mapping since upon reconnection they will be give a new socket.id
            delete socketToUUID[socket.id];

            // start grace period of 15 seconds
            setTimeout(() => {
                // get most current version of user
                const currentUser = activeUsers[userUUID];
                // check if user is still associated with the disconnected socket
                // if they reconnect, activeUsers[userUUID].socketID will be different
                if (currentUser && currentUser.socketID === socket.id)  {
                    console.log(`[EXIT] Grace period expired for ${userName}. Cleaning up.`);

                    // leave logic
                    if (currentUser.isHost === true) sessionService.ensureHostExists(sessionID, userUUID);

                    // clean memory
                    delete activeUsers[userUUID];

                    // broadcast and session check
                    sessionService.handleSessionCleanup(sessionID);
                    sessionService.broadcastUpdate(sessionID, `User ${userName} left.`);
                } else {
                    // if user reconnects in time, socket.id should be changed
                    console.log(`[RECOVERY] User ${userName} reconnected within grace period.`);
                }
            }, 15000);
        }

    };
};