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
let activeUsers = {};

// tracks active room IDs
let activeSessions = {};

// tracking "deletion tickets" to stop countdown before server deletion
let roomTimeoutRefs ={};

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

const handleUserJoiningRoom = (socket, roomID) => {
    // Stop the deletion timer if it's running
    cancelRoomDeletion(roomID);
    socket.join(roomID);
    activeSessions[roomID] = true;

    const hasHost = Object.values(activeUsers).some(u => u.sessionId === roomID && u.isHost);

    if (!activeUsers[socket.id]) {
        activeUsers[socket.id] = { 
            id: socket.id,
            name: "New User",
            color: "#cccccc",
            sessionId: roomID,
            isHost: !hasHost
         };
    } else {
        activeUsers[socket.id].sessionId = roomID;
        if (!hasHost) {
            activeUsers[socket.id].isHost = true;
        }
    }
    const userName = activeUsers[socket.id].name || socket.id;
    broadcastUpdate(roomID, `User ${socket.id} (${userName}) joined room ${roomID}`);

    if (activeUsers[socket.id].isHost) {
        console.log(`User ${socket.id} is assigned as host for room ${roomID}`);
        io.to(roomID).emit('host-change', socket.id);
    }
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
const ensureHostExists = (roomID, leavingSocketId) => {
    const remainingUsers = Object.values(activeUsers).filter(u => u.sessionId === roomID && u.id !== leavingSocketId);
    if (remainingUsers.length > 0) {
        const newHost = remainingUsers[0];
        newHost.isHost = true;
        console.log(`New host for room ${roomID} is ${newHost.id}`);
        io.to(roomID).emit('host-change', newHost.id);
    };
};

// 3. handle live connections
io.on('connection', (socket) => { // an event listener -- waits for user to open the app, and when opened, it triggers a function that gives that specific user a unique "socket" object (their personal "phone line" to the server)
    // io.on('..', (ALWAYS gives socket/ID number))
    // socket.on('..', (ALWAYS gives data, eg. message))
    console.log(`New user connected: ${socket.id}`);
 
    // ---- CREATE SESSION -----
    socket.on('create-session', (roomID, callback) => {
        handleUserJoiningRoom(socket, roomID);
        if (activeUsers[socket.id]) activeUsers[socket.id].isHost = true;
        console.log(`Session Created: ${roomID}`);

        if (typeof callback == 'function') {
            callback();
        }
    });

    // ---- JOIN A SESSION ----
    socket.on('join-session', (roomID, callback) => {
        console.log(`Request to join room: ${roomID} from ${socket.id}`);

        if (activeSessions[roomID] != undefined) {  // checks to see if roomID actually exists/is active  
            const usersAlreadyInRoom = Object.values(activeUsers).filter(u => u.sessionId === roomID);          
            if(usersAlreadyInRoom.length >= 12) {
                console.log(`Failed: Room ${roomID} is full.`);
                if(typeof callback == 'function') {
                    callback({ exists: true, full: true });
                }
            } else {
                handleUserJoiningRoom(socket, roomID);

                const currentUsers = Object.values(activeUsers).filter(u => u.sessionId === roomID);
                if(typeof callback == 'function') {
                    callback({ exists: true, full: false, currentUsers });
                }
            }
        } else {
            console.log(`Failed: Room ${roomID} does not exist.`);
            if(typeof callback == 'function') { 
            callback({ exists : false });
            }
        }
    });

    // ---- UPDATE PROFILE -----
    socket.on('update-user', (profile) => {
        // save/update user data
        // profile = { name: ..., color: ...}
        const currentlyIsHost = activeUsers[socket.id]?.isHost || false;
        activeUsers[socket.id] = { ...profile, id: socket.id, isHost: currentlyIsHost };
        // broadcast refreshed list to everyone in that session
        broadcastUpdate(profile.sessionId, `User ${socket.id} (${profile.name}) updated their profile.`);
    });

    // --- CASE 1: user voluntarily leaves session (exit room)
    socket.on('leave-session', (roomID) => {
        if (!activeUsers[socket.id]) return; // if user is gone, do nothing

        const userName = activeUsers[socket.id].name || socket.id;

        if (activeUsers[socket.id].isHost === true) {
            ensureHostExists(roomID, socket.id);
        }

        delete activeUsers[socket.id];  // free the data
        
        broadcastUpdate(roomID, `User ${socket.id} (${userName}) left room ${roomID}`);
        socket.leave(roomID);  // stop hearing room updates

        setTimeout(() => {
            handleRoomCleanup(roomID); // drop count and start time
        }, 50);         
    });

    // ---- CASE 2: DISCONNECT (eg. unexpected exits, closing the app) ----------
    socket.on('disconnect', () => { 
        const user = activeUsers[socket.id];
        console.log(`User disconnected: ${socket.id}`);

        if (user) {
            const roomID = user.sessionId;
            const userName = user.name || socket.id;
            if (user.isHost === true) {
                ensureHostExists(roomID, socket.id);
            }
            delete activeUsers[socket.id];

            setTimeout(() => {
                handleRoomCleanup(roomID);
                broadcastUpdate(roomID, `User ${socket.id} (${userName}) left room ${roomID}`);
            }, 50);
        }
    });

    // --- CASE 3: Host ends session for everyone ----
    socket.on('end-session', (roomID) => {
        console.log(`Host is ending session: ${roomID}`);
        io.to(roomID).emit('session-ended');

        // clean up memory for everyone who was in that room
        Object.keys(activeUsers).forEach(id => {
            if (activeUsers[id].sessionId === roomID) {
                delete activeUsers[id];
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
                const s = io.sockets.sockets.get(socketId)
                if (s) s.leave(roomID);
            }
        }

        console.log(`Session ${roomID} has been ended by the host.`);
    });

    // --- CASE 4: host removes a specific user ---
    socket.on('remove-user', ( {roomID, userIdToRemove} ) => {
        const targetSocket = io.sockets.sockets.get(userIdToRemove);

        // force specific spocket to leave room
        if (targetSocket) {
            targetSocket.emit('removed-from-session'); // tell victim's app they're being removed
            targetSocket.leave(roomID); // force them to leave
            const userName = activeUsers[userIdToRemove]?.name || "User";
            delete activeUsers[userIdToRemove]; // clean up their data
            broadcastUpdate(roomID, `User (${userName}) was removed by the host.`);
        }
        handleRoomCleanup(roomID);
    });

    // --- TRANSFER HOST STATUS ----
    socket.on('transfer-host', ( {roomID, newHostId} ) => {
        console.log(`Transferring host status in room ${roomID} to ${newHostId}`);
        // strip host status from everyone (prevents two hosts)
        const usersInRoom = Object.values(activeUsers).filter(u => u.sessionId === roomID);
        usersInRoom.forEach(u => {
            if (u.isHost) u.isHost = false;
        });

        // assign new host
        if (activeUsers[newHostId]) {
            activeUsers[newHostId].isHost = true;
            io.to(roomID).emit('host-change', newHostId);
            broadcastUpdate(roomID, `${newHostId} is now the host.`);
        }
    });

    // --- MESSAGING ----

    const formatOutboundMessage = (user, roomID, context, isDM, senderID) => ({
        roomID,
        sender: user.name,
        color: user.color,
        context: {
            text: context.text,
            isEncrypted: context.isEncrypted || false,
            version: context.version || "1.0"
        },
        id: senderID,
        isDirectMessage: isDM,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        serverTimestamp: new Date().toISOString()
    });

    socket.on('send-message', (messageData) => {
        const sender = activeUsers[socket.id];
        // validate the message, don't process empty data
        if (!sender || !messageData.context?.text?.trim() ) return;

        // reconstruct package, don't just send 'messagData', only emit what's necessary
        const outboundData = formatOutboundMessage(sender, messageData.roomID, messageData.context, false, socket.id);

        // broadcast to everyone in room except sender
        socket.to(messageData.roomID).emit('receive-message', outboundData);
        console.log(`[CHAT] Room ${messageData.roomID} | ${sender.name}: ${outboundData.context.text}`);
    });

    socket.on('send-direct-message', (messageData) => {
        const sender = activeUsers[socket.id];
        const { recipientId, context } = messageData;

        if (!sender || !context?.text?.trim() || !recipientId) return;
        
        const dmRoomID = [socket.id, recipientId].sort().join('_');
        const outboundData = formatOutboundMessage(sender, dmRoomID, context, true, socket.id);

        const recipientSocket = io.sockets.sockets.get(recipientId);

        if (recipientSocket) {
            recipientSocket.emit('receive-message', outboundData);
        }
        console.log(`Direct message from ${messageData.sender} to ${messageData.recipientId}: ${messageData.context.text}`);
    });

    socket.on('join-dm', ( {dmRoomID, targetName} ) => {
        socket.join(dmRoomID);
        console.log(`User ${socket.id} is joining DM room: ${dmRoomID} with ${targetName}`);
    });

    socket.on('typing', (data) => {
        socket.to(data.roomID).emit('user-typing', {
            roomID: data.roomID,
            name: data.name,
            id: socket.id
        }); 
    });

    socket.on('stop-typing', (data) => {
        socket.to(data.roomID).emit('user-stop-typing', {
            id: socket.id
        });
    });

});

// 4. start the server
const PORT = 3000; // think of as "door number" of server
http.listen(PORT, '0.0.0.0', () => { // tells http server (the one wrapping everything) to start listneing for traffic on door 3000
    console.log(`Server is running on all interfaces at port ${PORT}`); // message to let you know server started successfully without any errors
});