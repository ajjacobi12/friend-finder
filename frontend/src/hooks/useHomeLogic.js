// useHomeLogic.js
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useUser } from '../context/UserContext';
import { useSessionBackHandler } from './useSessionBackHandler';

import { removeUserAction, transferHostAction, endSessionAction, leaveSessionAction } from '../services/socketServices';

export const useHomeLogic = () => {
    const { sessionId, isHost, friends, handleCleanExit } = useUser();

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
            await removeUserAction(sessionId, friend.uuid);
            return true;
        } catch (err) {
            Alert.alert("Error", err.message);
            return false;
        }
    }, [sessionId]);

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
            await transferHostAction(sessionId, friend.uuid);
            return true;
        } catch (err) {
            Alert.alert("Error", err.message);
            return false;
        }
    }, [sessionId]);

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
            await endSessionAction(sessionId);
        } catch (err) {
            Alert.alert("Error", err.message);
        }
    }, [sessionId]);

    // --- VOLUNTARILY LEAVE A SESSION ---
    const leaveSession = useCallback( async (triggerModal) => {
        // if host is leaving but there are 2 or more other users, require transfer of ownership first
        if (isHost && friends.length > 1) {
            triggerModal();
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
            await leaveSessionAction(sessionId);
            handleCleanExit();
        } catch (err) {
            Alert.alert("Error", err.message);
        }

    }, [sessionId, isHost, friends, handleCleanExit]);
  
    return { removeUser, handleTransferHost, endSessionForAll, leaveSession, leaveSessionAction };
};