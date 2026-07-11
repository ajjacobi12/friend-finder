// backend/handlers/profileHandlers.js

module.exports = (sessionService) => {
    return {
        handleUpdateUser: async ({ profile }, { user, socket }, cb) => {

            // destructure profile
            const { name, color } = profile;

            const masterUser = sessionService.getUser(user.uuid);
            if (!masterUser) throw new Error('[UPDATE USER] Unable to retrieve user information.');

            // CAN PROBABLY REMOVE
            // update master memory
            // masterUser.name = name;
            // masterUser.color = color;
            // masterUser.isRegistered = true;

            // refresh socket's badge
            // socket.user = masterUser;

            // color taken logic
            // returns true if color is taken, false if it's available
            if (sessionService.colorTaken(masterUser.sessionID, masterUser, profile, cb)) return;

            masterUser.updateProfile(profile)

            cb({ success: true });
            sessionService.broadcastUpdate(masterUser.sessionID, `User ${masterUser.getName()} updated their profile.`);
        }
    };
};