// frontend/src/features/login/useLoginLogic.js    

import React, { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';

import { useUser } from '../../context/UserContext';
import { identityStorage, KEYS } from '../../core/identity/identityStorage';
import { createSessionAction, joinSessionAction } from '../../core/socket/socketServices';
import { useSessionBackHandler } from '../useSessionBackHandler';
    
export const useLoginLogic = ({ isJoinScreen, hideJoinInput }) => {    

    const { isConnected, justCreatedSession, isLoading, setIsLoading, finalizeSession } = useUser();

    const [tempCode, setTempCode] = useState(''); 
    const [errorMsg, setErrorMsg]  = useState('');

    const activeRequest = useRef(null);

    // --- CREATE/JOIN SESSION HELPERS ---
    // handles initiation 
    const startRequest = (type, isNewSession = false) => {
        // checks connection and loading status
        if (!isConnected){
            Alert.alert(
                "Connection Error", 
                "Cannot create or join a session while offline. Please check your internet connection and try again."
            );
            return false;
        }

        console.log("loading:", isLoading);
        if (isLoading) return false;

        // sets initial states
        setErrorMsg("");
        setIsLoading(true);
        activeRequest.current = type;
        justCreatedSession.current = isNewSession;
        return true;
    };

    // handles final cleanup
    const cleanup = () => {
        activeRequest.current = null;
        setIsLoading(false);
    };

    // ------ START NEW SESSION --------
    const createNewSession = async () => {
        console.log("starting create request");
        if (!startRequest('creating', true)) return;

        const savedIdentity = identityStorage.load(KEYS.IDENTITY);
        const uuid = savedIdentity?.userUUID ? savedIdentity.userUUID : null;
        const savedPrefs = identityStorage.load(KEYS.PREFS);
        const profile = (savedPrefs?.name) ? { name: savedPrefs?.name, color: savedPrefs?.color } : null;

        // console.log("Saved Identity userUUID: ", savedIdentity?.userUUID, "profile to send: ", profile);

        try {
            // console.log("Attempting to create session");
            const response = await createSessionAction(uuid, profile);
            // check if android user hit back while server was processing
            // console.log("Active request status: ", activeRequest.current);
            if (activeRequest.current !== 'creating') return;
            finalizeSession(response, true, 'CREATE');
        } catch (err) {
            console.log("[CREATE] error:", err.message);
            Alert.alert("Session Error", err.message || "Failed to create session.");
        } finally {
            cleanup();
        }
    };

    // ------ JOIN EXISTING SESSION ------
    const joinSession = async () => {
        if (!tempCode.trim()) {
            setErrorMsg("Please enter a session code.");
            setTimeout(() => setErrorMsg(""), 5000);
            return; 
        }
        if (!startRequest('joining', false)) return;
        
        const sessionID = tempCode.toUpperCase();

        const savedIdentity = identityStorage.load(KEYS.IDENTITY);
        const uuid = savedIdentity?.userUUID ? savedIdentity.userUUID : null;
        const savedPrefs = identityStorage.load(KEYS.PREFS);
        const profile = (savedPrefs?.name) ? { name: savedPrefs?.name, color: savedPrefs?.color } : null;

        try {
            const response = await joinSessionAction(sessionID, uuid, profile);
            // check if android user hits back while server was processing
            if (activeRequest.current !== 'joining') return;
            finalizeSession(response, true, 'JOIN');
        } catch (err) {
            // handles technical errors and the logic ones thrown above
            setErrorMsg(err.message);
            setTimeout(() => setErrorMsg(""), 5000);
        } finally {
            cleanup();
        }
    };

    // take care of android "back" button
    const onLeaveLogin = useCallback(() => {
        activeRequest.current = null;
        setIsLoading(false);
     
        // if on screen 2 (join session)
        if (isJoinScreen) {
            hideJoinInput();
        } 

        // don't let android do anything else
        return true;
    }, [isJoinScreen, hideJoinInput, setIsLoading]);
    useSessionBackHandler(onLeaveLogin);

    return {
        createNewSession, joinSession,
        tempCode, setTempCode,
        errorMsg, setErrorMsg,
        isLoading
    };

}