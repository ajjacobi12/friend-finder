// homeHandlers.js

module.exports = (io, activeUsers, activeSessions, sessionService, socketToUUID) => {
    return {
        // --- user voluntarily leaves session (exit session)
        handleLeaveSession: async ({ sessionID }, { user, userUUID, socket }, cb) => {
            
            // if user is gone from records, do nothing
            if (!user) return cb({ success: true });

            if (user.sessionID !== sessionID) throw new Error (`User is not in session ${sessionID}.`);

            // if user was the host, pick a new one
            if (user.isHost === true) sessionService.ensureHostExists(sessionID, userUUID);

            // delete user data & remove sockets
            delete activeUsers[userUUID];  
            delete socketToUUID[socket.id];
            socket.leave(sessionID);
            socket.leave(userUUID);

            cb({ success: true });
            sessionService.broadcastUpdate(sessionID, `User ${user.name || "Unknown User"} left.`);
            
            // check if session is now empty
            setTimeout(() => {
                sessionService.handleSessionCleanup(sessionID);
            }, 50);         
        },

        // --- host ends session for all ---
        handleEndSession: async ({ sessionID }, { user, socket }, cb) => {

            if (!user.isHost) throw new Error(`Unauthorized attempt by ${user.name || socket.id} to end session.`);

            // notify everyone session ended, start cleanup on frontend for all users
            console.log(`Host ${user.name} is ending session ${sessionID}`);
            io.to(sessionID).emit('session-ended');

            // delete all users' data in session
            const session = io.sockets.adapter.rooms.get(sessionID);
            session?.forEach(socketID => {
                const socketObject = io.sockets.sockets.get(socketID);
                const userUUID = socketToUUID[socketID];

                socketObject?.leave(sessionID);
                if (userUUID) socketObject?.leave(userUUID); 
                delete socketToUUID[socketID];
                delete activeUsers[userUUID];
            });

            // remove session from active sessions, 
            // clear the session deletion timer if it exists
            delete activeSessions[sessionID];
            sessionService.cancelSessionDeletion(sessionID);

            cb({ success: true });
            console.log(`Session ${sessionID} fully purged.`);
        },

        // --- host removes user ---
        handleRemoveUser: async ({ sessionID, userUUIDToRemove }, { user, socket }, cb) => {

            if (!user.isHost) throw new Error(`[REMOVE USER] Unauthorized attempt by ${user.name || socket.id} to remove user.`);

            // find victim, if they aren't in activeUsers they're already gone
            const targetUser = activeUsers[userUUIDToRemove];
            if (!targetUser) return cb({ success: true });

            // force victim socket to leave session
            const targetSocket = io.sockets.sockets.get(targetUser.socketID);
            if (targetSocket) {
                targetSocket.emit('removed-from-session'); 
                targetSocket.leave(sessionID); 
                targetSocket.leave(userUUIDToRemove);
            }

            // cleanup & notify
            delete socketToUUID[targetUser.socketID];
            delete activeUsers[userUUIDToRemove]; 

            cb({ success: true });
            sessionService.broadcastUpdate(sessionID, `User (${targetUser.name || `User`}) was removed by the host.`);
            sessionService.handleSessionCleanup(sessionID);
        },

        // --- host transfers host status ---
        handleTransferHost: async ({ sessionID, newHostUUID }, { user, socket }, cb ) => {

            if (!user.isHost ) throw new Error(`[TRANSFER HOST] Unauthorized transfer attempt by ${user?.name || socket.id}`);

            const targetUser = activeUsers[newHostUUID];
            if (!targetUser || targetUser.sessionID !== sessionID) {
                throw new Error(`[TRANSFER HOST] Transfer failed: target user ${newHostUUID} not found in session.`);
            }

            // change host status of both users
            user.isHost = false;
            targetUser.isHost = true;

            io.to(sessionID).emit('host-change', newHostUUID);
            cb({ success: true });
            sessionService.broadcastUpdate(sessionID, `${targetUser.name} is now the host.`);
        }

    };
};