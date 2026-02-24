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
const { handleEvent, checkCleanData, getChatRoomData } = require('./services/serverUtils');

const maxSessionCapacity = 12;

// --- IDENTITY MIDDLEWARE ---
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
    socket.on('create-session', handleEvent(socket, ['isPublic'], async ({ existingUUID = null }, cb) => {
        // protocol guard
        if (existingUUID !== null && !existingUUID) throw new Error("Protocol error: missing existingUUID");

        // generate sessionID, clean data
        const rawSessionID = generateUniqueCode();
        const cleanSessionID = clean.sessionID(rawSessionID);
        const cleanExistingUUID = existingUUID ? clean.userUUID(existingUUID) : null;

        // system guards
        checkCleanData('CREATE SESSION', { cleanSessionID, ...(existingUUID && { cleanExistingUUID }) })

        const user = handleUserJoiningSession(socket, cleanSessionID, cleanExistingUUID);
        if (!user) throw new Error("Protocol error: unable to create user for new session");

        console.log(`Session Created: ${cleanSessionID} for user: ${user.uuid}`);

        // return new UUID so phone can store it
        cb({ 
            success: true, 
            exists: true,
            full: false,
            sessionID: cleanSessionID, 
            userUUID: user.uuid,
            alreadyRegistered: false, 
            isHost: user.isHost || false,
            currentUsers: [user],
            name: user.name,
            color: user.color
        });
    }));

    // ---- JOIN A SESSION ----
    socket.on('join-session', handleEvent(socket, ['sessionID', 'isPublic'], async ({ sessionID, existingUUID = null }, cb) => {
        // protocol guard
        if (existingUUID !== null && !existingUUID) throw new Error("Protocol error: missing existingUUID");

        // data cleaning
        const cleanSessionID = clean.sessionID(sessionID);
        const cleanExistingUUID = existingUUID ? clean.userUUID(existingUUID) : null;

        // system guards
        checkCleanData(`JOIN SESSION`, { cleanSessionID, ...(existingUUID && { cleanExistingUUID }) });

        if(!activeSessions[cleanSessionID]) {
            return cb({ success: false, exists: "Session does not exist." });
        }

        // check capacity and returning user status 
        const usersInSession = Object.values(activeUsers).filter(u => u.sessionID === cleanSessionID);          
        const isReturningUser = !!(cleanExistingUUID && activeUsers[cleanExistingUUID] && activeUsers[cleanExistingUUID].sessionID === cleanSessionID);
        if(usersInSession.length >= maxSessionCapacity && !isReturningUser) {
            return cb({ success: false, error: "Session is full." });
        } 

        // everything is good, join and check to see if they are returning 
        // based on default color & name
        const user = handleUserJoiningSession(socket, cleanSessionID, cleanExistingUUID);
        if (!user) throw new Error("Protocol error: unable to create user for new session");

        const finalUsersList = Object.values(activeUsers).filter(u => u.sessionID === cleanSessionID);          

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
            currentUsers: finalUsersList,
            name: user.name,
            color: user.color
        });
    }));

    // ---- UPDATE PROFILE -----
    socket.on('update-user', handleEvent(socket, ['profile'], async ({ profile }, cb) => {
        // (profile: name, color)
        // obtain and clean necessary data
        const { user, userUUID, sessionID } = socket;
        const cleanProfile = clean.userProfile(profile);

        // system guards
        checkCleanData(`UPDATE USER`, { cleanProfile });

        // destructure cleanProfile
        const { name, color } = cleanProfile;

        // color taken logic
        const isColorTaken = Object.values(activeUsers).some(
            u => u.sessionID === sessionID && u.uuid !== userUUID && u.color === color
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
        broadcastUpdate(sessionID, `User ${name} updated their profile.`);
    }));

    // --- CASE 1: user voluntarily leaves session (exit session)
    socket.on('leave-session', handleEvent(socket, ['sessionID', 'isPublic'], async ({ sessionID }, cb) => {
        // obtain and clean necessary data
        const { user, userUUID } = socket;
        const cleanSessionID = clean.sessionID(sessionID);
        
        // if user is gone from records, do nothing
        if (!user) return cb({ success: true });

        // system guards
        checkCleanData(`LEAVE SESSION`, { cleanSessionID });

        if (user.sessionID !== cleanSessionID) throw new Error (`User is not in session ${cleanSessionID}.`);

        // if user was the host, pick a new one
        if (user.isHost === true) ensureHostExists(cleanSessionID, userUUID);

        // delete user data & remove sockets
        delete activeUsers[userUUID];  
        delete socketToUUID[socket.id];
        socket.leave(cleanSessionID);
        socket.leave(userUUID);

        cb({ success: true });
        broadcastUpdate(cleanSessionID, `User ${user.name || "Unknown User"} left.`);
        
        // check if session is now empty
        setTimeout(() => {
            handleSessionCleanup(cleanSessionID);
        }, 50);         
    }));

    // ---- CASE 2: DISCONNECT (eg. unexpected exits, closing the app) ----------
    socket.on('disconnect', () => { 
        const { user, userUUID, sessionID } = socket;

        // system/protocol guards
        if (!user || !userUUID || !sessionID) return;

        const userName = user.name || "Unknown User";

        console.log(`[BLINK] User ${userName} disconnected. Waiting for grace period...`);

        // immediate UI cleanup, stop anytyping indicaters
        socket.to(sessionID).emit('user-stop-typing', { senderUUID: userUUID });
        
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
    socket.on('end-session', handleEvent(socket, ['sessionID'], async ({ sessionID }, cb) => {
        // obtain and clean necessary data
        const { user } = socket;
        const cleanSessionID = clean.sessionID(sessionID);

        // system guards
        checkCleanData(`END SESSION`, { cleanSessionID });

        if (!user.isHost) throw new Error(`Unauthorized attempt by ${user.name || socket.id} to end session.`);

        // notify everyone session ended, start cleanup on frontend for all users
        console.log(`Host ${user.name} is ending session ${cleanSessionID}`);
        io.to(cleanSessionID).emit('session-ended');

        // delete all users' data in session
        const session = io.sockets.adapter.rooms.get(cleanSessionID);
        session?.forEach(socketID => {
            const socketObject = io.sockets.sockets.get(socketID);
            const userUUID = socketToUUID[socketID];

            socketObject?.leave(cleanSessionID);
            if (userUUID) socketObject?.leave(userUUID); 
            delete socketToUUID[socketID];
            delete activeUsers[userUUID];
        });

        // remove session from active sessions, 
        // clear the session deletion timer if it exists
        delete activeSessions[cleanSessionID];
        cancelSessionDeletion(cleanSessionID);

        cb({ success: true });
        console.log(`Session ${cleanSessionID} fully purged.`);
    }));

    // --- CASE 4: host removes a specific user ---
    socket.on('remove-user', handleEvent(socket, ['sessionID', 'userUUIDToRemove'], async ({ sessionID, userUUIDToRemove }, cb) => {
        // obtain and clean necessary data
        const { user } = socket;
        const cleanSessionID = clean.sessionID(sessionID);
        const cleanUserUUIDToRemove = clean.userUUID(userUUIDToRemove);

        // system guards
        checkCleanData(`REMOVE USER`, { cleanSessionID, cleanUserUUIDToRemove });

        if (!user.isHost) throw new Error(`[REMOVE USER] Unauthorized attempt by ${user.name || `User`} to remove user.`);

        // find victim, if they aren't in activeUsers they're already gone
        const targetUser = activeUsers[cleanUserUUIDToRemove];
        if (!targetUser) return cb({ success: true });

        // force victim socket to leave session
        const targetSocket = io.sockets.sockets.get(targetUser.socketID);
        if (targetSocket) {
            targetSocket.emit('removed-from-session'); 
            targetSocket.leave(cleanSessionID); 
            targetSocket.leave(cleanUserUUIDToRemove);
        }

        // cleanup & notify
        delete socketToUUID[targetUser.socketID];
        delete activeUsers[cleanUserUUIDToRemove]; 

        cb({ success: true });
        broadcastUpdate(cleanSessionID, `User (${targetUser.name || `User`}) was removed by the host.`);
        handleSessionCleanup(cleanSessionID);
    }));

    // --- TRANSFER HOST STATUS ----
    socket.on('transfer-host', handleEvent(socket, ['sessionID', 'newHostUUID'], async ({ sessionID, newHostUUID }, cb ) => {
        // obtain and clean necessary data
        const { user } = socket;
        const cleanSessionID = clean.sessionID(sessionID);
        const cleanNewHostUUID = clean.userUUID(newHostUUID);

        // system guards
        checkCleanData(`TRANSFER HOST`, { cleanSessionID, cleanNewHostUUID });

        if (!user.isHost ) throw new Error(`[TRANSFER HOST] Unauthorized transfer attempt by ${user?.name || socket.id}`);

        const targetUser = activeUsers[cleanNewHostUUID];
        if (!targetUser || targetUser.sessionID !== cleanSessionID) {
            throw new Error(`[TRANSFER HOST] Transfer failed: target user ${cleanNewHostUUID} not found in session.`);
        }

        // change host status of both users
        user.isHost = false;
        targetUser.isHost = true;

        io.to(cleanSessionID).emit('host-change', cleanNewHostUUID);
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

    socket.on('send-message', handleEvent(socket, ['msgID', 'chatRoomID', 'context'], async ({ msgID, chatRoomID, context }, cb) => {
        // obtain and clean necessary data
        const { user, userUUID } = socket;
        const cleanChatRoomID = clean.chatRoom(chatRoomID);
        const cleanMsgID = clean.msgID(msgID);
        const cleanContext = clean.messageContext(context);

        // console.log("data being sent: ", messageData);

        // system guards
        checkCleanData(`SEND MSG`, { cleanChatRoomID, cleanMsgID, cleanContext });
        
        // messageData.chatRoomID is either Auuid_Buuid or sessionID
        // targetChatRoom is the uuid of the DM recipient or the sessionID
        const { targetChatRoom, isDM } = getChatRoomData(cleanChatRoomID, userUUID);
        if(!targetChatRoom) throw new Error("targetChatRoom unable to be retrived.");

        // reconstruct package, don't just send 'outboundData', only emit what's necessary
        const formattedMessage = formatInboundMessage(
            user, 
            cleanChatRoomID, 
            cleanContext,
            cleanMsgID
        );

        // send message to everyone but sender
        socket.to(targetChatRoom).emit('receive-message', formattedMessage);
        cb({ 
            success: true, 
            cleanMsgID,
            serverTimestamp: formattedMessage.serverTimestamp 
        });

        console.log(`[${isDM ? `DM` : `CHAT`}] ${user.name} -> ${targetChatRoom}: ${cleanContext.text}`);
        // console.log("data being sent to receive-message: ", outboundData);
    }));

    socket.on('edit-message', handleEvent(socket, ['msgID', 'chatRoomID', 'newText'], async ({ msgID, chatRoomID, newText }, cb) => {
        // obtain and clean necessary data
        const { userUUID } = socket;
        const cleanChatRoomID = clean.chatRoom(chatRoomID);
        const cleanMsgID = clean.msgID(msgID);
        const cleanText = clean.messageText(newText);

        // system guards
        checkCleanData(`EDIT MSG`, { cleanChatRoomID, cleanMsgID, cleanText });
        
        const { targetChatRoom } = getChatRoomData(cleanChatRoomID, userUUID);
        if(!targetChatRoom) throw new Error("targetChatRoom unable to be retrived.");

        socket.to(targetChatRoom).emit('message-edited', {
            chatRoomID: cleanChatRoomID,
            msgID: cleanMsgID,
            newText: cleanText
        });

        cb({ success: true });
        console.log(`[EDIT] Chat room ${cleanChatRoomID} | Message ${cleanMsgID} edited to: ${cleanText}`);
    }));

    socket.on('delete-message', handleEvent(socket, ['msgID', 'chatRoomID'], async ({ msgID, chatRoomID }, cb) => {
        // obtain and clean necessary data
        const { user, userUUID } = socket;
        const cleanChatRoomID = clean.chatRoom(chatRoomID);
        const cleanMsgID = clean.msgID(msgID);

        // system guards
        checkCleanData(`DLT MSG`, { cleanChatRoomID, cleanMsgID });

        const { targetChatRoom } = getChatRoomData(cleanChatRoomID, userUUID);
        if(!targetChatRoom) throw new Error("targetChatRoom unable to be retrieved.");

        socket.to(targetChatRoom).emit('message-deleted', {
            chatRoomID: cleanChatRoomID,
            msgID: cleanMsgID,
            senderName: user.name,
        });

        cb({ success: true });
        console.log(`[DELETE] Chat room ${cleanChatRoomID} | Message ${cleanMsgID} deleted by ${user.name}`);
    }));

    socket.on('typing', handleEvent(socket, ['chatRoomID'], async ({ chatRoomID }, cb) => {
        // obtain and clean necessary data
        const { user, userUUID } = socket;
        const cleanChatRoomID = clean.chatRoom(chatRoomID);

        // system guards
        checkCleanData(`TYPING`, { cleanChatRoomID });
 
        const { targetChatRoom } = getChatRoomData(cleanChatRoomID, userUUID);
        if (!targetChatRoom) return;

        // data.chatRoomID is either sessionID or DMRoomID
        socket.to(targetChatRoom).emit('user-typing', {
            chatRoomID: cleanChatRoomID,
            userUUID, 
            senderName: user.name
        }); 
    }));

    socket.on('stop-typing', handleEvent(socket, ['chatRoomID'], async ({ chatRoomID }, cb) => {
        // obtain and clean necessary data
        const { user, userUUID } = socket;
        const cleanChatRoomID = clean.chatRoom(chatRoomID);

        // system guards
        checkCleanData(`STOP TYPING`, { cleanChatRoomID });
 
        const { targetChatRoom } = getChatRoomData(cleanChatRoomID, userUUID);
        if(!targetChatRoom) return;

        socket.to(targetChatRoom).emit('user-stop-typing', {
            userUUID
        });
    }));

});

// 4. start the server
const PORT = 3000; // think of as "door number" of server
http.listen(PORT, '0.0.0.0', () => { // tells http server (the one wrapping everything) to start listneing for traffic on door 3000
    console.log(`Server is running on all interfaces at port ${PORT}`); // message to let you know server started successfully without any errors
});