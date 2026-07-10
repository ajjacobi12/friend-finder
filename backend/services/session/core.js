// backend/services/session/core.js
// functions required by everyone, don't depend on others, just provide tools

const sessionTimeoutRefs = {};

module.exports = (io, activeUsers, activeSessions, socketToUUID) => {
    // -------------------------------------- GENERAL HELPERS --------------------------------------
    // internal helper: broadcast
    const broadcastUpdate = (sessionID, logMessage) => {
        if (!sessionID || !io) return;

        // map users to "safe" version before emitting (no socketID)
        const usersInSession = Object.values(activeUsers)
            .filter(u => u.sessionID === sessionID && u.isRegistered)
            .map(u => ({
                uuid: u.uuid,
                name: u.name,
                color: u.color,
                isHost: u.isHost,
                status: u.status || 'online'
            }));

        io.to(sessionID).emit('user-update', usersInSession);

        console.log(`--- SESSION UPDATE: ${sessionID} ----`);
        console.log(logMessage);
        console.log(`Current Active Users: ${usersInSession.length}`);
        console.log(JSON.stringify(usersInSession, null, 2));
        console.log('------------------------------');
    };

    // -------------------------------------- HOME HELPERS --------------------------------------
    // deletes user's information from memory
    const purgeUser = (userUUID, sessionID, socket) => {
        if (!socket && !userUUID) return false;

        // ensure socket exists before cleaning
        if (socket) {
            socket.leave(sessionID);

            // if UUID has been assigned, clean user data
            if (userUUID) {
                socket.leave(userUUID);
                
                delete activeUsers[userUUID];
            }

            delete socketToUUID[socket.id];
        }

        return true;
    };

    // internal helper: timer cancellation
    const cancelSessionDeletion = (sessionID) => {   
        if (sessionTimeoutRefs[sessionID]) {
            clearTimeout(sessionTimeoutRefs[sessionID]);
            delete sessionTimeoutRefs[sessionID];
            console.log(`Timer cancelled for session ${sessionID}. User has returned in time.`);
            return true;
        }
        return false;
    };

    // helper to handle the "empty session" timer
    // for "ghost rooms" where users have left but their data remains in activeUsers
    // wait 5 minutes then wipe the leftovers
    const handleSessionCleanup = (sessionID) => {
        if (!sessionID) return false;

        // if room is empty but user data remains, need to check number of socket connections, not activeUsers
        const session = io.sockets.adapter.rooms.get(sessionID);
        const numLiveSockets = session ? session.size : 0;
        
        if (numLiveSockets <= 0) {
            console.log(`Session ${sessionID} is empty. Starting 5-minute deletion timer...`);
            if (sessionTimeoutRefs[sessionID]) clearTimeout(sessionTimeoutRefs[sessionID]);

            sessionTimeoutRefs[sessionID] = setTimeout(() => {
                // double check before starting room deletion that there are still no socket connections
                const finalCheck = io.sockets.adapter.rooms.get(sessionID);

                // if room is still empty after 5 minutes
                if (!finalCheck || finalCheck.size <= 0) {
                    // get users to wipe and remove their data
                    const usersToWipe = Object.values(activeUsers).filter(u => u.sessionID === sessionID);
                    usersToWipe.forEach(user => {
                        delete activeUsers[user.uuid];
                    });

                    delete activeSessions[sessionID];
                    delete sessionTimeoutRefs[sessionID];

                    console.log(`[CLEANUP] Session ${sessionID} has been deleted due to inactivity.`);
                }
            }, 300000); // 5 minutes     
            return true;
        }
        return false;
    };

    // -------------------------------------- PROFILE HELPERS --------------------------------------

    // returns session information
    const getSession = (sessionID) => {
        return activeSessions[sessionID] || null;
    };

    // ------------------------------------------ PUBLIC API ------------------------------------------
    return{
        broadcastUpdate,
        purgeUser,
        cancelSessionDeletion,
        handleSessionCleanup,
        getSession,

        // -------------------------------------- PROFILE HELPERS --------------------------------------
        updateUser: (user, data) => {
            if (!activeUsers[user.uuid]) return null;

            return activeUsers[user.uuid] = { 
                ...user, 
                ...data
            };
        },

        // -------------------------------------- HOME HELPERS --------------------------------------
        getUser: (uuid, sessionID = null) => {
            const user = activeUsers[uuid];
            // return null if user doesn't exist or are in a different session
            if (!user) return null;
            if (sessionID && user.sessionID !== sessionID) return null;
            return {...user};
        },

        // ensure session always has a host (host leaves without selecting new host or disconnect)
        ensureHostExists: (sessionID, leavingUUID) => {
            const remainingUsers = Object.values(activeUsers).filter(
                u => u.sessionID === sessionID && u.uuid !== leavingUUID
            );
            if (remainingUsers.length > 0) {
                const newHostUUID = remainingUsers[0].uuid;
                // activeUsers[newHostUUID].isHost = true;
                // activeSessions[sessionID].hostUUID = newHostUUID;

                // activeUsers[leavingUUID].isHost = false;

                // io.to(sessionID).emit('host-change', newHostUUID);
                // broadcastUpdate(sessionID, `[HOST CHANGE] New host is ${newHostUUID}`);

                const leavingUser = activeUsers[leavingUUID];
                const targetUser = activeUsers[newHostUUID];
                const session = activeSessions[sessionID];

                if (!session) throw new Error('[ENSURE HOST EXISTS] Unable to retrieve session information.');
                if (!leavingUser) throw new Error('[ENSURE HOST EXISTS] Unable to retrieve user information.');
                if (!targetUser) throw new Error(`[ENSURE HOST EXISTS] Transfer failed: unable to retrieve target user ${newHostUUID} information.`);
                if (!leavingUser.isHost ) throw new Error(`[ENSURE HOST EXISTS] Unauthorized transfer attempt by ${leavingUser?.name || socket.id}`);

                const leavingSocket = io.sockets.sockets.get(leavingUser.socketID);
                const targetSocket = io.sockets.sockets.get(targetUser.socketID);
                if (!targetSocket) console.log(`[ENSURE HOST EXISTS] target user ${newHostUUID} socket not found in session. User is offline.`);

                session.hostUUID = newHostUUID;

                leavingUser.isHost = false;
                targetUser.isHost = true;
                
                leavingSocket.user = leavingUser;
                if (targetSocket) {
                    targetSocket.user = targetUser; 
                }

                io.to(sessionID).emit('host-change', newHostUUID);
                broadcastUpdate(sessionID, `[HOST CHANGE (ensureHostExists)] New host is ${newHostUUID}`);


                return true;
            }
            return false;
        },

        purgeSession: (sessionID) => {
            if (!sessionID) return false;

            const session = io.sockets.adapter.rooms.get(sessionID);
            if (!session) return false;

            // loop through all users in session, delete their data
            for (const socketID of session) {
                const socketObject = io.sockets.sockets.get(socketID);
                const userUUID = socketToUUID[socketID];

                if (!socketObject || !userUUID) {
                    console.log(`[PURGE] Skipping socket ${socketID}: missing mapping.`);
                    continue;
                }

                // returns true if successfully purged
                const purged = purgeUser(userUUID, sessionID, socketObject);
                if (!purged) {
                    console.log(`User ${userUUID} was unable to be purged.`);
                }
            }
            // remove session from active sessions, 
            // clear the session deletion timer if it exists
            delete activeSessions[sessionID];
            cancelSessionDeletion(sessionID);

            return true;
        }   
    };
};