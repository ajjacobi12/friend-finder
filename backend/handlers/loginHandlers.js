// backend/handlers/loginHandlers.js

const clean = require('../services/dataCleaner');
const { checkCleanData } = require('../services/serverUtils');

module.exports = (sessionService) => {

    return {
        // ---- CREATE SESSION ----- 
        handleCreateSession: async ({ existingUUID = null, existingProfile = null }, { socket }, cb) => {
            console.log("existingUUID: ", existingUUID, ", existingProfile: ", existingProfile);
            // generate sessionID & clean it
            const rawSessionID = sessionService.generateUniqueCode();
            const cleanSessionID = clean.sessionID(rawSessionID);

            // system guards
            checkCleanData('CREATE SESSION', { cleanSessionID })

            const user = sessionService.handleUserJoining(socket, cleanSessionID, existingUUID, existingProfile, cb);
            if (!user) return;
                        
            // check user was properly returned, get list of all users, return callback 
            sessionService.finalizeSession('CREATE', user, cleanSessionID, cb);
        },

        // ---- JOIN A SESSION ----
        handleJoinSession: async ({ sessionID, existingUUID = null, existingProfile = null }, { socket }, cb) => {
            // ensure session exists
            const sessionExists = sessionService.checkExistingSession(sessionID, cb);
            if (!sessionExists) return;

            // everything is good, join and check to see if they are returning 
            const user = sessionService.handleUserJoining(socket, sessionID, existingUUID, existingProfile, cb);
            // user will return null if session is full (at capacity)
            if (!user) return;
            
            // check user was properly returned, get list of all users, return callback 
            sessionService.finalizeSession('JOIN', user, sessionID, cb);
        }

    };
};