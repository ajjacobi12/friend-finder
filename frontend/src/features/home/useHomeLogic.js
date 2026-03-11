// frontend/src/features/home/useHomeLogic.js
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';

import { useUser } from '../../context/UserContext';
import { useSessionBackHandler } from '../useSessionBackHandler';

import { removeUserAction, transferHostAction, endSessionAction, leaveSessionAction } from '../../core/socket/socketServices';

export const useHomeLogic = () => {
    const { sessionID, isHost, friends, handleCleanExit } = useUser();
    
    const [showTransfer, setShowTransfer] = useState(false);

    // takes care of android "back" button
    const onLeaveHome = useCallback(() => {
        console.log("Back button pressed on home - ignored.");
        return true;
    }, []);
    useSessionBackHandler(onLeaveHome);

    // --------------------------- HELPERS ---------------------------
    // alerts
    const alertHelper = (title, text) => {
        return new Promise((resolve) => {
            Alert.alert( title, text,
                [
                    { text: "No", style: "cancel", onPress: () => resolve(false) },
                    { text: "Yes", style: "destructive", onPress: () => resolve(true) }
                ]
            );
        });
    };

    // confirm alert and run function upon confirmation
    const confirmAndRun = async ({ title, message, action }) => {
        const confirmed = await alertHelper(title, message);
        if (!confirmed) return false;

        try {
            await action();
            return true;
        } catch (err) {
            Alert.alert("Error", err.message || "An unexpected error occurred.");
            return false;
        }
    };

    // --------------------------- FUNCTIONS ---------------------------
    // --- REMOVE USER ----
    const removeUser = useCallback( async (friend) => {
        return confirmAndRun({
            title: "Remove user", 
            message: `Remove ${friend.name} from session?`, 
            action: () => removeUserAction(sessionID, friend.uuid)
        });
    }, [sessionID]);

    // --- TRANSFER HOST STATUS ---
    const handleTransferHost = useCallback( async (friend) => {
        return confirmAndRun({
            title: "Transfer host", 
            message: `Make ${friend.name} the new host?`, 
            action: () => transferHostAction(sessionID, friend.uuid)
        });
    }, [sessionID]);

    // --- END SESSION FOR ALL USERS ---
    const endSessionForAll = useCallback( async () => {
        return confirmAndRun({
            title: "End session for all users?", 
            message: "", 
            action: () => endSessionAction(sessionID)
        });
    }, [sessionID]);

    // --- VOLUNTARILY LEAVE A SESSION ---
    const leaveSession = useCallback( async () => {
        // if host is leaving but there are 2 or more other users, require transfer of ownership first
        if (isHost && friends.length > 1) {
            setShowTransfer(true);
            return;
        }

        const confirmed = await alertHelper("", "Are you sure you'd like to leave the session?");

        if (!confirmed) return;

        try {
            await leaveSessionAction(sessionID);
            handleCleanExit();
        } catch (err) {
            Alert.alert("Error", err.message);
        }

    }, [sessionID, isHost, friends, handleCleanExit]);

    const modalTransferHost = async (selectedFriend) => {
        const confirmed = await handleTransferHost(selectedFriend);
        if (confirmed) {
            try {
                await leaveSessionAction(sessionID);
                setShowTransfer(false);
                handleCleanExit();
            } catch (err) {
                Alert.alert("Transfer failed", err.message);
            }
        }
    };
  
    return { removeUser, handleTransferHost, endSessionForAll, leaveSession, 
        modalTransferHost, showTransfer, setShowTransfer };
};