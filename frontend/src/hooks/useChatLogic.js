// hooks/useChatLogic.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Keyboard, Animated } from 'react-native';
import * as Crypto from 'expo-crypto';

import { useUser } from '../context/UserContext';
import { useSessionBackHandler } from './useSessionBackHandler';
import { sendMessageAction, editMessageAction, deleteMessageAction, typingAction, stopTypingAction } from '../services/socketServices';

export const useChatLogic = ({ isDirectMessage, DMroomID, navigation, isFocused, isSidebarVisible, newMsgBelow }) => {
    // ---------------------------------------------------------------------------------------------
    // DATA & CONTEXT
    // ---------------------------------------------------------------------------------------------
    const { 
        sessionID, socket,
        name, userUUID, selectedColor,
        allMessages, setAllMessages, 
        desanitize, 
        markAsRead,  unreadRooms, 
        formatMessageData, updateLocalMessage
    } = useUser();
    
    // ---------------------------------------------------------------------------------------------
    // STATES & REFS
    // ---------------------------------------------------------------------------------------------
    const [message, setMessage] = useState('');
    const [typingUsers, setTypingUsers] = useState({});
    const [spamWarning, setSpamWarning] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [editingMessage, setEditingMessage] = useState(null);

    const lastSentRef = useRef(0);
    const spamTimeoutRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    const pulseAnim = useRef(new Animated.Value(0)).current; // Start at mid-glow
    const animationRef = useRef(null);

    // ---------------------------------------------------------------------------------------------
    // DERIVED CONSTANTS
    // ---------------------------------------------------------------------------------------------
    const COOLDOWN_MS = 500; // 0.5 seconds between messages
    const currentChatRoomID = isDirectMessage ? DMroomID : sessionID;

    const hasUnreadDMs = unreadRooms.some(id => id.includes('_'));
    const hasUnreadGroup = unreadRooms.includes(sessionID);

    // ---------------------------------------------------------------------------------------------
    // NAVIGATION & SYSTEM HANDLERS
    // ---------------------------------------------------------------------------------------------
    // --- ANDROID BACK BUTTON ---
    const onLeaveChat = useCallback(() => {
        if (isDirectMessage) {
            navigation.navigate('Chat', { isDirectMessage: false });
        } else {
            navigation.navigate('Map');
        }
        return true;
    }, [isDirectMessage, navigation]);
    useSessionBackHandler(onLeaveChat);

    // --- SWIPING BACK ----
    useEffect(() => {
        // Get the parent (The Stack Navigator)
        const parentNav = navigation.getParent();
        if (!parentNav) return;

        const unsubscribe = parentNav.addListener('beforeRemove', (e) => {
            console.log("Parent swipe intercepted: Staying in Chat tab");

            // If we're not in a DM, let it go back to the Map
            if (!isDirectMessage) return;

            // 1. Block the exit to Map
            e.preventDefault();

            // 2. Just change our local state/params
            navigation.setParams({
                isDirectMessage: false,
                DMroomID: null,
            });

            console.log("Parent swipe intercepted: Staying in Chat tab");
        });

        return unsubscribe;
    }, [navigation, isDirectMessage]);

    // ---------------------------------------------------------------------------------------------
    // INTERNAL LOGIC HELPERS (private)
    // ---------------------------------------------------------------------------------------------
    // --- CREATE & STORE INITIAL MESSAGE LOCALLY ---
    const addLocalMessage = (chatRoomID, text) => {
        const msgID = Crypto.randomUUID();
        
        
        const localMessageData = {
            chatRoomID,
            msgID,
            senderUUID: userUUID,
            context: { text },
            timestamp: Date.now(), // Local timestamp for immediate sorting
        };

        const messageData = formatMessageData(localMessageData, 'pending');


        // Optimistic UI update
        // update local state so sender sees message instantly
        setAllMessages(prev => ({
            ...prev,
            [chatRoomID]: [messageData, ...(prev[chatRoomID] || [])]
        }));

        return msgID; // Return this so the caller can update it later
    };

    // --- TYPING STATUS HELPER ---
    const setTypingStatus = (status, chatRoomID) => {
        // don't do anything if nothing has changed
        if (isTypingRef.current === status) return;

        isTypingRef.current = status;
        setIsTyping(status);

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
    const handleEditMessage = async (msgID, newText) => {
        const chatRoomID = currentChatRoomID;
        try {
            await editMessageAction(msgID, chatRoomID, newText);
            
            updateLocalMessage(chatRoomID, msgID, {
                isEdited: true,
                newText: newText.trim(),
            });
        } catch (err) {
            console.log("[EDIT MSG] Error: ", err.message);
            Alert.alert("Error", "Could not edit message.");
        }
    };

    // --- DELETE HANLDER  ---    
    const handleDeleteMessage = async (msgID) => {
        const chatRoomID = currentChatRoomID;
        try {
            await deleteMessageAction(msgID, chatRoomID);

            updateLocalMessage(chatRoomID, msgID, {
                isDeleted: true,
                newText: `${name} removed this message.`
            });
        } catch (err) {
            console.log("[DELETE MSG] Error: ", err.message);
            Alert.alert("Error", "Could not delete message.");
        }
    };

    // --- SEND MESSAGE ---
    const sendMessage = async (retryText = null) => {
        const chatRoomID = currentChatRoomID; // if DM: Auuid_Buuid, if general: sessionID
        const textToSend = (retryText !== null ? retryText : message).trim();
        if (textToSend.length === 0) return;
        
        // clear inputs and typing indicator only if not a retry
        if (retryText === null) {
            setMessage('');
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            setTypingStatus(false, chatRoomID)
        }

        // if user is spamming, block sendMessage and send alert to user
        if(!handleSpam()) return;

        // generate messageID, create and send message data locally 
        const msgID = addLocalMessage(chatRoomID, textToSend);

        const outboundData = {
            msgID,
            chatRoomID,
            context: { text: textToSend }
        };

        // send message out, wait for response to update localMesssageData status
        try {
            const response = await sendMessageAction(outboundData);
            // if successfully emitted, update status to 'sent'
            updateLocalMessage(chatRoomID, msgID, { 
                status: 'sent', 
                serverTimestamp: response.serverTimestamp || Date.now()
            });
        } catch (err) {
            // if failed to send, update status to 'failed'
            console.error("[SEND] failed: ", err.message);
            try {
                updateLocalMessage(chatRoomID, msgID, { status: 'failed' });
            } catch (storageErr) {
                console.error("[STATUS] update failed: ", storageErr.message);
            }
        }
    };

    
    // --- RESEND FAILED MESSAGE ---
    const resendMessage = async (failedMsg) => {
        const chatRoomID = currentChatRoomID;

        if(!handleSpam()) return;
        
        try {
            // set status to pending again
            updateLocalMessage(chatRoomID, failedMsg.msgID, { status: 'pending' });

            const response = await sendMessageAction({
                msgID: failedMsg.msgID,
                chatRoomID,
                context: { text: failedMsg.context.text }
            });

            updateLocalMessage(chatRoomID, failedMsg.msgID, {
                status: 'sent',
                serverTimestamp: response.serverTimestamp || Date.now()
            });
        } catch (err) {
            console.error("Resend failed: ", err.message);
            try{
                updateLocalMessage(chatRoomID, failedMsg.msgID, { status: 'failed' });
            } catch (storageErr) {
                console.error("[STATUS] update failed: ", storageErr.message);
            }
        }
    };

    // ---------------------------------------------------------------------------------------------
    // UI EVENT HANDLERS (called directly by components)
    // ---------------------------------------------------------------------------------------------   
    // --- TYPING INDICATOR EMITTED ---
    // called in onTextChange for textInput
    const handleTextChange = (text) => {
        setMessage(text);
        const chatRoomID = currentChatRoomID;
        // clear inactivity timer
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        // if input is cleared, remove the typing indicator
        if (text.trim().length === 0) {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            setTypingStatus(false, chatRoomID);
            return;
        }
        // if user was not typing before and now the textinput changes, they must now be typing
        // show typing indicator
        setTypingStatus(true, chatRoomID);

        // always reset inactivity timer when the textinput changes
        typingTimeoutRef.current = setTimeout(() => {
            setTypingStatus(false, chatRoomID);
        }, 2000);
    };

    // --- CANCEL EDIT ---
    // called in the 'cancel' button in the UI
    const cancelEditing = () => {
        Keyboard.dismiss();
        setEditingMessage(null);
        setMessage('');
    };

    // --- SAVE EDIT ---
    // called in the 'send' button in the UI
    const saveEdit = () => {
        if (!editingMessage) return;

        if (message.trim().length > 0 && message.trim() !== editingMessage.context.text) {
            handleEditMessage(editingMessage.msgID, message.trim());
        }
        Keyboard.dismiss();
        setEditingMessage(null);
        setMessage('');
    };

    // ----------------- ACTION MENU HELPER FUNCTIONS -----------------------
    // --- START EDIT ---
    // called after confirming edit alert
    const startEditing = (item) => {
        setEditingMessage(item);
        setMessage(item.context.text);
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
                    onPress: () => handleDeleteMessage(item.msgID) 
                }
            ]
        );
    };

    // --- SHOW EDIT/DELETE OPTIONS (show the action menu) ---
    const handleMessageLongPress = (item, canEdit) => {
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
    // clears when navigating to room with unread messages/in the room as they come in
    useEffect(() => {
        if (isFocused && currentChatRoomID) {
            markAsRead(currentChatRoomID);
        }
        return () => markAsRead(null);
    }, [currentChatRoomID, markAsRead, isFocused, unreadRooms.length]);

    // animated pulsing unread messages button
    useEffect(() => {
        let animationActive = true;

        const startAnimation = () => {
            // if animationRef already exists, the loop is running, do not call setValue(0) or stop the flow
            if (animationRef.current) return;

            pulseAnim.setValue(0);
            // define the starting and looping pulses
            const intro = Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: false });
            const loop = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1, duration: 10, useNativeDriver: false }),
                    Animated.timing(pulseAnim, { toValue: 0.4, duration: 3000, useNativeDriver: false }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: false }),
                ])
            );

            const fullSequence = Animated.sequence([intro, loop]);
            animationRef.current = fullSequence;
            fullSequence.start();

        };

        const anyUnreads = hasUnreadDMs || (isDirectMessage && hasUnreadGroup) || newMsgBelow;

        if (anyUnreads && isFocused) {
            requestAnimationFrame(() =>{
                if (animationActive) startAnimation();
            });
        } else {
            if (animationRef.current) {
                animationRef.current.stop();
                animationRef.current = null;
            }
            pulseAnim.setValue(0);
        }

        return () => {
            animationActive = false;
            if (animationRef.current) {
                animationRef.current.stop();
                animationRef.current = null;
            }
            pulseAnim.setValue(0);
        };
    }, [hasUnreadDMs, hasUnreadGroup, isFocused, isSidebarVisible, newMsgBelow]);

    // --- TYPING INDICATOR/EDITED & DELETED MESSAGES ---
    // listens for 'user-typing' and 'user-stop-typing' events
    // listens for messages edited or deleted by other users
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
            }
        };
    }, [socket, currentChatRoomID]);


    // ---------------------------------------------------------------------------------------------
    // PUBLIC API
    // ---------------------------------------------------------------------------------------------   
    return {
        message, setMessage,
        editingMessage, setEditingMessage,
        messages: allMessages[currentChatRoomID] || [], 
        sendMessage, resendMessage,
        typingUsers, spamWarning,
        handleTextChange,
        cancelEditing, saveEdit, startEditing, 
        confirmDeletion,
        handleMessageLongPress,
        sessionID, userUUID,
        unreadRooms,
        currentChatRoomID,
        pulseAnim, 
        hasUnreadDMs, hasUnreadGroup
    };
};