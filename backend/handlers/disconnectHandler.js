// backend/handlers/disconnectHandler.js
// currently designed so that user stays in session indefinitely until they voluntarily leave or are kicked

module.exports = {
    handleOnDisconnect: (socket) => { 
        const { user, sessionID } = socket;

        // system/protocol guards
        if (!user || !sessionID) return;

        // update memoory objects
        user.status = 'offline';
        user.lastSeen = Date.now();

        console.info(`[OFFLINE] ${user.name} (Festival Mode). Staying in memory.`);
        // console.info(`[BLINK] User ${user.name} disconnected. Waiting for grace period...`);

        // immediate UI cleanup, stop anytyping indicaters, mark connection status as offline on frontend
        socket.to(sessionID).emit('user-stop-typing', { senderUUID: user.uuid });
        socket.to(sessionID).emit('user-status-change', { userUUID: user.uuid, status: 'offline' });
    }
};