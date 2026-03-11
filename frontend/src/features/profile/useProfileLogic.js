// frontend/src/features/profile/useProfileLogic.js
import React, { useState, useCallback, useEffect } from 'react'; 
import { Keyboard } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useSessionBackHandler } from '../useSessionBackHandler';

import { useUser } from '../../context/UserContext';

import { leaveSessionAction, updateUserAction } from '../../core/socket/socketServices';
import { validate, UserProfileSchema } from '../../core/session/validation';
import { identityStorage, KEYS } from '../../core/identity/identityStorage';

export const useProfileLogic = ({ navigation, colorOptions }) => {
    const { 
        name, setName, 
        color, setColor, 
        friends, sessionID,
        hasRegistered, setHasRegistered, 
        handleCleanExit, updateDiskPrefs
    } = useUser();

    const [tempName, setTempName] = useState(name);
    const [errorMsg, setErrorMsg] = useState(""); 
    const [loading, setLoading] = useState(false);

    // --- helper to get first available color ---
    const getFirstAvailableColor = useCallback((currentColor, currentFriends, options) => {
        const takenColors = currentFriends.map(f => f.color);
        // accounts for:
        // new users will have color === null
        // user joining a new session with saved prefs loaded might have a duplicate color
        if (currentColor === null || takenColors.includes(currentColor)) {
            return options.find(c => !takenColors.includes(c));
        }

        return currentColor;
    }, []);

    // --- helper to save profile changes ---
    const commitProfileChange = async (actionName, newName, newColor, oldColor = null) => {
        try {
            await updateUserAction(newName, newColor);

            if (!hasRegistered) {
                await identityStorage.save(KEYS.PREFS, { name: newName, color: newColor });
            } else {
                await updateDiskPrefs({ name: newName, color: newColor });
            }

            setColor(newColor);
            if (newName !== name) setName(newName);
            Keyboard.dismiss();
        } catch (err) {
            const availColor = getFirstAvailableColor(oldColor || newColor, friends, colorOptions);
            setColor(availColor);

            setTempName(name);
            setErrorMsg(err.message);
            console.log(`[${actionName}] commit profile change error:`, err.message);
        } finally {
            if (!hasRegistered) setLoading(false);
        }
    };

    // --- INITIAL JOIN ----
    const handleJoin = async () => {
        if (loading) return;

        // validate the input
        const result = validate(UserProfileSchema, {
            name: tempName,
            color
        });

        if (!result.success){
            setErrorMsg(result.error);
            return;
        }

        // clear UI
        setErrorMsg("");
        setLoading(true);

        // commit profile changes, then navigate
        await commitProfileChange('JOINING', result.data.name, result.data.color);      
        setHasRegistered(true);
    };

    // --- AUTOMATICALLY SAVE COLOR (AND NAME) WHEN NEW COLOR SELECTED ---
    const handleColorSelection = async (newColor) => {
        const previousColor = color;
        setColor(newColor);
        setErrorMsg("");

        // only automatically save if user has already registered
        if (!hasRegistered) return;

        await commitProfileChange('COLOR AUTO SAVE', (tempName.trim() || name), newColor, previousColor);
    };

    // --- BACK CLEANUP HELPER ---
    const performLeaveCleanup = useCallback(() => {
        Keyboard.dismiss();
        if (sessionID) {
            leaveSessionAction(sessionID).catch(() => {});
        }
        handleCleanExit();
    }, [sessionID, handleCleanExit]);

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
            return true;
        }
    }, [hasRegistered, navigation, handleBack]);
    useSessionBackHandler(onLeaveProfile);

    // --- SWIPING BACK ----
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            // CASE 1: The user has joined, do nothing
            if (hasRegistered) return;
            // CASE 2: user has not registered, redirect them to login and cleanup
            e.preventDefault();
            performLeaveCleanup();
        });

        return unsubscribe;
    }, [navigation, hasRegistered, sessionID]);

    // --- REMEMBER PREVIOUS NAME ENTERED ----
    useEffect(() => {
        const loadName = async() => {
            const savedPrefs = await identityStorage.load(KEYS.PREFS);
            const loadedName = savedPrefs?.name || "";

            if (!tempName) setTempName(loadedName);
        }
        loadName();
    }, []);

    // --- SET INITIAL JOIN COLOR -----
    useEffect(() => {
        // console.log("selected color: ", color);
        if (!hasRegistered) {
            const availColor = getFirstAvailableColor(color, friends, colorOptions);
            if (availColor && available !== color) setColor(availColor);
        }
    }, [friends, hasRegistered, color, colorOptions, getFirstAvailableColor]);
    
    // --- SAVE USERNAME WHEN SWITCHING TABS ---
    useFocusEffect(
        useCallback(() => {
            return () => {
                // don't autosave if user hasn't registered, the name is empty, or hasn't changed
                // color saves upon selection, so no conditions on it needed here
                if (!hasRegistered || tempName.trim() === "" || tempName.trim() === name) return;

                commitProfileChange('BACK AUTO SAVE', tempName.trim(), color);
            };
        }, [hasRegistered, tempName, name, color])
    );

    return { 
        handleJoin, handleBack, handleColorSelection,
        loading, 
        errorMsg, setErrorMsg, 
        tempName, setTempName,
        name,
        color, setColor,
        hasRegistered, setHasRegistered,
        friends, sessionID
    };

}