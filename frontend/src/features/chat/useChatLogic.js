// frontend/src/features/chat/useChatLogic.js
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Alert, Keyboard } from 'react-native';
import * as Crypto from 'expo-crypto';

import { useSessionBackHandler } from '../useSessionBackHandler';
import { useUser } from '../../context/UserContext';

import { useUnreadAnim } from './useUnreadAnim';
import { useChatSocketListeners } from './useChatSocketListeners';

import { formatMsgData } from '../../core/chat/chatUtils';
import { sendMsgAction, editMsgAction, deleteMsgAction, typingAction, stopTypingAction } from '../../core/socket/socketServices';

import { COOLDOWN_MS } from '../../constants';

export const useChatLogic = ({ isDM, DMroomID, navigation, isFocused, isSidebarVisible, newMsgBelow }) => {
    // ---------------------------------------------------------------------------------------------
    // DATA & CONTEXT
    // ---------------------------------------------------------------------------------------------
    const { 
        sessionID, socket,
        name, userUUID,
        chatHistory, setChatHistory,  
        markAsRead,  unreadRooms, 
        updateLocalMsg
    } = useUser();
    
    // ---------------------------------------------------------------------------------------------
    // STATES & REFS
    // ---------------------------------------------------------------------------------------------
    const [inputText, setInputText] = useState('');
    const [typingUsers, setTypingUsers] = useState({});
    const [spamWarning, setSpamWarning] = useState('');
    const [editingMsg, setEditingMsg] = useState(null);

    const lastSentRef = useRef(0);
    const spamTimeoutRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    // ---------------------------------------------------------------------------------------------
    // DERIVED CONSTANTS & MEMOIZED DATA
    // ---------------------------------------------------------------------------------------------
    const currentChatRoomID = isDM ? DMroomID : sessionID;

    const activeRoomMsgs = useMemo(() => {
        const roomMsgs = chatHistory[currentChatRoomID] || {};
        // Convert object to array and sort by timestamp descending (for inverted FlatList)
        return Object.values(roomMsgs).sort((a, b) => b.timestamp - a.timestamp);
    }, [chatHistory, currentChatRoomID]);

    const hasUnreadDMs = unreadRooms.some(id => id.includes('_'));
    const hasUnreadGroup = unreadRooms.includes(sessionID);

    // ---------------------------------------------------------------------------------------------
    // NAVIGATION & SYSTEM HANDLERS
    // ---------------------------------------------------------------------------------------------
    // --- ANDROID BACK BUTTON ---
    const onLeaveChat = useCallback(() => {
        if (isDM) {
            navigation.navigate('Chat', { isDM: false });
        } else {
            navigation.navigate('Map');
        }
        return true;
    }, [isDM, navigation]);
    useSessionBackHandler(onLeaveChat);

    // ---------------------------------------------------------------------------------------------
    // INTERNAL LOGIC HELPERS
    // ---------------------------------------------------------------------------------------------
    // --- CREATE & STORE INITIAL MESSAGE LOCALLY ---
    const addLocalMsg = (chatRoomID, text) => {
        const msgID = Crypto.randomUUID();
        
        const localMsgData = {
            chatRoomID,
            msgID,
            senderUUID: userUUID,
            context: { text },
            timestamp: Date.now(), // Local timestamp for immediate sorting
        };

        const msgData = formatMsgData(localMsgData, 'pending');

        // Optimistic UI update
        // update local state so sender sees message instantly
        // setAllMessages(prev => ({
        //     ...prev,
        //     [chatRoomID]: [messageData, ...(prev[chatRoomID] || [])]
        // }));

        setChatHistory(prev => ({
            ...prev,
            [chatRoomID]: { ...(prev[chatRoomID] || {}), [msgID]: msgData }
        }));

        return msgID; // Return this so the caller can update it later
    };

    // --- TYPING STATUS HELPER ---
    const setTypingStatus = (status, chatRoomID) => {
        // don't do anything if nothing has changed
        if (isTypingRef.current === status) return;

        isTypingRef.current = status;

        if (status) {
            typingAction(chatRoomID);
        } else {
            stopTypingAction(chatRoomID);
        }
    };

    // --- HANDLES SPAM IN SEND MESSAGE ---
    const handleSpam = () => {
        // prevents user from spamming chat
        const now = Date.now();
        if (now - lastSentRef.current < COOLDOWN_MS) {
            setSpamWarning("Slow down! Wait a second...");
            console.log(`User ${name} is sending messages too quickly. Message not sent.`);
            // clear existing timer if they're tapping fast
            if (spamTimeoutRef.current) clearTimeout(spamTimeoutRef.current);
            spamTimeoutRef.current = setTimeout(() => setSpamWarning(''), 2000);
            return false;
        }

        // reset reference time & clear spam warning
        lastSentRef.current = now;
        setSpamWarning('');
        if (spamTimeoutRef.current) {
            clearTimeout(spamTimeoutRef.current);
            spamTimeoutRef.current = null;
        }

        return true;
    };

    // ---------------------------------------------------------------------------------------------
    // CORE API ACTIONS (network/state updates)
    // ---------------------------------------------------------------------------------------------   
    // --- EDIT HANLDER  ---    
    const handleEditMsg = async (msgID, newText) => {
        const chatRoomID = currentChatRoomID;
        try {
            await editMsgAction(msgID, chatRoomID, newText);
            
            updateLocalMsg(chatRoomID, msgID, {
                isEdited: true,
                newText: newText.trim(),
            });
        } catch (err) {
            console.log("[EDIT MSG] Error: ", err.message);
            Alert.alert("Error", "Could not edit message.");
        }
    };

    // --- DELETE HANLDER  ---    
    const handleDeleteMsg = async (msgID) => {
        const chatRoomID = currentChatRoomID;
        try {
            await deleteMsgAction(msgID, chatRoomID);

            updateLocalMsg(chatRoomID, msgID, {
                isDeleted: true,
                newText: `${name} removed this message.`
            });
        } catch (err) {
            console.log("[DELETE MSG] Error: ", err.message);
            Alert.alert("Error", "Could not delete message.");
        }
    };

    // --- SEND MESSAGE ---
    const sendMsg = async (retryText = null) => {
        const chatRoomID = currentChatRoomID; // if DM: Auuid_Buuid, if general: sessionID
        const textToSend = (retryText !== null ? retryText : inputText).trim();
        if (textToSend.length === 0) return;

        if(!handleSpam()) return;
        
        if (retryText === null) {
            setInputText('');
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            setTypingStatus(false, chatRoomID)
        }

        const msgID = addLocalMsg(chatRoomID, textToSend);

        const outboundData = {
            msgID,
            chatRoomID,
            context: { text: textToSend }
        };

        try {
            const response = await sendMsgAction(outboundData);
            updateLocalMsg(chatRoomID, msgID, { 
                status: 'sent', 
                serverTimestamp: response.serverTimestamp || Date.now()
            });
        } catch (err) {
            console.error("[SEND] failed: ", err.message);
            try {
                updateLocalMsg(chatRoomID, msgID, { status: 'failed' });
            } catch (error) {
                console.error("[STATUS] update failed: ", error.message);
            }
        }
    };

    
    // --- RESEND FAILED MESSAGE ---
    const resendMsg = async (failedMsg) => {
        const chatRoomID = currentChatRoomID;

        if(!handleSpam()) return;
        
        try {
            updateLocalMsg(chatRoomID, failedMsg.msgID, { status: 'pending' });

            const response = await sendMsgAction({
                msgID: failedMsg.msgID,
                chatRoomID,
                context: { text: failedMsg.context.text }
            });

            updateLocalMsg(chatRoomID, failedMsg.msgID, {
                status: 'sent',
                serverTimestamp: response.serverTimestamp || Date.now()
            });
        } catch (err) {
            console.error("Resend failed: ", err.message);
            try{
                updateLocalMsg(chatRoomID, failedMsg.msgID, { status: 'failed' });
            } catch (storageErr) {
                console.error("[STATUS] update failed: ", storageErr.message);
            }
        }
    };

    // ---------------------------------------------------------------------------------------------
    // UI EVENT HANDLERS (called directly by components)
    // ---------------------------------------------------------------------------------------------   
    // --- TYPING INDICATOR EMITTED ---
    const handleTextChange = (text) => {
        setInputText(text);
        const chatRoomID = currentChatRoomID;

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        if (text.trim().length === 0) {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            setTypingStatus(false, chatRoomID);
            return;
        }

        setTypingStatus(true, chatRoomID);

        typingTimeoutRef.current = setTimeout(() => {
            setTypingStatus(false, chatRoomID);
        }, 2000);
    };

    // --- CANCEL EDIT ---
    // called in the 'cancel' button in the UI
    const cancelEditing = () => {
        Keyboard.dismiss();
        setEditingMsg(null);
        setInputText('');
    };

    // --- SAVE EDIT ---
    // called in the 'send' button in the UI
    const saveEdit = () => {
        if (!editingMsg) return;

        if (inputText.trim().length > 0 && inputText.trim() !== editingMsg.context.text) {
            handleEditMsg(editingMsg.msgID, inputText.trim());
        }
        Keyboard.dismiss();
        setEditingMsg(null);
        setInputText('');
    };

    // ----------------- ACTION MENU HELPER FUNCTIONS -----------------------
    // --- START EDIT ---
    // called after confirming edit alert
    const startEditing = (item) => {
        setEditingMsg(item);
        setInputText(item.context.text);
    };

    // --- START DELETE ---
    //called after confirming delete alert
    const confirmDeletion = (item) => {
        Alert.alert(
            "Confirm Deletion",
            "Are you sure you want to delete this message? This action cannot be undone.",
            [
                {   text: "Cancel", style: "cancel" },
                {   text: "Delete", 
                    style: "destructive",
                    onPress: () => handleDeleteMsg(item.msgID) 
                }
            ]
        );
    };

    // --- SHOW EDIT/DELETE OPTIONS (show the action menu) ---
    const handleMsgLongPress = (item, canEdit) => {
        if (canEdit) {
            Alert.alert("", "", [
                { text: "Edit", onPress: () => startEditing(item) },
                { text: "Delete", style: "destructive", onPress: () => confirmDeletion(item) },
                { text: "Cancel", style: "cancel" }
            ]);
        }
    };

    // ---------------------------------------------------------------------------------------------
    // EFFECTS (listeners & lifecycles)
    // ---------------------------------------------------------------------------------------------   
    // --- CLEAR UNREAD MESSAGES ---
    // clears when navigating to/from room with unread messages
    useEffect(() => {
        // sets active room in context and clears those messages
        if (isFocused && currentChatRoomID) {
            markAsRead(currentChatRoomID);
        }
        // clears active room when user leaves the screen
        return () => markAsRead(null);
    }, [currentChatRoomID, isFocused]);

    // --- PULSING ANIMATION ---
    // for unread messages
    const anyUnreads = hasUnreadDMs || (isDM && hasUnreadGroup) || newMsgBelow;
    const pulseAnim = useUnreadAnim(anyUnreads && isFocused, isSidebarVisible);

    // --- TYPING INDICATOR/EDITED & DELETED MESSAGES ---
    // listens for 'user-typing' and 'user-stop-typing' events
    useChatSocketListeners(socket, currentChatRoomID, setTypingUsers, spamTimeoutRef, typingTimeoutRef, isTypingRef);

    // ---------------------------------------------------------------------------------------------
    // PUBLIC API
    // ---------------------------------------------------------------------------------------------   
    return {
        inputText, setInputText,
        editingMsg, setEditingMsg,
        activeRoomMsgs, 
        sendMsg, resendMsg,
        typingUsers, spamWarning,
        handleTextChange,
        cancelEditing, saveEdit, startEditing, 
        confirmDeletion,
        handleMsgLongPress,
        sessionID, userUUID,
        unreadRooms,
        currentChatRoomID,
        pulseAnim, 
        hasUnreadDMs, hasUnreadGroup
    };
};