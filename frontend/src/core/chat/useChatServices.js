// frontend/src/core/chat/useChatServices
import React, { useCallback } from 'react';
import { returnUpdatedMsg } from './chatUtils';

export const useChatServices = (stateRef, setActiveRoom, setUnreadRooms, setChatHistory) => {    
    // --- UNREAD MESSAGES ---
    // function called from hooks/UI/useChatLogic.js
    const markAsRead = useCallback((chatRoomID) => {
        setActiveRoom(chatRoomID);
        stateRef.current = {
            ...stateRef.current,
            activeRoom: chatRoomID
        };
        setUnreadRooms(prev => prev.filter(roomID => roomID !== chatRoomID));
    }, []);

    // --- SET UPDATED LOCAL MESSAGE DATA ---
    const updateLocalMsg = useCallback((chatRoomID, msgID, updates) => {
        if (!chatRoomID || !msgID) {
            throw new Error(`[STORAGE ERROR] Update failed: ${!chatRoomID ? 'chatRoomID' : 'msgID'} is missing.`);
        }

        setChatHistory(prev => returnUpdatedMsg(prev, chatRoomID, msgID, updates) );
    }, [setChatHistory]);

    return {
        markAsRead,
        updateLocalMsg
    };
    
};