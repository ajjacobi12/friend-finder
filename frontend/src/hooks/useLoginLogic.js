// useLoginLogic.js    

import React, { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';

import { useUser } from '../context/UserContext';
import { useSessionBackHandler } from './useSessionBackHandler';
import { createSessionAction, joinSessionAction } from '../services/socketServices';
    
export const useLoginLogic = ({ navigation, isJoinScreen, hideJoinInput }) => {    

    const { setSessionId, setSessionUsers, setName, setSelectedColor, 
        setHasRegistered, isConnected, setIsHost, justCreatedSession, 
        userUUID, setUserUUID } = useUser();

    const [tempCode, setTempCode] = useState(''); 
    const [errorMsg, setErrorMsg]  = useState('');
    const [loading, setLoading] = useState(false);

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
        if(loading) return false;

        // sets initial states
        setErrorMsg("");
        setLoading(true);
        activeRequest.current = type;
        justCreatedSession.current = isNewSession;
        return true;
    };

    // handles a successful create/join
    const handleSuccess = (response) => {
        // sync all context state with response
        setUserUUID(response.userUUID);
        setSessionId(response.roomID); 
        setIsHost(response.isHost || false);
        setSessionUsers(response.currentUsers || []);
        setName(response.name);
        setSelectedColor(response.color);

        // registration check
        if (response.alreadyRegistered) {
            setHasRegistered(true);
        } else {
            navigation.navigate('Profile');
        }
    };

    // handles final cleanup
    const cleanup = () => {
        activeRequest.current = null;
        setLoading(false);
    };

    // ------ START NEW SESSION --------
    const createNewSession = async () => {
        if (!startRequest('creating', true)) return;

        try {
            const response = await createSessionAction(userUUID);
            // check if android user hit back while server was processing
            if (activeRequest.current !== 'creating') return;
            handleSuccess(response);
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
        
        const code = tempCode.toUpperCase();
        try {
            const response = await joinSessionAction(code, userUUID);
            // check if android user hits back while server was processing
            if (activeRequest.current !== 'joining') return;
            handleSuccess(response);
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
        setLoading(false);
     
        // if on screen 2 (join session)
        if (isJoinScreen) {
            hideJoinInput();
        } 

        // don't let android do anything else
        return true;
    }, [isJoinScreen, hideJoinInput, setLoading]);
    useSessionBackHandler(onLeaveLogin);

    return {
        createNewSession, joinSession,
        tempCode, setTempCode,
        errorMsg, setErrorMsg,
        loading
    };

}