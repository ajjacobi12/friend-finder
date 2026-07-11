// backend/handlers/homeHandlers.js

module.exports = (io, sessionService) => {
    return {
        // --- user voluntarily leaves session (exit session) ---
        handleLeaveSession: async ({ sessionID }, { user, socket }, cb) => {
            
            if (!user) return cb({ success: true });
            if (user.sessionID !== sessionID) throw new Error (`User is not in session ${sessionID}.`);

            const masterUser = sessionService.getUser(user.uuid);
            if (!masterUser) throw new Error('[LEAVE SESSION] Unable to retrieve user information.');

            if (masterUser.isHost === true) {
                const newHostFound = sessionService.ensureHostExists(sessionID, user.uuid);
                if (!newHostFound) console.warn(`[HOST] No one left to take over. Room is hostless.`);
            }

            const purged = sessionService.purgeUser(user.uuid, sessionID, socket);
            if (!purged) throw new Error (`User ${masterUser.getName()} was unable to be purged.`);

            cb({ success: true });
            sessionService.broadcastUpdate(sessionID, `User ${masterUser.getName()} left.`);
            
            setTimeout(() => {
                sessionService.handleSessionCleanup(sessionID);
            }, 50);         
        },

        // --- host ends session for all ---
        handleEndSession: async ({ sessionID }, { user, socket }, cb) => {
            const masterUser = sessionService.getUser(user.uuid);

            if (!masterUser) throw new Error('[LEAVE SESSION] Unable to retrieve user information.');
            if (masterUser.sessionID !== sessionID) throw new Error (`User is not in session ${sessionID}.`);
            if (!masterUser.isHost) throw new Error(`Unauthorized attempt by ${masterUser.getName()} to end session.`);

            console.log(`Host ${masterUser.getName()} is ending session ${sessionID}`);
            io.to(sessionID).emit('session-ended');

            const purged = sessionService.purgeSession(sessionID);
            if (!purged) throw new Error (`[END SESSION] failed in session ${sessionID}: missing sessionID or unable to retrive sockets.`);

            cb({ success: true });
            console.log(`Session ${sessionID} fully purged.`);
        },

        // --- host removes user ---
        handleRemoveUser: async ({ sessionID, userUUIDToRemove }, { user, socket }, cb) => {
            const masterUser = sessionService.getUser(user.uuid);

            if (!masterUser) throw new Error('[LEAVE SESSION] Unable to retrieve user information.');
            if (!masterUser.isHost) throw new Error(`[REMOVE USER] Unauthorized attempt by ${masterUser.getName()} to remove user.`);

            const targetUser = sessionService.getUser(userUUIDToRemove, sessionID);
            if (!targetUser) return cb({ success: true });

            // force victim socket to leave session
            // keep in mind: if target user is disconnected (eg. after 15s reconnection grace period)
            //    targetSocket will be undefined, keep purgeUser outside of if(targetSocket) condition
            const targetSocket = io.sockets.sockets.get(targetUser.socketID);
            if (targetSocket) {
                targetSocket.emit('removed-from-session'); 
            }
            const purged = sessionService.purgeUser(userUUIDToRemove, sessionID, targetSocket);
            if (!purged) throw new Error (`[REMOVE USER] User ${targetUser.getName()} was unable to be purged.`);

            cb({ success: true });
            sessionService.broadcastUpdate(sessionID, `User (${targetUser.getName()}) was removed by the host.`);
            
            sessionService.handleSessionCleanup(sessionID);
        },

        // --- host transfers host status ---
        handleTransferHost: async ({ sessionID, newHostUUID }, { user, socket }, cb ) => {
            const masterUser = sessionService.getUser(user.uuid);
            const targetUser = sessionService.getUser(newHostUUID, sessionID);
            const session = sessionService.getSession(sessionID);

            if (!session) throw new Error('[TRANSFER HOST] Unable to retrieve session information.');
            if (!masterUser) throw new Error('[TRANSFER HOST] Unable to retrieve user information.');
            if (!targetUser) throw new Error(`[TRANSFER HOST] Transfer failed: unable to retrieve target user ${newHostUUID} information.`);
            if (!masterUser.isHost ) throw new Error(`[TRANSFER HOST] Unauthorized transfer attempt by ${masterUser?.getName()}`);

            const targetSocket = io.sockets.sockets.get(targetUser.socketID);
            if (!targetSocket) console.log(`[TRANSFER HOST] target user ${newHostUUID} socket not found in session. User is offline.`);

            session.hostUUID = newHostUUID;

            masterUser.isHost = false;
            targetUser.isHost = true;
            
            // socket.user = masterUser;
            // if (targetSocket) {
            //     targetSocket.user = targetUser; 
            // }

            io.to(sessionID).emit('host-change', newHostUUID);
            cb({ success: true });
            sessionService.broadcastUpdate(sessionID, `${targetUser.getName()} is now the host.`);
        }

    };
};