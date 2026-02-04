// hooks/useChatLogic.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Keyboard } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useUser } from '../UserContext';

export const useChatLogic = ({ currentRoomID, isDirectMessage, dmRoomID, recipientName, navigation, sessionId, isFocused }) => {
    const { socket, name, selectedColor, secureEmit, setAllMessages, userUUID, desanitize, markAsRead } = useUser();
    
    const [message, setMessage] = useState('');
    const [typingUsers, setTypingUsers] = useState({});
    const [spamWarning, setSpamWarning] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [editingMessage, setEditingMessage] = useState(null);

    // Refs for internal logic
    const lastSentRef = useRef(0);
    const spamTimeoutRef = useRef(null);
    const pendingTimersRef = useRef({}); // stores {messageId: timeoutId} pairs for pending messages
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    const COOLDOWN_MS = 500; // 0.5 seconds between messages


    // --- UPDATE LOCAL MESSAGE FUNCTION ---
    const updateLocalMessage = (targetRoomID, messageId, updates) => {
        setAllMessages(prev => {
            const roomToUpdate = targetRoomID || currentRoomID;
            const roomMsgs = prev[roomToUpdate] || [];
            return {
                ...prev,
                [roomToUpdate]: roomMsgs.map(m => {
                    if (m.id === messageId) {
                        const updatedMsg = { ...m, ...updates };
                        // if new text, update the context 
                        if (updates.newText !== undefined) {
                            updatedMsg.context = {
                                ...m.context,
                                text: updates.newText
                            };
                        }
                        return updatedMsg;
                    }
                    return m;
                })
            };
        });
    };

    // --- EDIT & DELETE HANLDER FUNCTIONS ---    
    const handleEditMessage = (messageId, newText) => {
        secureEmit('edit-message', {
            roomID: currentRoomID,
            messageID: messageId,
            newText: newText,
        });

        updateLocalMessage(currentRoomID, messageId, {
            isEdited: true,
            newText: newText.trim(),
        });
    };

    const handleDeleteMessage = (messageId) => {
        secureEmit('delete-message', {
            roomID: currentRoomID,
            messageID: messageId,
            userName: name
        });

        updateLocalMessage(currentRoomID, messageId, {
            isDeleted: true,
            newText: `${name} removed this message.`
        });
    };

    // --- EDITING HELPERS CALLED IN THE UI ---
    // only called in the 'cancel' button in the UI
    // resets editing status by setting editingMessage to null
    const cancelEditing = () => {
        Keyboard.dismiss();
        setEditingMessage(null);
        setMessage('');
    };

    // only called in the 'send' button in the UI
    // calls the edit handler
    const saveEdit = () => {
        if (!editingMessage) return;

        if (message.trim().length > 0 && message.trim() !== editingMessage.context.text) {
            handleEditMessage(editingMessage.id, message.trim());
        }
        Keyboard.dismiss();
        setEditingMessage(null);
        setMessage('');
    };

    // --- ACTION MENU HELPER FUNCTIONS ---
    // begins editing process after confirming alert
    // puts old text back in input to edit
    // sets editing status to true by setting editingMessage
    const startEditing = (item) => {
        setEditingMessage(item);
        setMessage(item.context.text);
    };

    // begins deletion process after confirming alert
    // calls deletion handler
    const confirmDeletion = (item) => {
        Alert.alert(
            "Confirm Deletion",
            "Are you sure you want to delete this message? This action cannot be undone.",
            [
                {   text: "Cancel", style: "cancel" },
                {   text: "Delete", 
                    style: "destructive",
                    onPress: () => handleDeleteMessage(item.id) 
                }
            ]
        );
    };

    const handleMessageLongPress = (item, canEdit) => {
        if (canEdit) {
            Alert.alert("Message Options", "Choose an action for this message.", [
                { text: "Edit", onPress: () => startEditing(item) },
                { text: "Delete", style: "destructive", onPress: () => confirmDeletion(item) },
                { text: "Cancel", style: "cancel" }
            ]);
        }
    };

    // --- SEND MESSAGE FUNCTION ---
    const sendMessage = (retryText = null) => {
        const roomAtTimeOfSend = currentRoomID;
        const textToSend = retryText !== null ? retryText : message;

        // prevents user from spamming chat
        const now = Date.now();
        if (now - lastSentRef.current < COOLDOWN_MS) {
            setSpamWarning("Slow down! Wait a second...");
            console.log(`User ${name} is sending messages too quickly. Message not sent.`);
            // clear existing timer if they're tapping fast
            if (spamTimeoutRef.current) clearTimeout(spamTimeoutRef.current);
            // hide message after two seconds
            spamTimeoutRef.current = setTimeout(() => {
                setSpamWarning('');
            }, 2000);

            return;
        }

        // reset reference time & clear spam warning
        lastSentRef.current = now;
        setSpamWarning('');
        if (spamTimeoutRef.current) {
            clearTimeout(spamTimeoutRef.current);
            spamTimeoutRef.current = null;
        }

        if (textToSend.trim().length > 0) { // don't send empty messages
            // clear out spam warning
            const messageId = Crypto.randomUUID();
            // the information stored locally
            const messageData = {
                id: messageId,
                roomID: currentRoomID,
                sender: name,
                context: {
                    text: textToSend.trim(),
                    isEncrypted: false,
                    version: "1.0"
                },
                color: selectedColor,
                senderUUID: userUUID, // to identify own messages
                isDM: !!isDirectMessage,
                status: 'pending'
            };

            const outboundData = {
                id: messageId,
                roomID: isDirectMessage ? undefined : sessionId,
                recipientUUID: isDirectMessage ? dmRoomID.split('_').find(id => id !== userUUID) : undefined,
                context: { text: textToSend.trim() }
            };

            // update local state so sender sees message instantly
            setAllMessages((prevMessages) => ({
                ...prevMessages,
                [currentRoomID]: [messageData, ...(prevMessages[currentRoomID] || [])]
            }));

            const updateMessageStatus = (id, roomID, status, extraData = {}) => {
                setAllMessages(prev => {
                    const roomMsgs = prev[roomID] || [];
                    return {
                        ...prev,
                        [roomID]: roomMsgs.map(m => {
                            if (m.id === id) {
                                if (status == 'failed' && m.status !== 'pending') {
                                    return m;
                                }
                                return { ...m, ...extraData, status};
                            }
                            return m;
                        })
                    };
                });
            };

            const handleAcknowledgment = (response) => {
                if (response?.success) {
                    // stop failure timer
                    if (pendingTimersRef.current[messageId]) { 
                        clearTimeout(pendingTimersRef.current[messageId]);
                        delete pendingTimersRef.current[messageId];
                    }
                    const finalTimestamp = response.serverTimestamp || Date.now();
                    // update message status to 'sent', use timestamp from server if provided
                    updateMessageStatus(messageId, roomAtTimeOfSend, 'sent', { serverTimestamp: finalTimestamp });
                } else {
                    // update message status to 'failed'
                    updateMessageStatus(messageId, roomAtTimeOfSend, 'failed');
                    console.log("Message failed to send:", response?.message || "Unknown error");
                }
            }

            if (isDirectMessage) {
                secureEmit('send-direct-message', outboundData, handleAcknowledgment);
            } else {
                secureEmit('send-message', outboundData, handleAcknowledgment);
            }

            //  clear inputs and typing indicator only if not a retry
            if (retryText === null) {
                setMessage('');
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                secureEmit('stop-typing', { roomID: currentRoomID });
                setIsTyping(false);
                isTypingRef.current = false;
            }

            // set timer so messages not sent are flagged as failed after ten seconds,
            const timeoutId = setTimeout(() => {
                updateMessageStatus(messageId, roomAtTimeOfSend, 'failed');
                delete pendingTimersRef.current[messageId];
            }, 10000);
            // store them in a ref to cancel later if user leaves
            pendingTimersRef.current[messageId] = timeoutId;
        } 
    };

    // --- RESEND MESSAGE FEATURE ---
    const resendMessage = (failedMsg) => {
        // remove failed message from list
        setAllMessages(prev => ({
            ...prev,
            [currentRoomID]: prev[currentRoomID].filter(m => m.id !== failedMsg.id)
        }));
        // try again
        sendMessage(failedMsg.context.text);
    };
    
    // --- TYPING INDICATOR HANDLER ---
    const handleTextChange = (text) => {
        setMessage(text);
        if (text.trim().length === 0 && isTypingRef.current) {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            secureEmit('stop-typing', { roomID: currentRoomID });
            setIsTyping(false);
            isTypingRef.current = false;
            return;
        }

        if (!isTyping) {
            setIsTyping(true);
            isTypingRef.current = true;
            secureEmit('typing', { roomID: currentRoomID, name: name });
        }
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        typingTimeoutRef.current = setTimeout(() => {
            secureEmit('stop-typing', { roomID: currentRoomID });
            setIsTyping(false);
            isTypingRef.current = false;
        }, 2000);
    };

    // --- START PRIVATE CHAT ---
    const startPrivateChat = (targetUser, closeSidebar) => {
        closeSidebar();
        // create unique room id for both people
        const generatedDmRoomId = [userUUID, targetUser.id].sort().join('_');
        socket.emit('join-dm', { dmRoomID: generatedDmRoomId, targetName: targetUser.name });
        navigation.navigate('Chat', {
            isDirectMessage: true,
            dmRoomID: generatedDmRoomId,
            recipientName: targetUser.name,
            recipientColor: targetUser.color
        });
    };

    // ensures server puts us in DM room so we can hear 'user-typing'
    useEffect(() => {
        if (isDirectMessage && dmRoomID) {
            secureEmit('join-dm', { dmRoomID, targetName: recipientName });
        } 
    }, [isDirectMessage, dmRoomID]);

    // clear unread status of general chat as soon as navigating to chat
    // also clear if new messages arrive while on screen
    useEffect(() => {
        markAsRead( isFocused ? currentRoomID : null);
        return () => markAsRead(null);
    }, [currentRoomID, markAsRead, isFocused]);

    // listens for 'user-typing' and 'user-stop-typing' events
    // listens for messages edited or deleted by other users
    useEffect(() => {
        if (!socket) return;

        const handleTyping = ( data ) => {
            if (data.roomID === currentRoomID) {
                setTypingUsers(prev => ({ ...prev, [data.id]: desanitize(data.name) }));
            }
        };

        const handleStopTyping = ( data ) => {
            setTypingUsers(prev => {
                const newState = { ...prev };
                delete newState[data.id]; // remove user from "typing" list
                return newState;
            });
        };

        const handleDeletedByOthers = ( data ) => {  
            // if (data.roomID === currentRoomID) { 
                updateLocalMessage(data.roomID, data.messageID, {
                    isDeleted: true,
                    newText: `${data.userName} removed this message.`
                });
            // }
        };

        const handleEditedByOthers = ( data ) => {
            // if (data.roomID === currentRoomID) { 
                updateLocalMessage(data.roomID, data.messageID, { 
                    isEdited: true,
                    newText: desanitize(data.newText)  
                });
            // }
        };

        socket.on('user-typing', handleTyping);
        socket.on('user-stop-typing', handleStopTyping);
        socket.on('message-deleted', handleDeletedByOthers);
        socket.on('message-edited', handleEditedByOthers);

        return () => {
            socket.off('user-typing', handleTyping);
            socket.off('user-stop-typing', handleStopTyping);
            socket.off('message-deleted', handleDeletedByOthers);
            socket.off('message-edited', handleEditedByOthers);

            // clean local "typing" states
            setTypingUsers({});

            // clear all pending failure timers
            Object.values(pendingTimersRef.current).forEach(timeoutId => clearTimeout(timeoutId));
            pendingTimersRef.current = {};

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
                secureEmit('stop-typing', { roomID: currentRoomID });
            }
        };
    }, [socket, currentRoomID]);

    return {
        message, setMessage,
        typingUsers, spamWarning,
        editingMessage, setEditingMessage,
        sendMessage, resendMessage,
        handleTextChange,
        cancelEditing, saveEdit, startEditing, 
        confirmDeletion,
        startPrivateChat,
        handleMessageLongPress
    };
};

