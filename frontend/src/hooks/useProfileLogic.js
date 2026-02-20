// useProfileLogic.js
import React, { useState, useCallback, useEffect } from 'react'; // useState lets app remember things (eg. messages), useEffect allows app to perform actions (eg. connecting ot the server) as soon as it opens
import { Keyboard } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useUser } from '../context/UserContext';
import { leaveSessionAction, updateUserAction } from '../services/socketServices';
import { useSessionBackHandler } from './useSessionBackHandler';

export const useProfileLogic = ({ navigation, colorOptions }) => {
    const { 
        name, setName, 
        selectedColor, setSelectedColor, 
        friends, sessionId,
        hasRegistered, setHasRegistered, 
        handleCleanExit 
    } = useUser();
    const [tempName, setTempName] = useState(name);
    const [errorMsg, setErrorMsg] = useState(""); 
    const [loading, setLoading] = useState(false);

    // --- INITIAL JOIN ----
    const handleJoin = async () => {
        if (loading) return;
        // make sure user has input a name
        if (!tempName || tempName.trim() === "") {
            setErrorMsg("Please enter a username!");
            return;
        }

        setErrorMsg("");
        setLoading(true);

        try {
            await updateUserAction(tempName.trim(), selectedColor);

            setName(tempName.trim());
            setHasRegistered(true);
            Keyboard.dismiss();
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }        
    };

    // --- AUTOMATICALLY SAVE COLOR WHEN CLICKED ---
    const handleColorSelection = async (color) => {
        const previousColor = selectedColor;
        setSelectedColor(color);
        setErrorMsg("");

        if (hasRegistered) {
            try {
                await updateUserAction(tempName.trim() || name, color);
                if (tempName.trim() !== name) {
                    setName(tempName.trim());
                }
            } catch (err) {
                setSelectedColor(previousColor);
                setErrorMsg(err.message);
            }
        }
    };

    // --- BACK CLEANUP HELPER ---
    const performLeaveCleanup = useCallback(() => {
        Keyboard.dismiss();
        if (sessionId) {
            leaveSessionAction(sessionId).catch(() => {});
        }
        handleCleanExit();
    }, [sessionId, handleCleanExit]);

    // --- BACK BUTTON TO LOGIN ---
    const handleBack = () => {
        performLeaveCleanup();
        navigation.goBack();
    };

    // --- ANDROID BACK BUTTON ---
    const onLeaveProfile = useCallback(() => {
        if (hasRegistered) {
            navigation.navigate('Chat', { isDirectMessage: false });
            return true;
        }
        else {
            handleBack();
            return false;
        }
    }, [hasRegistered, navigation, handleBack]);
    useSessionBackHandler(onLeaveProfile);

    // --- SWIPING BACK ----
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            // CASE 1: The user has joined, do nothing
            if (hasRegistered) return;
            // CASE 2: user has not registered, redirect them to login and cleanup
            performLeaveCleanup();
        });

        return unsubscribe;
    }, [navigation, hasRegistered, sessionId]);

    // --- REMEMBER PREVIOUS NAME ENTERED ----
    useEffect(() => {
        if (name && !tempName) {
            setTempName(name);
        }
    }, [name]);

    // --- SET INITIAL JOIN COLOR -----
    useEffect(() => {
        const takenColors = friends.map(f => f.color);
        if (!selectedColor || takenColors.includes(selectedColor)) {
            const firstAvailable = colorOptions.find(color => !takenColors.includes(color));
            if (firstAvailable) setSelectedColor(firstAvailable);
        }
    }, [friends]);
    
    // --- SAVE USERNAME WHEN SWITCHING TABS ---
    useFocusEffect(
        useCallback(() => {
            return () => {
                const saveProfile = async () =>{
                    // update if user is already registered, name isn't empty, and has changed
                    if (hasRegistered && tempName.trim() !== "" && tempName.trim() !== name) {
                        try {
                            await updateUserAction(tempName.trim(), selectedColor);
                            setName(tempName.trim());
                        } catch (err) {
                            setTempName(name);
                            console.log("Auto-save failed:", err.message);
                        }
                    }
                };
                saveProfile();
            };
        }, [hasRegistered, tempName, name, selectedColor])
    );

    return { 
        handleJoin, handleBack, handleColorSelection,
        loading, 
        errorMsg, setErrorMsg, 
        tempName, setTempName,
        name,
        selectedColor, setSelectedColor,
        hasRegistered, setHasRegistered,
        friends, sessionId
    };

}