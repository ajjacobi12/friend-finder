// backend/services/session/reaper.js

module.exports = (io, activeUsers, activeSessions, core) => {
    const EXPIRATION_TIME = 20 * 60 * 1000; // 20 minutes 
    // const EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 Hours
    // const CHECK_INTERVAL = 60 * 60 * 1000; // Run every hour
    const CHECK_INTERVAL = 30 * 60 * 1000; // Run every 10 minutes


    const runReaper = () => {
        const now = Date.now();
        console.log(`[REAPER] Initializing hourly cleanup...`);

        let removedCount = 0;
        const affectedSessions = new Set();

        Object.keys(activeUsers).forEach(uuid => {
            const user = activeUsers[uuid];
            
            // Logic: Is the socket actually connected right now?
            const isOnline = io.sockets.sockets.has(user.socketID);
            const timeSinceLastSeen = now - (user.lastSeen || 0);

            if (!isOnline && timeSinceLastSeen > EXPIRATION_TIME) {
                console.log(`[REAPER] Expiring stale user: ${user.name} (${uuid})`);
                
                const sID = user.sessionID;
                affectedSessions.add(sID);

                // 1. Remove from memory
                delete activeUsers[uuid];
                removedCount++;

                // 2. Use your existing cleanup logic to handle empty rooms or host migration
                if (core && core.handleSessionCleanup) {
                    core.handleSessionCleanup(sID);
                }
            }
        });

        // 3. Notify remaining users in affected rooms that the list has changed
        affectedSessions.forEach(sID => {
            if (activeSessions[sID]) {
                core.broadcastUpdate(sID, '[REAPER] Cleaned up stale users.');
            }
        });

        if (removedCount > 0) {
            console.log(`[REAPER] Cleanup complete. Removed ${removedCount} stale users.`);
        }
    };

    // Start the heartbeat
    setInterval(runReaper, CHECK_INTERVAL);
};