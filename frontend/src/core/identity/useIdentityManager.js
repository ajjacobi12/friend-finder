// frontend/scr/core/identity/useIdentityManager.js
import { useCallback } from 'react';

import { identityStorage, KEYS } from './identityStorage';
import socket from '../../api/socket';
    
export const useIdentityManager = (state) => {
    const { setUserUUID, setSessionID, setName, setColor, stateRef } = state;

    // sets the state, refs, async storage, and socket
    const setAllThingsIdentity = useCallback(async (userUUID, sessionID) => {
        setUserUUID(userUUID);
        setSessionID(sessionID);
        
        stateRef.current = {
            ...stateRef.current,
            userUUID,
            sessionID,
        };

        await identityStorage.save(KEYS.IDENTITY, { userUUID, sessionID });

        socket.auth = { userUUID, sessionID };

        return true;
    }, [setUserUUID, setSessionID, stateRef]);

        // sets the states, refs, and async storage
    const setAllThingsPrefs = useCallback(async (name, color) => {
        setName(name);
        setColor(color);
        
        stateRef.current = {
            ...stateRef.current,
            name,
            color,
        };

        await identityStorage.save(KEYS.PREFS, { name, color });

        return true;
    }, [setName, setColor, stateRef]);

        
    // update async storage
    const updateDiskPrefs = useCallback(async (updates) => {
        const current = await identityStorage.load(KEYS.PREFS);
        if (current) {
            await identityStorage.save(KEYS.PREFS, { ...current, ...updates});
        }
    }, []);

    return {
        setAllThingsIdentity,
        setAllThingsPrefs,
        updateDiskPrefs,
    };

};