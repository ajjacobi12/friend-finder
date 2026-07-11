//frontend/src/classes/User.js

export class User {
    constructor( data ) {
        this.uuid = data.uuid;
        this.socketID = data.socketID;
        this.sessionID = data.sessionID;
        this.name = data.name || null;
        this.color = data.color || null;
        this.isHost = data.isHost;
        this.isRegistered = data.isRegistered || false;
        this.status = data.status || 'online';
        this.lastSeen = data.lastSeen || Date.now();
    }

    updateProfile(newProfile) {
        if(newProfile.name) this.name = newProfile.name;
        if(newProfile.color) this.color = newProfile.color;
        this.isRegistered = true;
    }

    isOnline() {
        return this.status === 'online' && this.isRegistered;
    }

    getName() {
        return this.name || `User-${this.uuid.slice(-4)}`;
    }

    setOnline() {
        this.lastSeen = Date.now();
        this.status = 'online';
    }

    setOffline() {
        this.lastSeen = Date.now();
        this.status = 'offline';
    }

    toJSON() {
        return {
            uuid: this.uuid,
            name: this.name,
            color: this.color,
            isHost: this.isHost,
            status: this.status
        };
    }
}