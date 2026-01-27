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
    if (!activeUsers[socket.id]) {
        activeUsers[socket.id] = { 
            id: socket.id,
            name: "New User",
            color: "#cccccc",
            sessionId: roomID
         };
    } else {
    activeUsers[socket.id].sessionId = roomID;
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
        console.log(`Request to join room: ${roomID} from ${socket.id}`);

        if (activeSessions[roomID] != undefined) {  // checks to see if roomID actually exists/is active            
            handleUserJoiningRoom(socket, roomID);

            const usersInRoom = Object.values(activeUsers).filter(u => u.sessionId === roomID);
            broadcastUpdate(roomID, `User ${socket.id} joined room ${roomID}`);

            if(typeof callback == 'function') {
                callback({ exists: true, currentUsers: usersInRoom });
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
        activeUsers[socket.id] = { ...profile, id: socket.id };
        // broadcast refreshed list to everyone in that session
        broadcastUpdate(profile.sessionId, `User ${profile.sessionId} (${profile.name}) updated their profile.`);
    });

    // --- CASE 1: leave session (exit room)
        socket.on('leave-session', (roomID) => {
            if (!activeUsers[socket.id]) return; // if user is gone, do nothing

            const userName = activeUsers[socket.id].name || socket.id;

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
        if (user) {
            const roomID = user.sessionId;
            const userName = user.name || socket.id;

            delete activeUsers[socket.id];

            setTimeout(() => {
                handleRoomCleanup(roomID);
                broadcastUpdate(roomID, `User ${socket.id} (${userName}) left room ${roomID}`);
            }, 50);
        }
    });
});

// 4. start the server
const PORT = 3000; // think of as "door number" of server
http.listen(PORT, '0.0.0.0', () => { // tells http server (the one wrapping everything) to start listneing for traffic on door 3000
    console.log(`Server is running on all interfaces at http://127.0.0.1:${PORT}`); // message to let you know server started successfully without any errors
});