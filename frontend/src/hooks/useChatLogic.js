// hooks/useChatLogic.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Keyboard } from 'react-native';
import * as Crypto from 'expo-crypto';

import { useUser } from '../context/UserContext';
import { useSessionBackHandler } from './useSessionBackHandler';
import { sendMessageAction, editMessageAction, deleteMessageAction, typingAction, stopTypingAction } from '../services/socketServices';

export const useChatLogic = ({ isDirectMessage, DMroomID, navigation, isFocused }) => {
    // ---------------------------------------------------------------------------------------------
    // DATA & CONTEXT
    // ---------------------------------------------------------------------------------------------
    const { 
        sessionId, socket,
        name, userUUID, 
        allMessages, setAllMessages, 
        desanitize, 
        markAsRead,  unreadRooms 
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

    // ---------------------------------------------------------------------------------------------
    // DERIVED CONSTANTS
    // ---------------------------------------------------------------------------------------------
    const COOLDOWN_MS = 500; // 0.5 seconds between messages
    const currentRoomID = isDirectMessage ? DMroomID : sessionId;

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

    // ---------------------------------------------------------------------------------------------
    // INTERNAL LOGIC HELPERS (private)
    // ---------------------------------------------------------------------------------------------
    // --- CREATE & STORE INITIAL MESSAGE LOCALLY ---
    const addLocalMessage = (roomID, text) => {
        const msgID = Crypto.randomUUID();
        
        const localMessageData = {
            msgID,
            roomID,
            context: { 
                text, 
                isEncrypted: false, 
                version: "1.0" 
            },
            senderUUID: userUUID,
            senderName: name, 
            status: 'pending',
            timestamp: Date.now() // Local timestamp for immediate sorting
        };

        // Optimistic UI update
        // update local state so sender sees message instantly
        setAllMessages(prev => ({
            ...prev,
            [roomID]: [localMessageData, ...(prev[roomID] || [])]
        }));

        return msgID; // Return this so the caller can update it later
    };
    
    // --- UPDATE LOCAL MESSAGE DATA ---
    const updateLocalMessage = (targetRoomID, msgID, updates) => {
        setAllMessages(prev => {
            const roomToUpdate = targetRoomID || currentRoomID;
            const roomMsgs = prev[roomToUpdate] || [];
            // filter through messages based on roomID and find the one with matching msgID
            return {
                ...prev,
                [roomToUpdate]: roomMsgs.map(m => {
                    if (m.msgID === msgID) {
                        // append updates, and if new text, update the context: text
                        const { newText, ...otherUpdates } = updates;
                        const updatedMsg = { ...m, ...otherUpdates };
                        if (newText !== undefined) updatedMsg.context = { ...m.context, text: newText };
                        return updatedMsg;
                    }
                    return m;
                })
            };
        });
    };

    // --- TYPING STATUS HELPER ---
    const setTypingStatus = (status, roomID) => {
        // don't do anything if nothing has changed
        if (isTypingRef.current === status) return;

        isTypingRef.current = status;
        setIsTyping(status);

        if (status) {
            typingAction(roomID);
        } else {
            stopTypingAction(roomID);
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
        const roomID = currentRoomID;
        try {
            await editMessageAction(msgID, roomID, newText);
            
            updateLocalMessage(roomID, msgID, {
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
        const roomID = currentRoomID;
        try {
            await deleteMessageAction(msgID, roomID);

            updateLocalMessage(roomID, msgID, {
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
        const roomID = currentRoomID; // if DM: Auuid_Buuid, if general: sessionId
        const textToSend = (retryText !== null ? retryText : message).trim();
        if (textToSend.length === 0) return;
        
        // clear inputs and typing indicator only if not a retry
        if (retryText === null) {
            setMessage('');
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            setTypingStatus(false, roomID)
        }

        // if user is spamming, block sendMessage and send alert to user
        if(!handleSpam()) return;

        // generate messageID, create and send message data locally 
        const msgID = addLocalMessage(roomID, textToSend);

        const outboundData = {
            msgID,
            roomID,
            context: { text: textToSend }
        };

        // send message out, wait for response to update localMesssageData status
        try {
            const response = await sendMessageAction(outboundData);
            // if successfully emitted, update status to 'sent'
            updateLocalMessage(roomID, msgID, { 
                status: 'sent', 
                serverTimestamp: response.serverTimestamp || Date.now()
            });
        } catch (err) {
            // if failed to send, update status to 'failed'
            console.error("Send failed: ", err.message);
            updateLocalMessage(roomID, msgID, { status: 'failed' });
        }
    };

    
    // --- RESEND FAILED MESSAGE ---
    const resendMessage = async (failedMsg) => {
        const roomID = currentRoomID;

        if(!handleSpam()) return;

        // set status to pending again
        updateLocalMessage(roomID, failedMsg.msgID, { status: 'pending' });
        
        try {
            const response = await sendMessageAction({
                msgID: failedMsg.msgID,
                roomID,
                context: { text: failedMsg.context.text }
            });

            updateLocalMessage(roomID, failedMsg.msgID, {
                status: 'sent',
                serverTimestamp: response.serverTimestamp || Date.now()
            });
        } catch (err) {
            updateLocalMessage(roomID, failedMsg.msgID, { status: 'failed' });
        }
    };

    // ---------------------------------------------------------------------------------------------
    // UI EVENT HANDLERS (called directly by components)
    // ---------------------------------------------------------------------------------------------   
    // --- TYPING INDICATOR EMITTED ---
    // called in onTextChange for textInput
    const handleTextChange = (text) => {
        setMessage(text);
        const roomID = currentRoomID;
        // clear inactivity timer
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        // if input is cleared, remove the typing indicator
        if (text.trim().length === 0) {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            setTypingStatus(false, roomID);
            return;
        }
        // if user was not typing before and now the textinput changes, they must now be typing
        // show typing indicator
        setTypingStatus(true, roomID);

        // always reset inactivity timer when the textinput changes
        typingTimeoutRef.current = setTimeout(() => {
            setTypingStatus(false, roomID);
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
            Alert.alert("Message Options", "Choose an action for this message.", [
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
        markAsRead( isFocused ? currentRoomID : null);
        return () => markAsRead(null);
    }, [currentRoomID, markAsRead, isFocused]);

    // --- TYPING INDICATOR/EDITED & DELETED MESSAGES ---
    // listens for 'user-typing' and 'user-stop-typing' events
    // listens for messages edited or deleted by other users
    useEffect(() => {
        if (!socket) return;

        const handleTyping = ( data ) => {
            if (data.roomID === currentRoomID) {
                setTypingUsers(prev => ({ ...prev, [data.senderUUID]: desanitize(data.senderName) }));
            }
        };

        const handleStopTyping = ( data ) => {
            setTypingUsers(prev => {
                const newState = { ...prev };
                delete newState[data.senderUUID]; // remove user from "typing" list
                return newState;
            });
        };

        socket.on('user-typing', handleTyping);
        socket.on('user-stop-typing', handleStopTyping);

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
                stopTypingAction(currentRoomID);
            }
        };
    }, [socket, currentRoomID]);

    // ---------------------------------------------------------------------------------------------
    // PUBLIC API
    // ---------------------------------------------------------------------------------------------   
    return {
        message, setMessage,
        editingMessage, setEditingMessage,
        messages: allMessages[currentRoomID] || [], 
        sendMessage, resendMessage,
        typingUsers, spamWarning,
        handleTextChange,
        cancelEditing, saveEdit, startEditing, 
        confirmDeletion,
        handleMessageLongPress,
        sessionId, userUUID,
        unreadRooms,
        currentRoomID
    };
};