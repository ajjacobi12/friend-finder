// useHomeLogic.js
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';

import { useUser } from '../context/UserContext';
import { useSessionBackHandler } from './useSessionBackHandler';

import { removeUserAction, transferHostAction, endSessionAction, leaveSessionAction } from '../services/socketServices';

export const useHomeLogic = () => {
    const { sessionID, isHost, friends, handleCleanExit } = useUser();
    
    const [showTransfer, setShowTransfer] = useState(false);

    // takes care of android "back" button
    const onLeaveHome = useCallback(() => {
        console.log("Back button pressed on home - ignored.");
        return true;
    }, []);
    useSessionBackHandler(onLeaveHome);

    // --- REMOVE USER ----
    const removeUser = useCallback( async (friend) => {
        const confirmed = await new Promise((resolve) => {
            Alert.alert( "Remove user?", `Remove ${friend.name} from session?`,
                [
                    { text: "No", style: "cancel", onPress: () => resolve(false) },
                    { text: "Yes", style: "destructive", onPress: () => resolve(true) }
                ]
            );
        });

        if (!confirmed) return;

        try {
            await removeUserAction(sessionID, friend.uuid);
            return true;
        } catch (err) {
            Alert.alert("Error", err.message);
            return false;
        }
    }, [sessionID]);

    // --- TRANSFER HOST STATUS ---
    const handleTransferHost = useCallback( async (friend) => {
        const confirmed = await new Promise((resolve) => {
            Alert.alert( "Transfer host?", `Make ${friend.name} the new host?`,
                [
                    { text: "No", style: "cancel", onPress: () => resolve(false) },
                    { text: "Yes", style: "destructive", onPress: () => resolve(true) }
                ]
            );
        });
        
        if (!confirmed) return;

        try {
            await transferHostAction(sessionID, friend.uuid);
            return true;
        } catch (err) {
            Alert.alert("Error", err.message);
            return false;
        }
    }, [sessionID]);

    // --- END SESSION FOR ALL USERS ---
    const endSessionForAll = useCallback( async () => {
        const confirmed = await new Promise((resolve) => {
            Alert.alert( "End session for all?", "End session for all users?",
                [
                    { text: "No", style: "cancel", onPress: () => resolve(false) },
                    { text: "Yes", style: "destructive", onPress: () => resolve(true) }
                ]
            );
        });

        if (!confirmed) return;

        try {
            await endSessionAction(sessionID);
        } catch (err) {
            Alert.alert("Error", err.message);
        }
    }, [sessionID]);

    // --- VOLUNTARILY LEAVE A SESSION ---
    const leaveSession = useCallback( async () => {
        // if host is leaving but there are 2 or more other users, require transfer of ownership first
        if (isHost && friends.length > 1) {
            setShowTransfer(true);
            return;
        }

        const confirmed = await new Promise((resolve) => {
            // if no transfer required, confirm leave
            Alert.alert( "Confirm Leave?", "Are you sure you'd like to leave the session?",
                [
                    { text: "No", style: "cancel", onPress: () => resolve(false) }, 
                    { text: "Yes", style: "destructive", onPress: () => resolve(true) }
                ]
            );
        });

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