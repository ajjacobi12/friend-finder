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

const { 
    broadcastUpdate, generateUniqueCode,
    handleUserJoiningSession, cancelSessionDeletion,
    handleSessionCleanup, ensureHostExists
} = require('./services/sessionService')(io, activeUsers, activeSessions, socketToUUID)
const clean = require('./services/dataCleaner');
const { handleEvent, getChatRoomData } = require('./services/serverUtils');

const maxSessionCapacity = 12;

// 3. handle live connections
io.on('connection', (socket) => { // an event listener -- waits for user to open the app, and when opened, it triggers a function that gives that specific user a unique "socket" object (their personal "phone line" to the server)
    // io.on('..', (ALWAYS gives socket/ID number))
    // socket.on('..', (ALWAYS gives data, eg. message))
    console.log(`New user connected: ${socket.id}`);
 
    // ---- CREATE SESSION -----
    socket.on('create-session', handleEvent(async ({ existingUUID }, cb) => {
        const sessionID = generateUniqueCode();
        const user = handleUserJoiningSession(socket, sessionID, existingUUID);
        console.log(`Session Created: ${sessionID} for user: ${user.uuid}`);

        // return new UUID so phone can store it
        cb({ 
            success: true, 
            exists: true,
            full: false,
            sessionID: sessionID, 
            userUUID: user.uuid,
            alreadyRegistered: false, 
            isHost: user.isHost || false,
            currentUsers: [user],
            name: user.name,
            color: user.color
        });
    }));

    // ---- JOIN A SESSION ----
    socket.on('join-session', handleEvent(async ({ sessionID, existingUUID = null }, cb) => {
        const cleanSessionID = clean.sessionID(sessionID);
        // ensure sessionID was passed & session exists
        if (!cleanSessionID) return cb({ success: false, error: "No session code provided." });
        if(!activeSessions[cleanSessionID]) return cb({ success: false, exists: "Session does not exist." });

        // check capacity and returning user status 
        const usersInSession = Object.values(activeUsers).filter(u => u.sessionID === cleanSessionID);          
        const isReturningUser = !!(existingUUID && activeUsers[existingUUID] && activeUsers[existingUUID].sessionID === cleanSessionID);

        // checks to see if session is full (skip if a returning user)
        if(usersInSession.length >= maxSessionCapacity && !isReturningUser) {
            return cb({ success: false, error: "Session is full." });
        } 

        // everything is good, join and check to see if they are returning 
        // based on default color & name
        const user = handleUserJoiningSession(socket, cleanSessionID, existingUUID);
        const alreadyRegistered = !!(user && user.isFullyRegistered);
        console.log(`[JOIN] Session: ${cleanSessionID} | User: ${user.uuid} | Returning: ${alreadyRegistered}`);
        cb({ 
            success: true, 
            exists: true,
            full: false,
            sessionID: cleanSessionID,
            userUUID: user.uuid,
            alreadyRegistered,
            isHost: user.isHost || false,
            currentUsers: usersInSession,
            name: user.name,
            color: user.color
        });
    }));

    // ---- UPDATE PROFILE -----
    socket.on('update-user', handleEvent(async (profile, cb) => {
        // profile: name, color
        const userUUID = socketToUUID[socket.id];
        const user = activeUsers[userUUID];

        // if we can't find user, don't try and update them
        if (!userUUID || !user)   {
            throw new Error(`[UPDATE] failed: no UUID found for socket ${socket.id}`);
        }

        // validate profile
        const cleanProfile = clean.userProfile(profile);
        if (!cleanProfile) {
            return cb({ success: false, error: "Invalid name or color format." });
        }

        // color taken logic
        const sessionID = user.sessionID;
        const isColorTaken = Object.values(activeUsers).some(
            u => u.sessionID === sessionID && u.uuid !== userUUID && u.color === profile.color
        );
        if (isColorTaken) {
            return cb({ success: false, error: "Color was just taken. Please choose another."});
        }


        activeUsers[userUUID] = { 
            ...user, 
            ...cleanProfile,
            isFullyRegistered: true
        };

        cb({ success: true });
        broadcastUpdate(sessionID, `User ${cleanProfile.name} updated their profile.`);
    }));

    // --- CASE 1: user voluntarily leaves session (exit session)
    socket.on('leave-session', handleEvent(async ({ sessionID }, cb) => {
        const userUUID = socketToUUID[socket.id];
        const user = activeUsers[userUUID];

        // if user is gone from records, do nothing
        if (!user) return cb({ success: true });

        const userName = user.name || "Unknown User";

        // if user was the host, pick a new one
        if (user.isHost === true) ensureHostExists(sessionID, userUUID);

        // delete user data & remove sockets
        delete activeUsers[userUUID];  
        delete socketToUUID[socket.id];
        socket.leave(sessionID);
        socket.leave(userUUID);

        cb({ success: true });

        broadcastUpdate(sessionID, `User ${userName} left.`);
        
        // check if session is now empty
        setTimeout(() => {
            handleSessionCleanup(sessionID);
        }, 50);         
    }));

    // ---- CASE 2: DISCONNECT (eg. unexpected exits, closing the app) ----------
    socket.on('disconnect', () => { 
        const userUUID = socketToUUID[socket.id];
        const user = activeUsers[userUUID];

        if (!user) return;

        const sessionID = user.sessionID;
        const userName = user.name || "Unknown User";
        console.log(`[BLINK] User ${userName} disconnected. Waiting for grace period...`);

        // immediate UI cleanup, stop anytyping indicaters
        socket.broadcast.emit('user-stop-typing', { senderUUID: userUUID });
        
        // remove old socket mapping since upon reconnection they will be give a new socket.id
        delete socketToUUID[socket.id];

        // start grace period of 15 seconds
        setTimeout(() => {
            // get most current version of user
            const currentUser = activeUsers[userUUID];
            // check if user is still associated with the disconnected socket
            // if they reconnect, activeUsers[userUUID].socketID will be different
            if (currentUser && currentUser.socketID === socket.id)  {
                console.log(`[EXIT] Grace period expired for ${userName}. Cleaning up.`);

                // leave logic
                if (currentUser.isHost === true) ensureHostExists(sessionID, userUUID);

                // clean memory
                delete activeUsers[userUUID];

                // broadcast and session check
                handleSessionCleanup(sessionID);
                broadcastUpdate(sessionID, `User ${userName} left.`);
            } else {
                // if user reconnects in time, socket.id should be changed
                console.log(`[RECOVERY] User ${userName} reconnected within grace period.`);
            }
        }, 15000);
    });

    // --- CASE 3: Host ends session for everyone ----
    socket.on('end-session', handleEvent(async ({ sessionID }, cb) => {
        const senderUUID = socketToUUID[socket.id];
        const sender = activeUsers[senderUUID];

        // only host allowed to nuke the session
        if (!sender || !sender.isHost) {
            throw new Error(`Unauthorized attempt by ${sender.name || socket.id} to end session.`);
        }

        console.log(`Host ${sender.name} is ending session ${sessionID}`);
        io.to(sessionID).emit('session-ended');

        const session = io.sockets.adapter.rooms.get(sessionID);
        session?.forEach(socketID => {
            const socketObject = io.sockets.sockets.get(socketID);
            const userUUID = socketToUUID[socketID];

            socketObject?.leave(sessionID);
            if (userUUID) socketObject?.leave(userUUID); 
            delete socketToUUID[socketID];
            delete activeUsers[userUUID];
        });

        // remove session from active sessions, 
        // clear the session deletion timer if it exists
        delete activeSessions[sessionID];
        cancelSessionDeletion(sessionID);

        cb({ success: true });
        console.log(`Session ${sessionID} fully purged.`);
    }));

    // --- CASE 4: host removes a specific user ---
    socket.on('remove-user', handleEvent(async ({sessionID, userUUIDToRemove}, cb) => {
        const senderUUID = socketToUUID[socket.id];
        const sender = activeUsers[senderUUID];
        const cleanSessionID = clean.sessionID(sessionID);

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

        // force victim socket to leave session
        const targetSocket = io.sockets.sockets.get(targetUser.socketID);
        if (targetSocket) {
            targetSocket.emit('removed-from-session'); 
            targetSocket.leave(cleanSessionID); 
            targetSocket.leave(userUUIDToRemove);
        }

        // cleanup & notify
        delete socketToUUID[targetUser.socketID];
        delete activeUsers[userUUIDToRemove]; 

        cb({ success: true });
        broadcastUpdate(cleanSessionID, `User (${targetUser.name || `User`}) was removed by the host.`);
        handleSessionCleanup(cleanSessionID);
    }));

    // --- TRANSFER HOST STATUS ----
    socket.on('transfer-host', handleEvent(async ({sessionID, newHostUUID}, cb ) => {
        const senderUUID = socketToUUID[socket.id];
        const sender = activeUsers[senderUUID];
        const cleanSessionID = clean.sessionID(sessionID);

        // console.log("Incoming transfer-host request:", { sessionID, newHostUUID, senderUUID, sender });
        // console.log("Current activeUsers state:", JSON.stringify(activeUsers, null, 2));
        
        // only host can transfer power
        if (!sender || !sender.isHost ) {
            throw new Error(`[HOST] Unauthorized transfer attempt by ${sender?.name || socket.id}`);
        }

        // verify new host exists in session
        const targetUser = activeUsers[newHostUUID];
        if (!targetUser || targetUser.sessionID !== cleanSessionID) {
            throw new Error(`[HOST] Transfer failed: target user ${newHostUUID} not found in session.`);
        }

        sender.isHost = false;
        targetUser.isHost = true;

        io.to(cleanSessionID).emit('host-change', newHostUUID);
        cb({ success: true });
        broadcastUpdate(cleanSessionID, `${targetUser.name} is now the host.`);
    }));

    // --- MESSAGING ----
    const formatInboundMessage = (user, chatRoomID, context, msgID) => ({
        chatRoomID,
        msgID,
        senderUUID: user.uuid,
        senderName: user.name,
        color: user.color,
        context: {
            text: context.text || "",
            isEncrypted: context.isEncrypted || false,
            version: context.version || "1.0"
        },
        serverTimestamp: Date.now()
    });

    socket.on('send-message', handleEvent(async (messageData, cb) => {
        const senderUUID = socketToUUID[socket.id];
        const sender = activeUsers[senderUUID];

        const cleanContext = clean.messageContext(messageData.context);
        const cleanChatRoomID = clean.chatRoom(messageData.chatRoomID);

        const { msgID, context } = messageData;

        // console.log("data being sent: ", messageData);

        // validate the message, don't process empty data
        if (!sender || !cleanChatRoomID || !cleanContext) {
            return cb({ success: false, error: "Invalid message or session expired." });
        }
        
        // messageData.chatRoomID is either Auuid_Buuid or sessionID
        // targetChatRoom is the uuid of the DM recipient or the sessionID
        const { targetChatRoom, isDM } = getChatRoomData(cleanChatRoomID, senderUUID);

        // reconstruct package, don't just send 'outboundData', only emit what's necessary
        const formattedMessage = formatInboundMessage(
            sender, 
            cleanChatRoomID, 
            cleanContext,
            msgID
        );

        // send message to everyone but sender
        socket.to(targetChatRoom).emit('receive-message', formattedMessage);
        cb({ 
            success: true, 
            msgID,
            serverTimestamp: formattedMessage.serverTimestamp 
        });

        console.log(`[${isDM ? `DM` : `CHAT`}] ${sender.name} -> ${targetChatRoom}: ${cleanContext.text}`);
        // console.log("data being sent to receive-message: ", outboundData);
    }));

    socket.on('edit-message', handleEvent(async (data, cb) => {
        const senderUUID = socketToUUID[socket.id];
        const sender = activeUsers[senderUUID];
        const { msgID, chatRoomID, newText } = data;
        
        const cleanChatRoomID = clean.chatRoom(chatRoomID);
        const cleanText = clean.message(newText);

        if (!sender || !cleanChatRoomID) {
            throw new Error("Session expired or room doesn't exist.");
        }
        if(!msgID || !cleanText ) {
            return cb({ success: false, error: "Message is empty or doesn't exist." });
        }
        
        const { targetChatRoom } = getChatRoomData(cleanChatRoomID, senderUUID);

        socket.to(targetChatRoom).emit('message-edited', {
            chatRoomID: cleanChatRoomID,
            msgID,
            cleanText
        });

        cb({ success: true });
        console.log(`[EDIT] Chat room ${chatRoomID} | Message ${msgID} edited to: ${cleanText}`);
    }));

    socket.on('delete-message', handleEvent(async (data, cb) => {
        const senderUUID = socketToUUID[socket.id];
        const sender = activeUsers[senderUUID];
        const { msgID, chatRoomID } = data;
        const cleanChatRoomID = clean.chatRoom(chatRoomID);


        if(!sender || !cleanChatRoomID ) {
            throw new Error("Delete failed: session expired.");
        }
        if (!msgID ) {
            return cb({ success: false, error: "Delete failed: missing msgID."});
        }
        
        const { targetChatRoom } = getChatRoomData(cleanChatRoomID, senderUUID);

        socket.to(targetChatRoom).emit('message-deleted', {
            chatRoomID: cleanChatRoomID,
            msgID,
            senderName: sender.name,
        });

        cb({ success: true });
        console.log(`[DELETE] Chat room ${chatRoomID} | Message ${msgID} deleted by ${sender.name}`);
    }));

    socket.on('typing', ({ chatRoomID }) => {
        const senderUUID = socketToUUID[socket.id];
        const sender = activeUsers[senderUUID];
        const cleanChatRoomID = clean.chatRoom(chatRoomID);
        if (!sender || !cleanChatRoomID ) return;
 
        const { targetChatRoom } = getChatRoomData(cleanChatRoomID, senderUUID);

        // data.chatRoomID is either sessionID or DMRoomID
        socket.to(targetChatRoom).emit('user-typing', {
            chatRoomID: cleanChatRoomID,
            senderUUID, 
            senderName: sender.name
        }); 
    });

    socket.on('stop-typing', ({ chatRoomID }) => {
        const senderUUID = socketToUUID[socket.id];
        const cleanChatRoomID = clean.chatRoom(chatRoomID);
        if (!senderUUID || !cleanChatRoomID ) return;
 
        const { targetChatRoom } = getChatRoomData(cleanChatRoomID, senderUUID);

        socket.to(targetChatRoom).emit('user-stop-typing', {
            senderUUID
        });
    });

});

// 4. start the server
const PORT = 3000; // think of as "door number" of server
http.listen(PORT, '0.0.0.0', () => { // tells http server (the one wrapping everything) to start listneing for traffic on door 3000
    console.log(`Server is running on all interfaces at port ${PORT}`); // message to let you know server started successfully without any errors
});