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

        // reset the states
        setSessionID(null);
        setSessionUsers([]);
        setIsHost(false);
        setHasRegistered(false);
        setIsReconnecting(false);
        setIsLoading(false);

        // reset the refs
        stateRef.current = {
            ...stateRef.current,
            sessionID: null,
            sessionUsers: [],
            isHost: false,
            isReconnecting: false,
            isLoading: false,
        };

        // remove socket "identity badges"
        socket.auth = { userUUID: null, sessionID: null };
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
                Alert.alert(`[${actionName}] Failed:`, errorMessage);

                console.log(`[${actionName}] Unsuccessful joinSessionAction response. Error:`, response.error);
                handleCleanExit(true);
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
                const savedIdentity = await identityStorage.load(KEYS.IDENTITY);

                // if no saved preferences upon app reboot, stop reboot
                if(!savedIdentity?.userUUID || !savedIdentity?.sessionID) {
                    console.log("[REBOOT] Unsuccessful. No saved userUUID or sessionID");
                    return;
                }

                console.log(`[REBOOT] Found existing session: ${savedIdentity.sessionID}, for user: ${savedIdentity.userUUID}`);

                // restore the state, refs, and socket auth
                await setAllThingsIdentity(savedIdentity.userUUID, savedIdentity.sessionID);
                
                // reboot logic
                try {
                    const response = await joinSessionAction(
                        savedIdentity.sessionID, 
                        savedIdentity.userUUID
                    );
                    await finalizeSession(response, true, 'REBOOT');
                } catch (err) {
                    // if server is unreachable, stay in 'reconnecting'
                    // if logic error (404), wipe it
                    if (err.message.includes("exist")) await handleCleanExit(true);
                }
            } catch (err) {
                console.error("[REBOOT] failed: ", err);
            } finally {
                // ensures that if user remains in app and loses connection, logic follows silent rejoin
                // in onConnect. isRebooting is only set to true when the app is (re)booted
                setIsRebooting(false);
                stateRef.current = {
                    ...stateRef.current,
                    isRebooting: false
                };
            }
        };  
        reboot();
    }, []); 

    return {
        handleCleanExit, 
        finalizeSession
    };
};