// sessionServices.js

const crypto = require('crypto');

// tracking "deletion tickets" to stop countdown before server deletion
const sessionTimeoutRefs = {};

module.exports = (io, activeUsers, activeSessions, socketToUUID) => {
    // internal helper: broadcast
    const broadcastUpdate = (sessionID, logMessage) => {
        if (!sessionID || !io) return;
        const usersInSession = Object.values(activeUsers).filter(u => u.sessionID === sessionID);
        io.to(sessionID).emit('user-update', usersInSession);

        console.log(`--- SESSION UPDATE: ${sessionID} ----`);
        console.log(logMessage);
        console.log(`Current Active Users: ${usersInSession.length}`);
        console.log(JSON.stringify(usersInSession, null, 2));
        console.log('------------------------------');
    };

    // internal helper: timer cancellation
    const cancelSessionDeletion = (sessionID) => {   
        if (sessionTimeoutRefs[sessionID]) {
            clearTimeout(sessionTimeoutRefs[sessionID]);
            delete sessionTimeoutRefs[sessionID];
            console.log(`Timer cancelled for session ${sessionID}. User has returned in time.`);
        }
    };

    // helper to handle the "empty session" timer
    const handleSessionCleanup = (sessionID) => {
        if (!sessionID) return;

        const usersInSession = Object.values(activeUsers).filter(u => u.sessionID === sessionID);
        const numUsers = usersInSession.length;
        
        if (numUsers <= 0) {
            console.log(`Session ${sessionID} is empty. Starting 5-minute deletion timer...`);
            if (sessionTimeoutRefs[sessionID]) clearTimeout(sessionTimeoutRefs[sessionID]);

            sessionTimeoutRefs[sessionID] = setTimeout(() => {
                const finalCheck = io.sockets.adapter.rooms.get(sessionID);
                if (!finalCheck || finalCheck.size <= 0) {
                    delete activeSessions[sessionID];
                    delete sessionTimeoutRefs[sessionID];
                    Object.keys(activeUsers).forEach(uuid => {
                        if (activeUsers[uuid].sessionID === sessionID) {
                            delete activeUsers[uuid];
                        }
                    });
                    console.log(`Session ${sessionID} has been deleted due to inactivity.`);
                }
            }, 300000); // 5 minutes
        }
    };

    return {
        broadcastUpdate,
        cancelSessionDeletion,
        handleSessionCleanup,

        // generates sessionID
        generateUniqueCode: () => {
            let sessionID;
            let isUnique = false;
            while (!isUnique) {
                sessionID = Math.random().toString(36).substring(2,8).toUpperCase().padEnd(6,0);
                if (!activeSessions[sessionID]) isUnique = true;
            }
            return sessionID;
        },

        handleUserJoiningSession: (socket, sessionID, existingUUID = null) => {
            // Stop the deletion timer if it's running
            cancelSessionDeletion(sessionID);
            // identity handshake: use old ID or create a new one, link current socket connection to this permanent UUID
            const userUUID = existingUUID || crypto.randomUUID();

            // force purge: look for any record already using this UUID
            // if it exists, kill the old socket mapping before continuing
            if (activeUsers[userUUID]) {
                const oldSessionID = activeUsers[userUUID].sessionID;
                const oldSocketID = activeUsers[userUUID].socketID;
                // only cleanup if the socket ID has changed
                if (oldSocketID !== socket.id) {
                    console.log(`[GHOST BUSTER] Removing old socket ${oldSocketID} for UUID ${userUUID}`);
                    delete socketToUUID[oldSocketID];

                    const oldSocket = io.sockets.sockets.get(oldSocketID);
                    if (oldSocket && oldSessionID && oldSessionID !== sessionID) {
                        // only leave if user is moving to a different session
                        oldSocket.leave(oldSessionID);
                    }
                }
            }

            // update mappings
            socketToUUID[socket.id] = userUUID;

            // check to see if the session already has a host
            const hasHost = Object.values(activeUsers).some(
                u => u.sessionID === sessionID && u.isHost && u.uuid !== userUUID
            );

            // reconnecting logic
            const isReconnecting = !!activeUsers[userUUID];
            if (isReconnecting) {
                // if a reconnection, update the new socket line
                activeUsers[userUUID].socketID = socket.id;
                activeUsers[userUUID].sessionID = sessionID;
                activeUsers[userUUID].isHost = !hasHost;
            } else {
                // if not reconnecting and is a new user, create profile
                activeUsers[userUUID] = {
                    uuid: userUUID,
                    socketID: socket.id,
                    name: "New User",
                    color: "#cccccc",
                    sessionID: sessionID,
                    // if no host exists, this person is the host
                    isHost: !hasHost,
                    isFullyRegistered: false
                };
            }

            socket.join(sessionID);
            socket.join(userUUID);
            activeSessions[sessionID] = true;

            // broadcast so everyone's list is in sync
            const user = activeUsers[userUUID];
            const statusMessage = isReconnecting ? `User ${user.name} reconnected.` : `User ${user.name} joined.`;
            broadcastUpdate(sessionID, statusMessage);

            if (user.isHost) {
                console.log(`User ${user.name} is assigned as host for session ${sessionID}`);
                io.to(sessionID).emit('host-change', userUUID);
            }

            // THE MANUAL STAMP (for middleware)
            socket.user = user;
            socket.userUUID = user.uuid;
            socket.sessionID = cleanSessionID;
            
            return user;
        },

        // helper to ensure session always has a host (host leaves without selecting new host)
        ensureHostExists: (sessionID, leavingUUID) => {
            const remainingUsers = Object.values(activeUsers).filter(
                u => u.sessionID === sessionID && u.uuid !== leavingUUID
            );
            if (remainingUsers.length > 0) {
                const newHost = remainingUsers[0];
                newHost.isHost = true;
                io.to(sessionID).emit('host-change', newHost.uuid);
                broadcastUpdate(sessionID, `[HOST CHANGE] New host is ${newHost.uuid}`);
            }
        }
    };
};