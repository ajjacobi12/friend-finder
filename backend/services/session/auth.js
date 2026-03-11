// backend/services/session/auth.js
// handles logic of getting into system
const crypto = require('crypto');

module.exports = (io, activeUsers, activeSessions, socketToUUID, maxSessionCapacity, core) => {
    // -------------------------------------- LOGIN HELPERS --------------------------------------
    // generates sessionID
    const generateUniqueCode = () => {
        let sessionID;
        let isUnique = false;
        while (!isUnique) {
            sessionID = Math.random().toString(36).substring(2,8).toUpperCase().padEnd(6,0);
            if (!core.getSession[sessionID]) isUnique = true;
        }
        return sessionID;
    };

    // checks to see if session is already at max capacity for a joining user
    const checkSessionCapacity = (sessionID, existingUUID, cb) => {
        const usersInSession = Object.values(activeUsers).filter(u => u.sessionID === sessionID);          
        const isReturningUser = !!(existingUUID && activeUsers[existingUUID] && activeUsers[existingUUID].sessionID === sessionID);
        if(usersInSession.length >= maxSessionCapacity && !isReturningUser) {
            cb({ success: false, error: "Session is full." });
            return true;
        } else {
            return false;
        }
    };

    return {
        generateUniqueCode,
        checkSessionCapacity,

        // -------------------------------------- LOGIN HELPERS --------------------------------------
        // ensures session exists in server memory
        checkExistingSession: (sessionID, cb) => {
            if(!activeSessions[sessionID]) {
                cb({ success: false, error: "Session does not exist." });
                return false;
            }
            return true;
        },

        // handles initial part of user joining a session (checks requirements, creates user data on backend)
        handleUserJoining: (socket, sessionID, existingUUID = null, profile = null, cb) => {
            // Stop the deletion timer if it's running
            core.cancelSessionDeletion(sessionID);

            // ensure session is not already at capacity
            if (checkSessionCapacity(sessionID, existingUUID, cb)) return null;
            
            console.log("existing UUID: ", existingUUID);
            // identity handshake: use old ID or create a new one
            const userUUID = existingUUID || crypto.randomUUID();

            // --- GHOST BUSTING ---
            // force purge: look for any record already using this UUID
            // if it exists, kill the old socket mapping before continuing
            const ghostBuster = (uuid) => {
                // only cleanup if the old user exists and socket ID has changed
                const oldUser = activeUsers[uuid];
                if(oldUser && oldUser.socketID !== socket.id) {
                    delete socketToUUID[oldUser.socketID];
                    console.log(`[GHOST BUSTER] Removed old socket-to-UUID mapping ${oldUser.socketID} for UUID ${uuid}`);

                    // get old socket
                    // if it exists and the user has input a new sessionID, leave the old socket
                    const oldSocket = io.sockets.sockets.get(oldUser.socketID);
                    if (oldSocket && oldUser.sessionID && oldUser.sessionID !== sessionID) {
                        oldSocket.leave(oldUser.sessionID);
                        core.handleSessionCleanup(oldUser.sessionID);
                        console.log(`[GHOST BUSTER] New sessionID, user ${uuid} left old socket.`);
                    }
                }
            };
            ghostBuster(userUUID);

            // --- STATE ASSIGNMENT ---
            // update mappings, link current socket connection to this UUID
            // check to see if host already exists for this session
            socketToUUID[socket.id] = userUUID;
            const hasHost = Object.values(activeUsers).some(
                u => u.sessionID === sessionID && u.isHost && u.uuid !== userUUID
            );

            // --- RECONNECTION ---
            const isReconnecting = !!activeUsers[userUUID];
            if (isReconnecting) {
                // if a reconnection, update the new socket line, keep all old information
                activeUsers[userUUID].socketID = socket.id;
                activeUsers[userUUID].sessionID = sessionID;
                activeUsers[userUUID].lastSeen = Date.now();
                activeUsers[userUUID].status = 'online';
            } else {
                // if not reconnecting and is a new user, create profile
                activeUsers[userUUID] = {
                    uuid: userUUID,
                    socketID: socket.id,
                    name: profile?.name || null,
                    color: profile?.color || null,
                    sessionID: sessionID,
                    // if no host exists, this person is the host
                    isHost: !hasHost,
                    isRegistered: false,
                    lastSeen: Date.now(),
                    status: 'online'
                };
            }

            // --- FINALIZE CONNECTION ---
            // link to socket with  sessionID and userUUID
            // broadcast and sync everyone's user list
            // update frontend on host status if needed
            socket.join(sessionID);
            socket.join(userUUID);
            activeSessions[sessionID] = core.getSession(sessionID) || { hostUUID: activeUsers[userUUID].isHost ? userUUID : null };

            const user = activeUsers[userUUID];
            core.broadcastUpdate(sessionID, isReconnecting ? `User ${user.name} reconnected.` : `User ${user.name} joined.`);

            if (user.isHost) io.to(sessionID).emit('host-change', userUUID);

            // --- THE MANUAL STAMP (for middleware) ---
            socket.user = user;
            socket.userUUID = user.uuid;
            socket.sessionID = sessionID;
            
            return user;
        },

        // helper to finalize creating/joining session (second step)
        finalizeSession: (listenerName, user, sessionID, cb) => {
            if (!user) throw new Error("Protocol error: unable to create user.");

            const usersList = Object.values(activeUsers).filter(u => u.sessionID === sessionID);          
            const isRegistered = !!(user.name && user.isRegistered);

            console.log(`[${listenerName}] Session: ${sessionID} | User: ${user.uuid} | Returning: ${isRegistered}`);

            return cb({ 
                success: true, 
                exists: true,
                full: false,
                sessionID,
                userUUID: user.uuid,
                isRegistered,
                isHost: user.isHost || false,
                currentUsers: usersList,
                name: user.name,
                color: user.color
            });
        },

        // -------------------------------------- PROFILE HELPERS --------------------------------------
        colorTaken: (sessionID, user, profile, cb) => {
            const isColorTaken = Object.values(activeUsers).some(
                    u => u.sessionID === sessionID && u.uuid !== user.uuid && u.color === profile.color
                );
            if (isColorTaken) {
                cb({ success: false, error: "Color was just taken. Please choose another."});
                return true;
            } else {
                return false;
            }
        },

    };
};