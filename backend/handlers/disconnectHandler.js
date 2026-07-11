// backend/handlers/disconnectHandler.js
// currently designed so that user stays in session indefinitely until they voluntarily leave or are kicked

module.exports = (sessionService, socketToUUID) => {
    return {
        handleOnDisconnect: (socket) => { 
            const userUUID = socket.userUUID || socketToUUID[socket.id];
            const user = userUUID ? sessionService.getUser(userUUID) : null;

            if (!user) {
                delete socketToUUID[socket.id];
                return;
            }

            const sessionID = socket.sessionID || user.sessionID;

            user.setOffline();

            console.info(`[OFFLINE] ${user.name} (Festival Mode). Staying in memory.`);

            // immediate UI cleanup, stop anytyping indicaters, mark connection status as offline on frontend
            socket.to(sessionID).emit('user-stop-typing', { senderUUID: user.uuid });
            socket.to(sessionID).emit('user-status-change', { userUUID: user.uuid, status: 'offline' });

            sessionService.broadcastUpdate(sessionID, `User ${user.getName()} is offline.`);

            delete socketToUUID[socket.uuid];
        }
    }
};