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
const crypto = require('crypto');

// 2. set up the "static folder"
app.use(express.static('public')); // tells Express, "if anyoneasks for a file (eg. image, CSS file, or html page), look inside a folder named public". This is howto "serve" the frontend code to the user's browser

// object to store users { "socketID", name: ...,  color: ..., isHost: ...}
const activeUsers = {}; // key: , value: {name, color, socketID, etc.}
const socketToUUID = {}; // key: socketID, value: UUID (for quick lookup)

// tracks active room IDs
const activeSessions = {};

// tracking "deletion tickets" to stop countdown before server deletion
const roomTimeoutRefs = {};

const maxSessionCapacity = 12;

// helper to broadcast to everyone in a room to update their UI
const broadcastUpdate = (roomID, logMessage) => {
    if (!roomID) return;
    const usersInRoom = Object.values(activeUsers).filter(u => u.sessionID === roomID);
    io.to(roomID).emit('user-update', usersInRoom);

    console.log(`--- ROOM UPDATE: ${roomID} ----`);
    console.log(logMessage);
    console.log(`Current Active Users: ${usersInRoom.length}`);
    console.log(JSON.stringify(usersInRoom, null, 2));
    console.log('------------------------------');
};

// generates roomID
const generateUniqueCode = () => {
    let code;
    let isUnique = false;
    while (!isUnique) {
        code = Math.random().toString(36).substring(2,8).toUpperCase();
        if (!activeSessions[code]) {
            isUnique = true;
        }
    }
    return code;
};

const handleUserJoiningRoom = (socket, roomID, existingUUID = null) => {
    // Stop the deletion timer if it's running
    cancelRoomDeletion(roomID);
    // identity handshake: use old ID or create a new one, link current socket connection to this permanent UUID
    const userUUID = existingUUID || crypto.randomUUID();

    // force purge: look for any record already using this UUID
    // if it exists, kill the old socket mapping before continuing
    if (activeUsers[userUUID]) {
        const oldRoomID = activeUsers[userUUID].sessionID;
        const oldsocketID = activeUsers[userUUID].socketID;
        // only cleanup if the socket ID has changed
        if (oldsocketID !== socket.id) {
            console.log(`[GHOST BUSTER] Removing old socket ${oldsocketID} for UUID ${userUUID}`);
            delete socketToUUID[oldsocketID];

            const oldSocket = io.sockets.sockets.get(oldsocketID);
            if (oldSocket && oldRoomID && oldRoomID !== roomID) {
                // only leave if user is moving to a different room
                oldSocket.leave(oldRoomID);
            }
        }
    }

    // update mappings
    socketToUUID[socket.id] = userUUID;

    // check to see if the session already has a host
    const hasHost = Object.values(activeUsers).some(
        u => u.sessionID === roomID && u.isHost && u.uuid !== userUUID
    );

    // reconnecting logic
    const isReconnecting = !!activeUsers[userUUID];
    if (isReconnecting) {
        // if a reconnection, update the new socket line
        activeUsers[userUUID].socketID = socket.id;
        activeUsers[userUUID].sessionID = roomID;
        activeUsers[userUUID].isHost = !hasHost;
    } else {
        // if not reconnecting and is a new user, create profile
        activeUsers[userUUID] = {
            uuid: userUUID,
            socketID: socket.id,
            name: "New User",
            color: "#cccccc",
            sessionID: roomID,
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
    
    return user;
};

// helper to handle the "empty room" timer
const handleRoomCleanup = (roomID) => {
    if (!roomID) return;

    const usersInRoom = Object.values(activeUsers).filter(u => u.sessionID === roomID);
    const numUsers = usersInRoom.length;
    
    if (numUsers <= 0) {
        console.log(`Room ${roomID} is empty. Starting 5-minute deletion timer...`);
        if (roomTimeoutRefs[roomID]) clearTimeout(roomTimeoutRefs[roomID]);

        roomTimeoutRefs[roomID] = setTimeout(() => {
            const finalCheck = io.sockets.adapter.rooms.get(roomID);
            if (!finalCheck || finalCheck.size <= 0) {
                delete activeSessions[roomID];
                delete roomTimeoutRefs[roomID];
                Object.keys(activeUsers).forEach(uuid => {
                    if (activeUsers[uuid].sessionID === roomID) {
                        delete activeUsers[uuid];
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
        u => u.sessionID === roomID && u.uuid !== leavingUUID
    );
    if (remainingUsers.length > 0) {
        const newHost = remainingUsers[0];
        newHost.isHost = true;
        io.to(roomID).emit('host-change', newHost.uuid);
        broadcastUpdate(roomID, `[HOST CHANGE] New host for room ${roomID} is ${newHost.uuid}`);
    };
};

// helper to sanitize any text/name
const sanitize = (text) => {
    if (typeof text !== 'string') return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

// helper to get target room for start/stopping typing
const getRoomData = (roomID, senderUUID) => {
    const isDM = roomID.includes('_');
    const targetRoom = isDM 
    ? roomID.split('_').find(uuid => uuid !== senderUUID)
    : roomID;
    return { targetRoom, isDM };
};

// helper for callbacks
const handleEvent = (handler) => {
    return async (data, callback) => {
        // Automatically creates the safeCallback for you
        const cb = typeof callback === 'function' ? callback : () => {};
        try {
            await handler(data, cb);
        } catch (err) {
            console.error("Socket Error:", err);
            cb({ success: false, error: err.message || "Internal Server Error" });
        }
    };
};

// 3. handle live connections
io.on('connection', (socket) => { // an event listener -- waits for user to open the app, and when opened, it triggers a function that gives that specific user a unique "socket" object (their personal "phone line" to the server)
    // io.on('..', (ALWAYS gives socket/ID number))
    // socket.on('..', (ALWAYS gives data, eg. message))
    console.log(`New user connected: ${socket.id}`);
 
    // ---- CREATE SESSION -----
    socket.on('create-session', handleEvent(async ({ existingUUID }, cb) => {
        const roomID = generateUniqueCode();
        const user = handleUserJoiningRoom(socket, roomID, existingUUID);
        console.log(`Session Created: ${roomID} for user: ${user.uuid}`);

        // return new UUID so phone can store it
        cb({ 
            success: true, 
            exists: true,
            full: false,
            roomID: roomID, 
            userUUID: user.uuid,
            alreadyRegistered: false, 
            isHost: user.isHost || false,
            currentUsers: [user],
            name: user.name,
            color: user.color
        });
    }));

    // ---- JOIN A SESSION ----
    socket.on('join-session', handleEvent(async ({ roomID, existingUUID = null }, cb) => {
        // ensure roomID was passed & session exists
        if (!roomID) return cb({ success: false, error: "No session code provided." });
        if(!activeSessions[roomID]) return cb({ success: false, exists: "Session does not exist." });

        // check capacity and returning user status 
        const usersInRoom = Object.values(activeUsers).filter(u => u.sessionID === roomID);          
        const isReturningUser = !!(existingUUID && activeUsers[existingUUID] && activeUsers[existingUUID].sessionID === roomID);

        // checks to see if room is full (skip if a returning user)
        if(usersInRoom.length >= maxSessionCapacity && !isReturningUser) {
            return cb({ success: false, error: "Session is full." });
        } 

        // everything is good, join and check to see if they are returning 
        // based on default color & name
        const user = handleUserJoiningRoom(socket, roomID, existingUUID);
        const alreadyRegistered = !!(user && user.color !== '#cccccc' && user.name !== "New User");
        console.log(`[JOIN] Room: ${roomID} | User: ${user.uuid} | Returning: ${alreadyRegistered}`);
        cb({ 
            success: true, 
            exists: true,
            full: false,
            userUUID: user.uuid,
            alreadyRegistered,
            isHost: user.isHost || false,
            currentUsers: usersInRoom,
            name: user.name,
            color: user.color
        });
    }));

    // ---- UPDATE PROFILE -----
    socket.on('update-user', handleEvent(async (profile, cb) => {
        const userUUID = socketToUUID[socket.id];
        const user = activeUsers[userUUID];

        // if we can't find user, don't try and update them
        if (!userUUID || !user)   {
            throw new Error(`[UPDATE] failed: no UUID found for socket ${socket.id}`);
        }

        // color taken logic
        const roomID = user.sessionID;
        const isColorTaken = Object.values(activeUsers).some(
            u => u.sessionID === roomID && u.uuid !== userUUID && u.color === profile.color
        );
        if (isColorTaken) {
            return cb({ success: false, error: "Color was just taken. Please choose another."});
        }

        // sanitize and update memory
        const cleanName = sanitize(profile.name || "Anonymous");
        activeUsers[userUUID] = { 
            ...user, 
            name: cleanName, 
            color: profile.color 
        };

        cb({ success: true });
        // broadcast refreshed list to everyone in that session
        broadcastUpdate(roomID, `User ${cleanName} updated their profile.`);
    }));

    // --- CASE 1: user voluntarily leaves session (exit room)
    socket.on('leave-session', handleEvent(async ({ roomID }, cb) => {
        const userUUID = socketToUUID[socket.id];
        const user = activeUsers[userUUID];

        // if user is gone from records, do nothing
        if (!user) return cb({ success: true });

        const userName = user.name || "Unknown User";

        // if user was the host, pick a new one
        if (user.isHost === true) ensureHostExists(roomID, userUUID);

        // delete user data & remove sockets
        delete activeUsers[userUUID];  
        delete socketToUUID[socket.id];
        socket.leave(roomID);
        socket.leave(userUUID);

        cb({ success: true });

        broadcastUpdate(roomID, `User ${userName} left room ${roomID}`);
        
        // check if room is now empty
        setTimeout(() => {
            handleRoomCleanup(roomID);
        }, 50);         
    }));

    // ---- CASE 2: DISCONNECT (eg. unexpected exits, closing the app) ----------
    socket.on('disconnect', () => { 
        const userUUID = socketToUUID[socket.id];
        const user = activeUsers[userUUID];

        if (!user) return;

        const roomID = user.sessionID;
        const userName = user.name || "Unknown User";
        console.log(`[BLINK] User ${userName} disconnected. Waiting for grace period...`);

        // immediate UI cleanup, stop anytyping indicaters
        socket.broadcast.emit('user-stop-typing', { senderUUID: userUUID });

        // start grace period of 15 seconds
        setTimeout(() => {
            // get most current version of user
            const currentUser = activeUsers[userUUID];
            // check if user is still associated with the disconnected socket
            // if they reconnect, activeUsers[userUUID].socketID will be different
            if (currentUser && currentUser.socketID === socket.id)  {
                console.log(`[EXIT] Grace period expired for ${userName}. Cleaning up.`);

                // leave logic
                if (currentUser.isHost === true) ensureHostExists(roomID, userUUID);

                // clean memory
                delete activeUsers[userUUID];
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
    });

    // --- CASE 3: Host ends session for everyone ----
    socket.on('end-session', handleEvent(async ({ roomID }, cb) => {
        const senderUUID = socketToUUID[socket.id];
        const sender = activeUsers[senderUUID];

        // only host allowed to nuke the room
        if (!sender || !sender.isHost) {
            throw new Error(`Unauthorized attempt by ${sender.name || socket.id} to end session.`);
        }

        console.log(`Host ${sender.name} is ending session: ${roomID}`);
        io.to(roomID).emit('session-ended');

        const room = io.sockets.adapter.rooms.get(roomID);
        room?.forEach(socketID => {
            const socketObject = io.sockets.sockets.get(socketID);
            const userUUID = socketToUUID[socketID];

            socketObject?.leave(roomID);
            if (userUUID) socketObject?.leave(userUUID); 
            delete socketToUUID[socketID];
            delete activeUsers[senderUUID];
        });

        // remove room from active sessions
        delete activeSessions[roomID];
        if (roomTimeoutRefs[roomID]) {
            clearTimeout(roomTimeoutRefs[roomID]);
            delete roomTimeoutRefs[roomID];
        }

        cb({ success: true });
        console.log(`Session ${roomID} fully purged.`);
    }));

    // --- CASE 4: host removes a specific user ---
    socket.on('remove-user', handleEvent(async ({roomID, userUUIDToRemove}, cb) => {
        const senderUUID = socketToUUID[socket.id];
        const sender = activeUsers[senderUUID];

        // only host can kick people 
        if (!sender || !sender.isHost) {
            throw new Error(`Unauthorized attempt by ${sender.name || `User`} to remove user.`);
        }

        // find victim
        const targetUser = activeUsers[userUUIDToRemove];
        // if aren't in activeUsers they're already gone
        if (!targetUser) {
            return cb({ success: true });
        }

        // force victim socket to leave room
        const targetSocket = io.sockets.sockets.get(targetUser.socketID);
        if (targetSocket) {
            targetSocket.emit('removed-from-session'); 
            targetSocket.leave(roomID); 
            targetSocket.leave(userUUIDToRemove);
        }

        // cleanup & notify
        delete socketToUUID[targetUser.socketID];
        delete activeUsers[userUUIDToRemove]; 

        cb({ success: true });
        broadcastUpdate(roomID, `User (${targetUser.name || `User`}) was removed by the host.`);
        handleRoomCleanup(roomID);
    }));

    // --- TRANSFER HOST STATUS ----
    socket.on('transfer-host', handleEvent(async ({roomID, newHostUUID}, cb ) => {
        const senderUUID = socketToUUID[socket.id];
        const sender = activeUsers[senderUUID];

        // console.log("Incoming transfer-host request:", { roomID, newHostUUID, senderUUID, sender });
        // console.log("Current activeUsers state:", JSON.stringify(activeUsers, null, 2));
        
        // only host can transfer power
        if (!sender || !sender.isHost ) {
            throw new Error(`[HOST] Unauthorized transfer attempt by ${sender?.name || socket.id}`);
        }

        // verify new host exists in room
        const targetUser = activeUsers[newHostUUID];
        if (!targetUser || targetUser.sessionID !== roomID) {
            throw new Error(`[HOST] Transfer failed: target user ${newHostUUID} not found in room.`);
        }

        console.log(`[HOST] Transferred host status in room ${roomID} to ${newHostUUID}`);
        sender.isHost = false;
        targetUser.isHost = true;

        io.to(roomID).emit('host-change', newHostUUID);
        cb({ success: true });
        broadcastUpdate(roomID, `${targetUser.name} is now the host.`);
    }));

    // --- MESSAGING ----
    const formatInboundMessage = (user, roomID, context, msgID) => ({
        msgID,
        roomID,
        senderUUID: user.uuid,
        senderName: user.name,
        color: user.color,
        context: {
            text: sanitize(context.text || ""),
            isEncrypted: context.isEncrypted || false,
            version: context.version || "1.0"
        },
        serverTimestamp: Date.now()
    });

    socket.on('send-message', handleEvent(async (messageData, cb) => {
        const senderUUID = socketToUUID[socket.id];
        const sender = activeUsers[senderUUID];

        // console.log("data being sent: ", messageData);

        // validate the message, don't process empty data
        if (!messageData.context?.text?.trim() ) {
            return cb({ success: false, error: "Message failed to send: invalid message data." });
        }
        if (!sender || !messageData.roomID) {
            throw new Error("Message send failed: sender session expired.");
        }
        
        // messageData.room is either Auuid_Buuid or sessionID
        // targetRoom is the uuid of the DM recipient or the sessionID
        const { targetRoom, isDM } = getRoomData(messageData.roomID, senderUUID);

        // reconstruct package, don't just send 'outboundData', only emit what's necessary
        const formattedMessage = formatInboundMessage(
            sender, 
            messageData.roomID, 
            messageData.context,
            messageData.msgID,
        );

        // send message
        socket.to(targetRoom).emit('receive-message', formattedMessage);
        cb({ 
            success: true, 
            msgID: messageData.msgID,
            serverTimestamp: formattedMessage.serverTimestamp 
        });

        console.log(`[${isDM ? `DM` : `CHAT`}] ${sender.name} -> ${targetRoom}: ${formattedMessage.context.text}`);
        // console.log("data being sent to receive-message: ", outboundData);
    }));

    socket.on('edit-message', handleEvent(async (data, cb) => {
        const senderUUID = socketToUUID[socket.id];
        const sender = activeUsers[senderUUID];
        const { roomID, msgID, newText } = data;

        if (!sender || !roomID) {
            throw new Error("Session expired or room doesn't exist.");
        }
        if(!msgID || !newText?.trim() ) {
            return cb({ success: false, error: "Message is empty or doesn't exist." });
        }
        
        const { targetRoom } = getRoomData(roomID, senderUUID);

        socket.to(targetRoom).emit('message-edited', {
            roomID,
            msgID,
            newText: sanitize(newText.trim())
        });

        cb({ success: true });
        console.log(`[EDIT] Room ${roomID} | Message ${msgID} edited to: ${newText.trim()}`);
    }));

    socket.on('delete-message', handleEvent(async (data, cb) => {
        const senderUUID = socketToUUID[socket.id];
        const sender = activeUsers[senderUUID];
        const { roomID, msgID } = data;

        if(!sender || !roomID ) {
            throw new Error("Delete failed: session expired.");
        }
        if (!msgID ) {
            return cb({ success: false, error: "Delete failed: missing msgID."});
        }
        
        const { targetRoom } = getRoomData(roomID, senderUUID);

        socket.to(targetRoom).emit('message-deleted', {
            roomID,
            msgID,
            senderName: sender.name,
        });

        cb({ success: true });
        console.log(`[DELETE] Room ${roomID} | Message ${msgID} deleted by ${sender.name}`);
    }));

    socket.on('typing', ({ roomID }) => {
        const senderUUID = socketToUUID[socket.id];
        const sender = activeUsers[senderUUID];
        if (!sender || !roomID ) return;
 
        const { targetRoom } = getRoomData(roomID, senderUUID);

        // data.roomID is either sessionID or dmRoomID
        socket.to(targetRoom).emit('user-typing', {
            roomID,
            senderUUID, 
            senderName: sender.name
        }); 
    });

    socket.on('stop-typing', ({ roomID }) => {
        const senderUUID = socketToUUID[socket.id];
        if (!senderUUID || !roomID ) return;
 
        const { targetRoom } = getRoomData(roomID, senderUUID);

        socket.to(targetRoom).emit('user-stop-typing', {
            roomID,
            senderUUID
        });
    });

});

// 4. start the server
const PORT = 3000; // think of as "door number" of server
http.listen(PORT, '0.0.0.0', () => { // tells http server (the one wrapping everything) to start listneing for traffic on door 3000
    console.log(`Server is running on all interfaces at port ${PORT}`); // message to let you know server started successfully without any errors
});