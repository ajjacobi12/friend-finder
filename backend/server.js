// 1. import the "engines"
const express = require('express'); // pulls blueprints for express framework
const { send } = require('process');
const { text } = require('stream/consumers');
const app = express(); // creates an instance of Express app, handles web routes and logic
const http = require('http').createServer(app); // the "wrapping", takes built-in Node "http" module and creates physical server, passes app into it so the server knows to use Express to handle incoming web requests
const io = require('socket.io')(http, {
    cors: {
        origin: "*", // this allows phone to talk to computer
        methods: ["GET", "POST"]
    },
    pingTimeout: 2000, // wait 2 seconds before declaring "dead"
    pingInterval: 5000 // send a ping every 5 seconds
}); // imports socket.io (tool for real-time, two-way communication), and attaches it to "http" server

// 2. set up the "static folder"
app.use(express.static('public')); // tells Express, "if anyoneasks for a file (eg. image, CSS file, or html page), look inside a folder named public". This is howto "serve" the frontend code to the user's browser

// object to store users { "socketID", name: ...,  color: ..., isHost: ...}
const activeUsers = {}; // key: UUID, value: {name, color, socketid, etc.}
const socketToUUID = {}; // key: socketID, value: UUID (for quick lookup)

// tracks active room IDs
const activeSessions = {};

// tracking "deletion tickets" to stop countdown before server deletion
const roomTimeoutRefs = {};

// helper to broadcast to everyone in a room to update their UI
const broadcastUpdate = (roomID, logMessage) => {
    if (!roomID) return;
    const usersInRoom = Object.values(activeUsers).filter(u => u.sessionId === roomID);
    io.to(roomID).emit('user-update', usersInRoom);

    console.log(`--- ROOM UPDATE: ${roomID} ----`);
    console.log(logMessage);
    console.log(`Current Active Users: ${usersInRoom.length}`);
    console.log(JSON.stringify(usersInRoom, null, 2));
    console.log('------------------------------');
};

const handleUserJoiningRoom = (socket, roomID, existingUUID = null) => {
    // Stop the deletion timer if it's running
    cancelRoomDeletion(roomID);
    // identity handshake: use old ID or create a new one, link current socket connection to this permanent UUID
    const userUUID = existingUUID || crypto.randomUUID();
    socketToUUID[socket.id] = userUUID;

    // check to see if the session already has a host
    const hasHost = Object.values(activeUsers).some(u => u.sessionId === roomID && u.isHost);

    const isReconnecting = !!activeUsers[userUUID];
    if (isReconnecting) {
        // if a reconnection, update the new socket line
        activeUsers[userUUID].socketId = socket.id;
        activeUsers[userUUID].sessionId = roomID;
        if (!hasHost) activeUsers[userUUID].isHost = true;
    } else {
        // if not reconnecting and is a new user, create profile
        activeUsers[userUUID] = {
            id: userUUID,
            socketId: socket.id,
            name: "New User",
            color: "#cccccc",
            sessionId: roomID,
            // if no host exists, this person is the host
            isHost: !hasHost
        };
    }

    socket.join(roomID);
    socket.join(userUUID);
    activeSessions[roomID] = true;

    // broadcast so everyone's list is in sync
    const user = activeUsers[userUUID];
    const statusMessage = isReconnecting ? `User ${user.name} reconnected.` : `User ${user.name} joined.`;
    broadcastUpdate(roomID, statusMessage);

    if (user.isHost) {
        console.log(`User ${user.name} is assigned as host for room ${roomID}`);
        io.to(roomID).emit('host-change', userUUID);
    }
    
    return userUUID;
};

// helper to handle the "empty room" timer
const handleRoomCleanup = (roomID) => {
    if (!roomID) return;

    const room = io.sockets.adapter.rooms.get(roomID);
    const numClients = room ? room.size : 0;
    
    if (numClients <= 0) {
        console.log(`Room ${roomID} is empty. Starting 5-minute deletion timer...`);
        if (roomTimeoutRefs[roomID]) clearTimeout(roomTimeoutRefs[roomID]);

        roomTimeoutRefs[roomID] = setTimeout(() => {
            const finalCheck = io.sockets.adapter.rooms.get(roomID);
            if (!finalCheck || finalCheck.size <= 0) {
                delete activeSessions[roomID];
                delete roomTimeoutRefs[roomID];
                Object.keys(activeUsers).forEach(id => {
                    if (activeUsers[id].sessionId === roomID) {
                        delete activeUsers[id];
                    }
                });
                console.log(`Room ${roomID} has been deleted due to inactivity.`);
            }
        }, 300000); // 5 minutes
    }
};

const cancelRoomDeletion = (roomID) => {   
    if (roomTimeoutRefs[roomID]) {
        clearTimeout(roomTimeoutRefs[roomID]);
        delete roomTimeoutRefs[roomID];
        console.log(`Timer cancelled for ${roomID}. User has returned in time.`);
    }
};

// helper to ensure room always has a host (host leaves without selecting new host)
const ensureHostExists = (roomID, leavingUUID) => {
    const remainingUsers = Object.values(activeUsers).filter(
        u => u.sessionId === roomID && u.id !== leavingUUID
    );
    if (remainingUsers.length > 0) {
        const newHost = remainingUsers[0];
        newHost.isHost = true;
        console.log(`[HOST CHANGE] New host for room ${roomID} is ${newHost.id}`);
        io.to(roomID).emit('host-change', newHost.id);
        broadcastUpdate(roomID, `${newHost.name} has been promoted to host.`);
    };
};

// 3. handle live connections
io.on('connection', (socket) => { // an event listener -- waits for user to open the app, and when opened, it triggers a function that gives that specific user a unique "socket" object (their personal "phone line" to the server)
    // io.on('..', (ALWAYS gives socket/ID number))
    // socket.on('..', (ALWAYS gives data, eg. message))
    console.log(`New user connected: ${socket.id}`);
 
    // ---- CREATE SESSION -----
    socket.on('create-session', (roomID, callback) => {
        const userUUID = handleUserJoiningRoom(socket, roomID, null);
        console.log(`Session Created: ${roomID}`);

        if (typeof callback == 'function') {
            // return new UUID so phone can store it
            callback({ userUUID });
        }
    });

    // ---- JOIN A SESSION ----
    socket.on('join-session', (data, callback) => {
        // data can be either a just a string "roomID", or an object { roomID, existingUUID }
        const roomID = typeof data === 'string'? data : data.roomID;
        const existingUUID = data.existingUUID || null;

        console.log(`Request to join room: ${roomID} from ${socket.id}`);

        // checks to see if session exists/is active  
        if (activeSessions[roomID] != undefined) {  
            const usersAlreadyInRoom = Object.values(activeUsers).filter(u => u.sessionId === roomID);          
            const isReturningUser = existingUUID && activeUsers[existingUUID] && activeUsers[existingUUID].sessionId === roomID;

            // checks to see if room is full (skip if a returning user)
            if(usersAlreadyInRoom.length >= 12 && !isReturningUser) {
                console.log(`Failed: Room ${roomID} is full.`);
                if (typeof callback == 'function') {
                    callback({ exists: true, full: true });
                }
            } else {
                // pass existing UUID to helper
                const userUUID = handleUserJoiningRoom(socket, roomID, existingUUID);
                // get user's data to see if they were already registered
                const userData = activeUsers[userUUID];
                const alreadyRegistered = !!(userData && userData.name && userData.name !== "");
                // refresh current user list
                const currentUsers = Object.values(activeUsers).filter(u => u.sessionId === roomID);
                if (typeof callback == 'function') {
                    callback({ 
                        exists: true, 
                        full: false, 
                        currentUsers, 
                        userUUID,
                        alreadyRegistered,
                        userData: alreadyRegistered ? { name: userData.name, color: userData.color } : null,
                        isHost: userData.isHost || false
                    });
                }
            }
        } else {
            console.log(`Failed: Room ${roomID} does not exist.`);
            if (typeof callback == 'function') { 
                callback({ exists : false });
            }
        }
    });

    // ---- UPDATE PROFILE -----
    socket.on('update-user', (profile, callback) => {
        // profile = { name: ..., color: ...}
        const userUUID = socketToUUID[socket.id];

        // if we can't find user, don't try and update them
        if (!userUUID || !activeUsers[userUUID])   {
            console.log(`Update failed: no UUID found for socket ${socket.id}`);
            return;
        }

        // color taken logic
        const roomID = activeUsers[userUUID].sessionId;
        const isColorTaken = Object.values(activeUsers).some
            (u => u.sessionId === roomID && u.id !== userUUID && u.color === profile.color);
        if (isColorTaken) {
            if (typeof callback === 'function') {
                callback({ success: false, message: "That color was just taken! Please choose another one." });
            }
            return;
        }

        // update profile while preserving critical server-side data
        activeUsers[userUUID] = { 
            ...activeUsers[userUUID], 
            name: profile.name, 
            color: profile.color 
        };

        if (typeof callback === 'function') {
            callback({ success: true });
        }

        // broadcast refreshed list to everyone in that session
        broadcastUpdate(activeUsers[userUUID].sessionId, `User ${userUUID} (${profile.name}) updated their profile.`);
    });

    // --- CASE 1: user voluntarily leaves session (exit room)
    socket.on('leave-session', (roomID) => {
        const uuid = socketToUUID[socket.id];
        const user = activeUsers[uuid];

        if (!user) return; // if user is gone from records, do nothing

        const userName = user.name || "Unknown User";

        // if user was the host, pick a new one
        if (user.isHost === true) {
            ensureHostExists(roomID, uuid);
        }

        // delete user data
        delete activeUsers[uuid];  
        delete socketToUUID[socket.id];

        // remove sockets from rooms
        socket.leave(roomID);
        socket.leave(uuid);
        
        broadcastUpdate(roomID, `User ${userName} left room ${roomID}`);

        // check if room is now empty
        setTimeout(() => {
            handleRoomCleanup(roomID);
        }, 50);         
    });

    // ---- CASE 2: DISCONNECT (eg. unexpected exits, closing the app) ----------
    socket.on('disconnect', () => { 
        const uuid = socketToUUID[socket.id];
        const user = activeUsers[uuid];

        if (user) {
            const roomID = user.sessionId;
            const userName = user.name || "Unknown User";
            console.log(`[BLINK] User ${userName} disconnected. Waiting for grace period...`);

            // immediate UI cleanup, stop anytyping indicaters
            socket.broadcast.emit('user-stop-typing', { id: uuid });

            // start grace period of 15 seconds
            setTimeout(() => {
                // check if user is still associated with the disconnected socket
                // if they reconnect, activeUsers[uuid].socketId will be different
                if (activeUsers[uuid] && activeUsers[uuid].socketId === socket.id)  {
                    console.log(`[EXIT] Grace period expired for ${userName}. Cleaning up.`);

                    // leave logic
                    if (user.isHost === true) ensureHostExists(roomID, uuid);

                    // clean memory
                    delete activeUsers[uuid];
                    delete socketToUUID[socket.id];

                    // broadcast and room check
                    handleRoomCleanup(roomID);
                    broadcastUpdate(roomID, `User ${userName} left room ${roomID}`);
                } else {
                    // if user reconnects in time, socket.id should be changed
                    console.log(`[RECOVERY] User ${userName} reconnected within grace period.`);
                    // remove old socket mapping
                    delete socketToUUID[socket.id]; 
                }
            }, 15000);
        }
    });

    // --- CASE 3: Host ends session for everyone ----
    socket.on('end-session', (roomID) => {
        const senderUUID = socketToUUID[socket.id];
        const sender = activeUsers[senderUUID];

        // only host allowed to nuke the room
        if (!sender || !sender.isHost) {
            console.log(`Unauthorized end-session attempt by ${socket.id}`);
            return;
        }

        console.log(`Host ${sender.name} is ending session: ${roomID}`);
        io.to(roomID).emit('session-ended');

        // clean up memory for everyone who was in that room
        Object.keys(activeUsers).forEach(uuid => {
            if (activeUsers[uuid].sessionId === roomID) {
                const userSocketId = activeUsers[uuid].socketId;
                delete socketToUUID[userSocketId];
                delete activeUsers[uuid];
            }
        });

        // remove room from active sessions
        delete activeSessions[roomID];
        if (roomTimeoutRefs[roomID]) {
            clearTimeout(roomTimeoutRefs[roomID]);
            delete roomTimeoutRefs[roomID];
        }

        // force everyone out of socket room
        const room = io.sockets.adapter.rooms.get(roomID);
        if (room) {
            for (const socketId of room) {
                const s = io.sockets.sockets.get(socketId);
                if (s) {
                    s.leave(roomID);
                    // also leave private UUID room
                    const u = socketToUUID[socketId];
                    if (u) s.leave(u);
                }
            }
        }

        console.log(`Session ${roomID} fully purged.`);
    });

    // --- CASE 4: host removes a specific user ---
    socket.on('remove-user', ( {roomID, userUUIDToRemove} ) => {
        const senderUUID = socketToUUID[socket.id];
        const sender = activeUsers[senderUUID];

        // only host can kick people 
        if (!sender || !sender.isHost) return;

        // find victim
        const targetUser = activeUsers[userUUIDToRemove];
        if (!targetUser) return;
        const targetSocket = io.sockets.sockets.get(targetUser.socketId);
        const userName = targetUser.name || "User";

        // force specific socket to leave room
        if (targetSocket) {
            targetSocket.emit('removed-from-session'); // tell victim's app they're being removed
            targetSocket.leave(roomID); 
            targetSocket.leave(userUUIDToRemove);
        }

        // cleanup & notify
        delete socketToUUID[targetUser.socketId];
        delete activeUsers[userUUIDToRemove]; 
        broadcastUpdate(roomID, `User (${userName}) was removed by the host.`);

        handleRoomCleanup(roomID);
    });

    // --- TRANSFER HOST STATUS ----
    socket.on('transfer-host', ( {roomID, newHostUUID} ) => {
        const senderUUID = socketToUUID[socket.id];
        const sender = activeUsers[senderUUID];
        
        // only host can transfer power
        if (!sender || !sender.isHost ) {
            console.log(`Unauthorized transfer attempt by ${sender?.name || socket.id}`);
            return;
        }

        // verify new host exists in room
        const targetUser = activeUsers[newHostUUID];
        if (!targetUser || targetUser.sessionId !== roomID) {
            console.log(`Transfer failed: target user ${newHostUUID} not found in room.`);
            return;
        }

        console.log(`[HOST] Transferring host status in room ${roomID} to ${newHostUUID}`);
        sender.isHost = false;
        targetUser.isHost = true;

        io.to(roomID).emit('host-change', newHostUUID);
        broadcastUpdate(roomID, `${targetUser.name} is now the host.`);
    });

    // --- MESSAGING ----

    const formatOutboundMessage = (user, roomID, context, isDM, messageUUID, senderUUID) => ({
        roomID,
        sender: user.name,
        color: user.color,
        context: {
            text: context.text,
            isEncrypted: context.isEncrypted || false,
            version: context.version || "1.0"
        },
        id: messageUUID,
        senderUUID: senderUUID,
        isDirectMessage: isDM,
        serverTimestamp: Date.now()
    });

    socket.on('send-message', (messageData) => {
        const uuid = socketToUUID[socket.id];
        const sender = activeUsers[uuid];

        // validate the message, don't process empty data
        if (!sender || !messageData.context?.text?.trim() ) return;

        // reconstruct package, don't just send 'messagData', only emit what's necessary
        const outboundData = formatOutboundMessage(
            sender, 
            messageData.roomID, 
            messageData.context, 
            false, 
            crypto.randomUUID(),
            uuid
        );

        // broadcast to everyone in room except sender
        socket.to(messageData.roomID).emit('receive-message', outboundData);
        console.log(`[CHAT] Room ${messageData.roomID} | ${sender.name}: ${outboundData.context.text}`);
    });

    socket.on('send-direct-message', (messageData) => {
        const uuid = socketToUUID[socket.id];
        const sender = activeUsers[uuid];
        const { recipientUUID, context } = messageData;

        if (!sender || !context?.text?.trim() || !recipientUUID) return;
        
        const dmRoomID = [uuid, recipientUUID].sort().join('_');
        const outboundData = formatOutboundMessage(
            sender, 
            dmRoomID, 
            context, 
            true, 
            crypto.randomUUID(),
            uuid
        );

        io.to(recipientUUID).emit('receive-message', outboundData);
        console.log(`DM from ${sender.name} to ${recipientUUID}: ${context.text}`);
    });

    socket.on('join-dm', ( {dmRoomID, targetName} ) => {
        const uuid = socketToUUID[socket.id];
        socket.join(dmRoomID);
        console.log(`User ${uuid} is joining DM room: ${dmRoomID} with ${targetName}`);
    });

    socket.on('typing', (data) => {
        const uuid = socketToUUID[socket.id];
        if (!uuid) return;

        socket.to(data.roomID).emit('user-typing', {
            roomID: data.roomID,
            name: data.name,
            id: uuid
        }); 
    });

    socket.on('stop-typing', (data) => {
        const uuid = socketToUUID[socket.id];
        if (!uuid) return;

        socket.to(data.roomID).emit('user-stop-typing', {
            id: uuid
        });
    });

});

// 4. start the server
const PORT = 3000; // think of as "door number" of server
http.listen(PORT, '0.0.0.0', () => { // tells http server (the one wrapping everything) to start listneing for traffic on door 3000
    console.log(`Server is running on all interfaces at port ${PORT}`); // message to let you know server started successfully without any errors
});