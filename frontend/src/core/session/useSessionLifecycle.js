// frontend/src/core/session/useSessionLifecycle.js

import React, { useCallback, useEffect } from 'react';
import { Alert } from 'react-native';

import { navigationRef } from './navigationService';

import { identityStorage, KEYS } from '../identity/identityStorage';
import { joinSessionAction } from '../socket/socketServices';

import socket from '../../api/socket';

export const useSessionLifecycle = (config) => {
    const { setAllThingsIdentity, setAllThingsPrefs, stateRef, 
        setName, setColor, setSessionID, setSessionUsers, setIsHost, setHasRegistered, 
        setIsReconnecting, setIsLoading, setIsRebooting } = config;

    // --- CLEANUP FUNCTION ----
    const handleCleanExit = useCallback(async (fullReset = false) => {
        if (fullReset) {
            await identityStorage.clearAll();
            setName('');
            setColor(null);
            stateRef.current = {
                ...stateRef.current,
                name: '',
                color: null
            };
        }

        setSessionID(null);
        setSessionUsers([]);
        setIsHost(false);
        setHasRegistered(false);
        setIsReconnecting(false);
        setIsLoading(false);

        stateRef.current = {
            ...stateRef.current,
            sessionID: null,
            sessionUsers: [],
            isHost: false,
            isReconnecting: false,
            isLoading: false,
        };

        socket.auth = { userUUID: stateRef.current.userUUID, sessionID: null };
    }, []);

    // handles a successful create/join
    const finalizeSession = useCallback( async (response, shouldNavigate = false, actionName) => {
        // console.log("!!! HANDLE SUCCESS STARTED !!!");
        try {
            if (response.success) {
                // sync all context states with response
                await setAllThingsIdentity(response.userUUID, response.sessionID);
                setIsHost(response.isHost || false);
                setSessionUsers(response.currentUsers || []);
                setHasRegistered(response.isRegistered);

                // set the refs
                stateRef.current = {
                    ...stateRef.current,
                    isHost: response.isHost,
                    sessionUsers: response.currentUsers || [],
                };

                // if user has already registered
                if (response.isRegistered) {
                    if (!response.name || !response.color) {
                        throw new Error(`[FINALIZE] Registered user missing profile data: name=${response.name}, color=${response.color}`);
                    }
                    await setAllThingsPrefs(response.name, response.color);
                } else {
                    // user has not registered yet
                    // navigate to profile if clicking a button to join
                    // if disconnection/reconnection with a successful response but is not already registered,
                    //      then user must be on profile page during disconnection, so do nothing
                    if (shouldNavigate) {
                        if (navigationRef.isReady()) {
                            navigationRef.navigate('Profile');
                        } else {
                            console.log("NavigationRef not ready yet, directing user to login.");
                        }
                    } else {
                        console.log("User still in setup phase, staying on Profile.");                       
                    }
                }
            } else {
                const errorMessage = response.error || "An unknown error occurred.";
                Alert.alert(`Failed:`, errorMessage);

                console.log(`[${actionName}] Unsuccessful joinSessionAction response. Error:`, response.error);
                handleCleanExit();
            }
            return true;
        } catch (err) {
            console.error(`[${actionName}] CRASH INSIDE FINALIZE SESSION:`, err);
            return false;
        } 
    }, []);

    useEffect(() => {
        const reboot = async () => {
            try {
                const [savedIdentity, savedPrefs] = await Promise.all([
                    identityStorage.load(KEYS.IDENTITY),
                    identityStorage.load(KEYS.PREFS)
                ]);

                if(!savedIdentity?.userUUID || !savedIdentity?.sessionID) {
                    console.log("[REBOOT] Unsuccessful. No saved userUUID or sessionID");
                    setIsRebooting(false);
                    stateRef.current.isRebooting = false;
                    return;
                }

                console.log(`[REBOOT] Found existing session: ${savedIdentity.sessionID}, for user: ${savedIdentity.userUUID}`);

                await setAllThingsIdentity(savedIdentity.userUUID, savedIdentity.sessionID);
                if (savedPrefs?.name && savedPrefs?.color) {
                    // console.log("Preferences found. Name:", savedPrefs.name, " Color:", savedPrefs.color);
                    await setAllThingsPrefs(savedPrefs.name, savedPrefs.color);
                }
                
                // reboot logic
                try {
                    const response = await joinSessionAction(
                        savedIdentity.sessionID, 
                        savedIdentity.userUUID,
                        {name: (savedPrefs?.name || "Returning User"), color: (savedPrefs?.color || '#cccccc')}
                    );
                    await finalizeSession(response, true, 'REBOOT');
                    console.log("[REBOOT] successful reboot for UUID", savedIdentity.userUUID);
                } catch (err) {
                    console.log("[REBOOT] Rejoin error:", err.message);
                    // if server is unreachable, stay in 'reconnecting'
                    // if logic error (404), wipe it
                    if (err.message.includes("exist")) await handleCleanExit();
                }
            } catch (err) {
                console.error("[REBOOT] failed:", err);
            } finally {
                setIsRebooting(false);
                stateRef.current.isRebooting = false;
            }
        };  
        reboot();
    }, []); 

    return {
        handleCleanExit, 
        finalizeSession
    };
};