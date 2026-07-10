// frontend/src/features/chat/useChatSocketListeners.js
import { useEffect } from 'react';
import { stopTypingAction } from '../../core/socket/socketServices';

export const useChatSocketListeners = (socket, currentChatRoomID, setTypingUsers, spamTimeoutRef, typingTimeoutRef, isTypingRef) => {

    useEffect(() => {
        if (!socket) return;

        const handleTyping = ({ chatRoomID, userUUID }) => {
            try {
                if (chatRoomID === currentChatRoomID) {
                    setTypingUsers(prev => ({ ...prev, [userUUID]: true }));
                }
            } catch (err) {
                console.error("Typing handler error: ", err.message);
            }
        };

        const handleStopTyping = ({ userUUID }) => {
            try {
                setTypingUsers(prev => {
                    const newState = { ...prev };
                    delete newState[userUUID]; // remove user from "typing" list
                    return newState;
                });
            } catch (err) {
                console.error("Stop typing handler error: ", err.message);
            }
        };

        socket.on('user-typing', handleTyping);
        socket.on('user-stop-typing', handleStopTyping);

        // save latest chatroom in case user changes rooms quickly
        const chatRoomIDToCleanup = currentChatRoomID;

        return () => {
            socket.off('user-typing', handleTyping);
            socket.off('user-stop-typing', handleStopTyping);

            // actions to perform is user closes the app or navigates away from the tab

            // clean local "typing" states
            setTypingUsers({});

            // clear spam warning timer
            if (spamTimeoutRef.current) {
                clearTimeout(spamTimeoutRef.current); 
                spamTimeoutRef.current = null;  
            }

            // clear typing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }

            // notify server we've stopped typing if applicable
            if (isTypingRef.current) {
                stopTypingAction(chatRoomIDToCleanup);
                isTypingRef.current = false;
            }
        };
    }, [socket, currentChatRoomID]);
};