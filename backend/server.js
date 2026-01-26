// 1. import the "engines"
const express = require('express'); // pulls blueprints for express framework
const app = express(); // creates an instance of Express app, handles web routes and logic
const http = require('http').createServer(app); // the "wrapping", takes built-in Node "http" module and creates physical server, passes app into it so the server knows to use Express to handle incoming web requests
const io = require('socket.io')(http, {
    cors: {
        origin: "*", // this allows phone to talk to computer
        methods: ["GET", "POST"]
    }
}); // imports socket.io (tool for real-time, two-way communication), and attaches it to "http" server

// 2. set up the "static folder"
app.use(express.static('public')); // tells Express, "if anyoneasks for a file (eg. image, CSS file, or html page), look inside a folder named public". This is howto "serve" the frontend code to the user's browser

// object to store users { "socketID", name: ...,  color: ...}
let activeUsers = {};

// tracks active room IDs and number of users in room
let activeSessions = {};

// tracking "deletion tickets" to stop countdown before server deletion
let roomTimeoutRefs ={};

// helper to broadcast to everyone in a room to update their UI
const broadcastUpdate = (roomID) => {
    if (!roomID) return;
    const usersInRoom = Object.values(activeUsers).filter(u => u.sessionId === roomID);
    io.to(roomID).emit('user-update', usersInRoom);
};

// helper to handle the "empty room" timer
const handleRoomCleanup = (roomID) => {
    if (activeSessions[roomID]) activeSessions[roomID] -= 1;
    
    if (activeSessions[roomID] <= 0) {
        console.log(`Room ${roomID} is empty. Starting 5-minute deletion timer...`);

        roomTimeoutRefs[roomID] = setTimeout(() => {
            if (activeSessions[roomID] <= 0) {
                io.to(roomID).emit('session-terminated');
                delete activeSessions[roomID];
                delete roomTimeoutRefs[roomID];
                console.log(`Room ${roomID} permanently removed.`)
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

const handleUserJoiningRoom = (socket, roomID) => {
    // Stop the deletion timer if it's running
    cancelRoomDeletion(roomID);

    socket.join(roomID);
    socket.currentRoom = roomID;
    activeSessions[roomID] = (activeSessions[roomID] || 0) + 1;
    console.log(`Room ${roomID} count is now: ${activeSessions[roomID]}`);
};

// 3. handle live connections
io.on('connection', (socket) => { // an event listener -- waits for user to open the app, and when opened, it triggers a function that gives that specific user a unique "socket" object (their personal "phone line" to the server)
    // io.on('..', (ALWAYS gives socket/ID number))
    // socket.on('..', (ALWAYS gives data, eg. message))
 
    // ---- CREATE SESSION -----
    socket.on('create-session', (roomID) => {
        handleUserJoiningRoom(socket, roomID);
        console.log(`Session Created: ${roomID}`);
    });

    // ---- JOIN A SESSION ----
    socket.on('join-session', (roomID, callback) => {
        const sessionExists = !!activeSessions[roomID];

        if (sessionExists) {  // checks to see if roomID actually exists/is active
            const usersInRoom = Object.values(activeUsers).filter(u => u.sessionId === roomID);
            
            handleUserJoiningRoom(socket, roomID);
            console.log(`User ${socket.id} joined room ${roomID}`);

            if(typeof callback == 'function') {
                callback({ exists: true, currentUsers: usersInRoom });
            }
        } else {
            callback({ exists : false });
        }
    });

    // ---- UPDATE PROFILE -----
    socket.on('update-user', (profile) => {
        // save/update user data
        // profile = { name: ..., color: ...}
        activeUsers[socket.id] = { ...profile, id: socket.id };

        // broadcast refreshed list to everyone in that session
        broadcastUpdate(profile.sessionId);
        console.log(`User ${profile.name} updated in room ${profile.sessionId}`);
    });

    // --- CASE 1: leave session (exit room)
        socket.on('leave-session', (roomID) => {
            delete activeUsers[socket.id];  // free the data
            socket.leave(roomID);  // stop hearing room updates
            handleRoomCleanup(roomID); // drop count and start time
            broadcastUpdate(roomID);  // update friends' list
            console.log(`User ${socket.id} left room ${roomID}`);
        });

    // ---- CASE 2: DISCONNECT (eg. unexpected exits, closing the app) ----------
    socket.on('disconnect', () => { 
        const user = activeUsers[socket.id];
        if (user) {
            const roomID = user.sessionId;
            delete activeUsers[socket.id];
            handleRoomCleanup(roomID);
            broadcastUpdate(roomID);
            console.log(`User left ${roomID}. Remaining: ${activeSessions[roomID]}`);
        }
    });
});

// 4. start the server
const PORT = 3000; // think of as "door number" of server
http.listen(PORT, '0.0.0.0', () => { // tells http server (the one wrapping everything) to start listneing for traffic on door 3000
    console.log(`Server is running on all interfaces at http://127.0.0.1:${PORT}`); // message to let you know server started successfully without any errors
});