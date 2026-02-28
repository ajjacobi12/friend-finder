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
const activeUsers = {}; // key: , value: {name, color, socketID, etc.}
const socketToUUID = {}; // key: socketID, value: UUID (for quick lookup)
const activeSessions = {}; // tracks active session IDs
const maxSessionCapacity = 12;

const sessionService = require('./services/sessionService')(io, activeUsers, activeSessions, socketToUUID)
const clean = require('./services/dataCleaner');
const { handleEvent } = require('./services/serverUtils');

const chat = require('./handlers/chatHandlers');

const login = require('./handlers/loginHandlers')(
    activeUsers,
    activeSessions,
    sessionService,
    maxSessionCapacity
);

const home = require('./handlers/homeHandlers')(
    io,
    activeUsers,
    activeSessions,
    sessionService,
    socketToUUID
);

const profile = require('./handlers/profileHandlers')(
    activeUsers,
    sessionService,
);

const disconnect = require('./handlers/disconnectHandler')(
    socketToUUID,
    activeUsers,
    sessionService
);

// --- IDENTITY MIDDLEWARE ---
// Only runs once at the start, won't have the verified properties attached to them yet.
// However, handleUserJoiningSession (sessionServices.js) attaches the properties after running
// the onConnect on the frontend ensures any future reconnection has the "badge" for the 
// middleware to detect.
// The purpose of this is for:
// 1. Invisible reconnections: middleware attaches the user object before connection is re-established
//      (to the server it's like the user never left)
// 2. Guards every event (efficiency): for events like send-message or delete-message it gives user and userUUID
//      for immediate use instead of needing a manual lookup function to define user based on UUID for every function
// 3. Security: currently it calls "next" every time, but it can prevent spam or unauthorized access like a bouncer
//      (eg. socket reconnects claiming to be userA, but sessionID badge doesn't match, can call "next(new Error(...))" )
io.use((socket, next) => {
    // get identifiers from the 'auth' handshake
    const { userUUID, sessionID } = socket.handshake.auth;

    // clean them
    const cleanUserUUID = clean.userUUID(userUUID);
    const cleanSessionID = clean.sessionID(sessionID);

    // if missing/incorrect, still let user connect for create/join, but don't attach "verified" badge
    if (cleanUserUUID && activeUsers[cleanUserUUID]) {
        const user = activeUsers[cleanUserUUID];

        // verify user belongs to session
        const isUserInSession = user.sessionID === cleanSessionID;
        // future: const isUserInSession = user.sessionID.includes(cleanSessionID);

        if (isUserInSession) {
            // attach verified data directly to socket object
            socket.userUUID = cleanUserUUID;
            socket.user = user;
            socket.sessionID = cleanSessionID;
            
            // update mapping
            socketToUUID[socket.id] = cleanUserUUID;
            console.log(`[AUTH] ${user.name} verified for session ${cleanSessionID}`);
        } else {
            console.log(`[AUTH] Warning: ${user.name} tried to access unauthorized session ${cleanSessionID}`);
        }
    }

    next(); // lets connection proceed
});

// 3. handle live connections
io.on('connection', (socket) => { // an event listener -- waits for user to open the app, and when opened, it triggers a function that gives that specific user a unique "socket" object (their personal "phone line" to the server)
    // io.on('..', (ALWAYS gives socket/ID number))
    // socket.on('..', (ALWAYS gives data, eg. message))
    console.log(`New user connected: ${socket.id}`);
 
    // ---- CREATE SESSION -----
    socket.on('create-session', handleEvent('create-session', socket, ['isPublic'], 
        login.handleCreateSession));

    // ---- JOIN A SESSION ----
    socket.on('join-session', handleEvent('join-session', socket, ['sessionID', 'isPublic'], 
        login.handleJoinSession));

    // ---- UPDATE PROFILE -----
    socket.on('update-user', handleEvent('update-user', socket, ['profile'], 
        profile.handleUpdateUser));

    // --- CASE 1: user voluntarily leaves session (exit session)
    socket.on('leave-session', handleEvent('leave-session', socket, ['sessionID', 'isPublic'], 
        home.handleLeaveSession));

    // ---- CASE 2: DISCONNECT (eg. unexpected exits, closing the app) ----------
    socket.on('disconnect', () => disconnect.handleOnDisconnect(socket));

    // --- CASE 3: Host ends session for everyone ----
    socket.on('end-session', handleEvent('end-session', socket, ['sessionID'], 
        home.handleEndSession));

    // --- CASE 4: host removes a specific user ---
    socket.on('remove-user', handleEvent('remove-user', socket, ['sessionID', 'userUUIDToRemove'], 
        home.handleRemoveUser));

    // --- TRANSFER HOST STATUS ----
    socket.on('transfer-host', handleEvent('transfer-host', socket, ['sessionID', 'newHostUUID'], 
        home.handleTransferHost));

    socket.on('send-message', handleEvent('send-message', socket, ['msgID', 'chatRoomID', 'context'], 
        chat.handleSendMsg));

    socket.on('edit-message', handleEvent('edit-message', socket, ['msgID', 'chatRoomID', 'newText'], 
        chat.handleEditMsg));

    socket.on('delete-message', handleEvent('delete-message', socket, ['msgID', 'chatRoomID'], 
        chat.handleDeleteMsg));

    socket.on('typing', handleEvent('typing', socket, ['chatRoomID'], 
        chat.handleTyping));

    socket.on('stop-typing', handleEvent('stop-typing', socket, ['chatRoomID'], 
        chat.handleStopTyping));

});

// 4. start the server
const PORT = 3000; // think of as "door number" of server
http.listen(PORT, '0.0.0.0', () => { // tells http server (the one wrapping everything) to start listneing for traffic on door 3000
    console.log(`Server is running on all interfaces at port ${PORT}`); // message to let you know server started successfully without any errors
});