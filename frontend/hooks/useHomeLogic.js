import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useUser } from '../UserContext';

export const useHomeLogic = () => {
    const { sessionId, secureEmit } = useUser();

    const removeUser = useCallback((friend) => {
        Alert.alert(
            "Remove user?",
            `Remove ${friend.name} from session?`,
            [
                { text: "No", style: "cancel" },
                { 
                    text: "Yes", 
                    style: "destructive",
                    onPress: () => secureEmit('remove-user', { roomID: sessionId, userUUIDToRemove: friend.id })
                }
            ]
        );
    }, [sessionId, secureEmit]);

    const handleTransferHost = useCallback((friend) => {
        Alert.alert(
            "Transfer host?",
            `Make ${friend.name} the new host?`,
            [
                { text: "No", style: "cancel" },
                { 
                    text: "Yes", 
                    style: "destructive",
                    onPress: () => secureEmit('transfer-host', { roomID: sessionId, newHostUUID: friend.id })
                }
            ]
        );
    }, [sessionId, secureEmit]);

    const endSessionForAll = useCallback(() => {
        Alert.alert(
            "End session for all?",
            "End session for all users?",
            [
                { text: "No", style: "cancel" },
                { 
                    text: "Yes", 
                    style: "destructive", 
                    onPress: () => secureEmit('end-session', sessionId)
                }
            ]
        );
    }, [sessionId, secureEmit]);

    return { removeUser, handleTransferHost, endSessionForAll };
};