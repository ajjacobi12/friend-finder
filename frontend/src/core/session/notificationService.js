// frontend/src/core/session/notificationService.js

import { EventEmitter } from 'expo-modules-core';

const eventEmitter = new EventEmitter();

export const subscribeToNotifications = (callback) => {
    const subscription1 = eventEmitter.addListener('new-message', callback);
    const subscription2 = eventEmitter.addListener('user-joined', callback);
    const subscription3 = eventEmitter.addListener('user-left', callback);
    const subscription4 = eventEmitter.addListener('you-are-host', callback);

    return () => {
        subscription1.remove();
        subscription2.remove();
        subscription3.remove();
        subscription4.remove();
    };
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