// frontend/src/core/session/notificationService.js

import { EventEmitter } from 'react-native';

const eventEmitter = new EventEmitter();

export const subscribeToNotifications = (callback) => {
    eventEmitter.addListener('new-message', callback);
    eventEmitter.addListener('user-joined', callback);
    eventEmitter.addListener('user-left', callback);
    eventEmitter.addListener('you-are-host', callback);

    return () => {
        eventEmitter.removeListener('new-message', callback);
        eventEmitter.removeListener('user-joined', callback);
        eventEmitter.removeListener('user-left', callback);
        eventEmitter.removeListener('you-are-host', callback);
    }
};

export const emitMsg = (data) => {
    eventEmitter.emit('new-message', data);
};

export const emitUserJoined = (data) => {
    eventEmitter.emit('user-joined', data);
};

export const emitUserLeft = (data) => {
    eventEmitter.emit('user-left', data);
};

export const emitYouAreHost = (data) => {
    eventEmitter.emit('you-are-host', data);
};