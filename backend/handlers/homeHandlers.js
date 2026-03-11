// homeHandlers.js

module.exports = (io, sessionService) => {
    return {
        // --- user voluntarily leaves session (exit session)
        handleLeaveSession: async ({ sessionID }, { user, socket }, cb) => {
            
            // if user is gone from records, do nothing
            if (!user) return cb({ success: true });

            if (user.sessionID !== sessionID) throw new Error (`User is not in session ${sessionID}.`);

            // if user was the host, pick a new one
            if (user.isHost === true) {
                const newHostFound = sessionService.ensureHostExists(sessionID, user.uuid);
                if (!newHostFound) console.warn(`[HOST] No one left to take over. Room is hostless.`);
            }

            // save the name
            const userName = user.name;

            // delete user data & remove sockets
            // returns true if user was removed, false if not
            const purged = sessionService.purgeUser(user.uuid, sessionID, socket);
            if (!purged) throw new Error (`User ${userName} was unable to be purged.`);

            cb({ success: true });
            sessionService.broadcastUpdate(sessionID, `User ${userName || "Unknown User"} left.`);
            
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
            const purged = sessionService.purgeSession(sessionID);
            if (!purged) throw new Error (`[END SESSION] failed in session ${sessionID}: missing sessionID or unable to retrive sockets.`);

            cb({ success: true });
            console.log(`Session ${sessionID} fully purged.`);
        },

        // --- host removes user ---
        handleRemoveUser: async ({ sessionID, userUUIDToRemove }, { user, socket }, cb) => {

            if (!user.isHost) throw new Error(`[REMOVE USER] Unauthorized attempt by ${user.name || socket.id} to remove user.`);

            // find victim, if they aren't in activeUsers they're already gone
            const targetUser = sessionService.getTargetUser(userUUIDToRemove, sessionID);
            if (!targetUser) return cb({ success: true });

            // capture name now before removing all data
            const targetName = targetUser.name || "User";

            // force victim socket to leave session
            // keep in mind: if target user is disconnected (eg. 15s reconnection grace period)
            //    targetSocket will be undefined, keep purgeUser outside of if(targetSocket) condition
            const targetSocket = io.sockets.sockets.get(targetUser.socketID);
            if (targetSocket) {
                targetSocket.emit('removed-from-session'); 
            }
            // returns true if user was removed, false if not
            const purged = sessionService.purgeUser(userUUIDToRemove, sessionID, targetSocket);
            if (!purged) throw new Error (`[REMOVE USER] User ${targetName} was unable to be purged.`);

            cb({ success: true });
            sessionService.broadcastUpdate(sessionID, `User (${targetName || `User`}) was removed by the host.`);
            
            sessionService.handleSessionCleanup(sessionID);
        },

        // --- host transfers host status ---
        handleTransferHost: async ({ sessionID, newHostUUID }, { user, socket }, cb ) => {
            // protocol/system guards
            const masterUser = sessionService.getMasterUser(user.uuid);
            const targetUser = sessionService.getTargetUser(newHostUUID, sessionID);
            const session = sessionService.getSession(sessionID);

            if (!session) throw new Error('[TRANSFER HOST] Unable to retrieve session information.');
            if (!masterUser) throw new Error('[TRANSFER HOST] Unable to retrieve user information.');
            if (!targetUser) throw new Error(`[TRANSFER HOST] Transfer failed: unable to retrieve target user ${newHostUUID} information.`);
            if (!masterUser.isHost ) throw new Error(`[TRANSFER HOST] Unauthorized transfer attempt by ${masterUser?.name || socket.id}`);

            // get target user's socket
            const targetSocket = io.sockets.sockets.get(targetUser.socketID);
            if (!targetSocket) console.log(`[TRANSFER HOST] target user ${newHostUUID} socket not found in session. User is offline.`);

            // update session pointer
            session.hostUUID = newHostUUID;

            // update master memory
            masterUser.isHost = false;
            targetUser.isHost = true;
            
            // refresh socket's badge
            // always update the user transfering, update target user if they are online
            socket.user = masterUser;
            if (targetSocket) {
                targetSocket.user = targetUser; 
            }

            io.to(sessionID).emit('host-change', newHostUUID);
            cb({ success: true });
            sessionService.broadcastUpdate(sessionID, `${targetUser.name} is now the host.`);
        }

    };
};