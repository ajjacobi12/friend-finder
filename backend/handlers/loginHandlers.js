// loginHandlers.js

const clean = require('../services/dataCleaner');
const { checkCleanData } = require('../services/serverUtils');

module.exports = (activeUsers, activeSessions, sessionService, maxSessionCapacity) => {

    return {
        // ---- CREATE SESSION ----- 
        handleCreateSession: async ({ existingUUID = null }, { socket }, cb) => {
            // protocol guard
            if (existingUUID !== null && !existingUUID) throw new Error("Protocol error: missing existingUUID");

            // generate sessionID, clean data
            const rawSessionID = sessionService.generateUniqueCode();
            const cleanSessionID = clean.sessionID(rawSessionID);
            const cleanExistingUUID = existingUUID ? clean.userUUID(existingUUID) : null;

            // system guards
            // don't check for cleanExistingUUID -- if it's malformed just treat them as a new user and move on
            checkCleanData('CREATE SESSION', { cleanSessionID })

            const user = sessionService.handleUserJoiningSession(socket, cleanSessionID, cleanExistingUUID);
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
        },

        // ---- JOIN A SESSION ----
        handleJoinSession: async ({ sessionID, existingUUID = null }, { socket }, cb) => {
            // protocol guard
            if (existingUUID !== null && !existingUUID) throw new Error("Protocol error: missing existingUUID");

            // clean optional data if it exists
            const cleanExistingUUID = existingUUID ? clean.userUUID(existingUUID) : null;
            // don't check for cleanExistingUUID -- if it's malformed just treat them as a new user and move on

            if(!activeSessions[sessionID]) {
                return cb({ success: false, exists: "Session does not exist." });
            }

            // check capacity and returning user status 
            const usersInSession = Object.values(activeUsers).filter(u => u.sessionID === sessionID);          
            const isReturningUser = !!(cleanExistingUUID && activeUsers[cleanExistingUUID] && activeUsers[cleanExistingUUID].sessionID === sessionID);
            if(usersInSession.length >= maxSessionCapacity && !isReturningUser) {
                return cb({ success: false, error: "Session is full." });
            } 

            // everything is good, join and check to see if they are returning 
            // based on default color & name
            const user = sessionService.handleUserJoiningSession(socket, sessionID, cleanExistingUUID);
            if (!user) throw new Error("Protocol error: unable to create user for new session");

            const finalUsersList = Object.values(activeUsers).filter(u => u.sessionID === sessionID);          

            const alreadyRegistered = !!(user && user.isFullyRegistered);
            console.log(`[JOIN] Session: ${sessionID} | User: ${user.uuid} | Returning: ${alreadyRegistered}`);
            cb({ 
                success: true, 
                exists: true,
                full: false,
                sessionID,
                userUUID: user.uuid,
                alreadyRegistered,
                isHost: user.isHost || false,
                currentUsers: finalUsersList,
                name: user.name,
                color: user.color
            });
        }
    };
};