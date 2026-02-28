// profileHandlers.js

module.exports = (activeUsers, sessionService) => {
    return {
        handleUpdateUser: async ({ profile }, { user, userUUID, sessionID }, cb) => {

            // destructure profile
            const { name, color } = profile;

            // color taken logic
            const isColorTaken = Object.values(activeUsers).some(
                u => u.sessionID === sessionID && u.uuid !== userUUID && u.color === color
            );
            if (isColorTaken) {
                return cb({ success: false, error: "Color was just taken. Please choose another."});
            }

            activeUsers[userUUID] = { 
                ...user, 
                ...profile,
                isFullyRegistered: true
            };

            cb({ success: true });
            sessionService.broadcastUpdate(sessionID, `User ${name} updated their profile.`);
        }
    };
};