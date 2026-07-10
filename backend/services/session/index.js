// backend/services/session/index.js

module.exports = (io, activeUsers, activeSessions, socketToUUID, MAX_SESSION_CAPACITY) => {

    // core first since it has no dependencies on other functions
    const core = require('./core')(io, activeUsers, activeSessions, socketToUUID);

    // then pass core to auth and reaper
    const auth = require('./auth')(io, activeUsers, activeSessions, socketToUUID, MAX_SESSION_CAPACITY, core);

    require('./reaper')(io, activeUsers, activeSessions, core);

    // return combined API for socket handlers to use
    return {
        ...core,
        ...auth
    };
};