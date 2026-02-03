import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { View, Text, Pressable, TextInput, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { useHeaderHeight } from '@react-navigation/elements';
import { useUser } from '../UserContext';
import { styles } from '../styles';
import { useSessionBackHandler } from '../hooks/useSessionBackHandler';
import { useIsFocused } from '@react-navigation/native';

export default function ChatScreen({ navigation, route }) {
    const { socket, sessionId, name, selectedColor, secureEmit, sessionUsers, 
        allMessages, setAllMessages, userUUID, onLeave, unreadRooms, markAsRead, friends } = useUser();
    const [message, setMessage] = useState('');
    const [isSidebarVisible, setIsSidebarVisible] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [typingUsers, setTypingUsers] = useState({});
    
    const { isDirectMessage, dmRoomID, recipientName } = route.params || {};

    const currentRoomID = isDirectMessage ? dmRoomID : sessionId;
    const messages = allMessages[currentRoomID] || [];
    const reverseMessages = React.useMemo(() => [...messages].reverse(), [messages]);

    const flatListRef = useRef();
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    const headerHeight = useHeaderHeight();
    const isFocused = useIsFocused();

    // take care of android "back" button
    useSessionBackHandler(onLeave);

    // ensures server puts us in DM room so we can hear 'user-typing'
    useEffect(() => {
        if (isDirectMessage && dmRoomID) {
            secureEmit('join-dm', { dmRoomID, targetName: recipientName });
        } 
    }, [isDirectMessage, dmRoomID]);

    // typing indicators
    useEffect(() => {
        if (!socket) return;

        const handleTyping = ( data ) => {
            if (data.roomID === currentRoomID) {
                setTypingUsers(prev => ({ ...prev, [data.id]: data.name }));
            }
        };

        const handleStopTyping = ( data ) => {
            setTypingUsers(prev => {
                const newState = { ...prev };
                delete newState[data.id]; // remove user from "typing" list
                return newState;
            });
        };

        socket.on('user-typing', handleTyping);
        socket.on('user-stop-typing', handleStopTyping);

        return () => {
            socket.off('user-typing', handleTyping);
            socket.off('user-stop-typing', handleStopTyping);
            // clena local "typing" states
            setTypingUsers({});

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            if (isTypingRef.current) {
                secureEmit('stop-typing', { roomID: currentRoomID });
            }
        };
    }, [socket, currentRoomID]);
            
    // clear unread status of general chat as soon as navigating to chat
    // also clear if new messages arrive while on screen
    useEffect(() => {
        markAsRead( isFocused ? currentRoomID : null);
        return () => markAsRead(null);
    }, [currentRoomID, markAsRead, isFocused]);

    // generate a UUID
    const generateUUID = () => {
        // Check if we are in a browser that supports crypto
        if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
            return window.crypto.randomUUID();
        }
        // Fallback for React Native
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    };

    // --- SEND MESSAGE FUNCTION ---
    const sendMessage = (retryText = null) => {
        const roomAtTimeOfSend = currentRoomID;
        const textToSend = retryText !== null ? retryText : message;

        if (textToSend.trim().length > 0) { // don't send empty messages
            const messageId = generateUUID();
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

            if (isDirectMessage) {
                const recipientUUID = dmRoomID.split('_').find(id => id !== userUUID);
                // the information sent out
                secureEmit('send-direct-message', {
                    id: messageId,
                    recipientUUID,
                    context: messageData.context,
                });
            } else {
                secureEmit('send-message', {
                    id: messageId,
                    roomID: sessionId,
                    context: messageData.context},
                );
            }

            // update local state so sender sees message instantly
            setAllMessages((prevMessages) => ({
                ...prevMessages,
                [currentRoomID]: [...(prevMessages[currentRoomID] || []), messageData]
            }));

            //  clear inputs and typing indicator only if not a retry
            if (retryText === null) {
                setMessage('');
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                secureEmit('stop-typing', { roomID: currentRoomID });
                setIsTyping(false);
            }

            // set timer so messages not sent are flagged as failed after ten seconds
            setTimeout(() => {
                setAllMessages(prev => {
                    const roomMsgs = prev[roomAtTimeOfSend] || [];
                    return {
                        ...prev,
                        [roomAtTimeOfSend]: roomMsgs.map(m => 
                            // If it's still pending after 10s, it failed
                            (m.id === messageId && m.status === 'pending') 
                            ? { ...m, status: 'failed' } 
                            : m
                        )
                    };
                });
            }, 10000);
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

    // --- START PRIVATE CHAT ---
    const startPrivateChat = (targetUser) => {
        setIsSidebarVisible(false);
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

    const handleTextChange = (text) => {
        setMessage(text);

        if (!isTyping) {
            setIsTyping(true);
            isTypingRef.current = true;
            secureEmit('typing', { roomID: currentRoomID, name: name });
        }
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        typingTimeoutRef.current = setTimeout(() => {
            secureEmit('stop-typing', { roomID: currentRoomID });
            setIsTyping(false);
        }, 2000);
    };
        
    // --- LAYOUT ---
    return (
        <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
            {/* --- HEADER --- */}
            <View style={[ styles.customHeader, { zIndex: 999 }]}>
                {/* back to group chat button */}
                <View style={{ flex: 1, alignItems: 'flex-start', justifyContent: 'center' }}>
                    {isDirectMessage && (
                    <Pressable
                        onPress={() => {navigation.navigate('Chat')}}
                        style={({ pressed }) => [
                            styles.headerButton,
                            { backgroundColor: pressed ? '#007aff15' : '#ffffff', 
                                borderColor: '#00000008', 
                                paddingLeft: 8,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 }, // Shadow pushes down
                                shadowOpacity: 0.1,
                                shadowRadius: 5,
                                // Android Shadow
                                elevation: 8, // Higher number = higher "lift"
                            }
                        ]}>
                            <Text style={{ color: '#007aff', fontSize: 25, fontWeight: '400', marginRight: 2 }}>❮ </Text>
                            <Text style={{ color: '#000', fontSize: 17, fontWeight: '600' }}>Group</Text>
                            {unreadRooms.includes(sessionId) && <View style={ styles.unreadDotOverlap } />}
                    </Pressable>
                    )}
                </View>
                
                {/* chat label */}
                <View style={styles.absoluteHeaderTitle}>
                    <Text 
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.5}
                        style={[styles.headerTitleText, { fontSize: isDirectMessage ? 20 : 25 }]}>
                            {isDirectMessage ? `${recipientName}` : 'Group Chat'}
                    </Text>
                </View>

                <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                    {/* direct message button */}
                    <Pressable 
                        onPress={() => setIsSidebarVisible(true)}  // () => means do this only when button is pressed
                        style={({ pressed }) => [
                            styles.headerButton,
                            { backgroundColor: pressed ? '#007aff15' : '#ffffff', 
                                paddingHorizontal: 10,
                                borderColor: '#00000008',
                                minWidth: 40,
                                paddingRight: 5,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 }, // Shadow pushes down
                                shadowOpacity: 0.1,
                                shadowRadius: 5,
                                // Android Shadow
                                elevation: 8, // Higher number = higher "lift" 
                            }
                        ]}>
                            <Text style={{ color: '#000000', fontSize: 30, lineHeight: 30 }}>☰ </Text>
                        {unreadRooms.some(id => id.includes('_')) && (
                            <View style={ styles.unreadDotOverlap } />)}
                    </Pressable>
                </View>
            </View>
            {/* end of header */}
            
            {/* start of content */}
            <View style={[styles.contentWrapper, { paddingHorizontal: 0, alignItems: 'stretch' }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 110 : 0}
                style={{ flex: 1, backgroundColor: '#f5f5f5' }}
            >

                {/* --- MESSAGE LIST --- */}
                <View style={{ flex: 1 }}>
                    <FlatList
                        ref={flatListRef}
                        data={reverseMessages}
                        inverted
                        keyExtractor={(item) => item.id}      
                        contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 15 }}
                        onContentSizeChange={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}                  
                        removeClippedSubviews={Platform.OS === 'ios'}
                        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                        renderItem={({ item }) => {
                            const isFailed = item.status === 'failed';
                            const isPending = item.status === 'pending';

                            return (
                                <View style={[
                                    styles.messageBubble,
                                    item.senderUUID === userUUID ? styles.myMessage : styles.theirMessage,
                                    isFailed && { opacity: 0.7, borderColor: 'red', borderWidth: 1 }
                                ]}>
                                    <Text style={{ fontWeight: 'bold', color: item.color, fontSize: 12 }}>
                                        {item.sender} • { item.serverTimestamp
                                            ? new Date(item.serverTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                            : (item.senderUUID === userUUID) ? (isFailed ? "Failed" : "Sending...") : "Just now" }
                                    </Text>
                                    <Text style={{ fontSize: 16, marginTop: 5 }}>{item.context.text}</Text>
                                    {isFailed && (
                                        <Pressable onPress={() => resendMessage(item)}>
                                            <Text style={{ color: 'red', fontWeight: 'bold', marginTop: 5 }}>Retry?</Text>
                                        </Pressable>
                                    )}
                                </View>
                            );
                        }}
                    />

                    {/* --- TYPING INDICATOR --- */}
                    <View style={{ height: 25, paddingHorizontal: 20, justifyContent: 'center' }}>
                        {Object.values(typingUsers).length > 0 && (
                            <Text style={{ fontStyle: 'italic', color: '#888', fontSize: 12 }}>
                                {Object.values(typingUsers).join(', ')} {Object.values(typingUsers).length > 1 ? 'are' : 'is'} typing...
                            </Text>
                        )}
                    </View>

                    {/* --- INPUT BOX --- */}
                    <View style={styles.messageInputContainer}>
                        <TextInput
                            style={styles.messageInput}
                            placeholder="Type a message..."
                            value={message}
                            onChangeText={handleTextChange}
                            onSubmitEditing={() => sendMessage()}
                            returnKeyType="send"
                            placeholderTextColor="#838181"
                            blurOnSubmit={false}
                        />
                        <Pressable onPress={() => sendMessage()} style={styles.sendButton}>
                            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 18 }}>Send</Text>
                        </Pressable>
                    </View>
                </View>
                {/* end of messaging view */}
            </KeyboardAvoidingView>
            </View>
            {/* end of content wrapper */}
        
            {/* --- SIDEBAR FOR USER LIST --- */}
            <Modal
                isVisible={isSidebarVisible}
                onBackdropPress={() => setIsSidebarVisible(false)}
                onBackButtonPress={() => setIsSidebarVisible(false)}
                onSwipeComplete={() => setIsSidebarVisible(false)}
                swipeDirection="right"
                animationIn="slideInRight"
                animationOut="slideOutRight"
                animationOutTiming={300}
                hideModalContentWhileAnimating={true}
                swipeThreshold={50}
                useNativeDriver={true}
                useNativeDriverForBackdrop={true}
                backdropTransitionOutTiming={0}
                backdropColor='#f5f5f5'
                style={{ margin: 0, justifyContent: 'flex-end', flexDirection: 'row' }}
                backdropOpacity={0.3}
            >
                <View style={styles.sidebarContainer}>
                    <View style={styles.sidebarHeader}>
                        <Text style={styles.sidebarTitle}>Direct Messages</Text>
                        <Pressable onPress={() => setIsSidebarVisible(false)}>
                            <Text style={{ fontSize: 24, fontWeight: 'bold', padding: 10 }}>✕</Text>
                        </Pressable>
                    </View>
                    <FlatList
                        data={friends} // exclude self from user list
                        keyExtractor={(item) => item.id}
                        ListEmptyComponent={() => (
                            <View style={{ marginTop: 20, alignItems: 'center' }}>
                                <Text style={{ color: '#999', fontStyle: 'italic' }}>
                                    No other users online right now.
                                </Text>
                            </View>
                        )}
                        renderItem={({ item }) => {
                            const itemDmRoomId = [userUUID, item.id].sort().join('_');
                            const isUnread = unreadRooms.includes(itemDmRoomId);

                            return (
                                <Pressable
                                    onPress={() => startPrivateChat(item)}
                                    style={[
                                        styles.userItem,
                                        {
                                            borderLeftWidth: 4,
                                            borderLeftColor: isUnread ? item.color : 'transparent',
                                            backgroundColor: isUnread ? item.color + '20' : 'transparent',
                                        }
                                    ]}
                                >
                                    <View style={[styles.userDot, { backgroundColor: item.color, marginLeft: 5 }]} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.userName, isUnread && { fontWeight: 'bold' }]}>{item.name}</Text>
                                    </View>
                                    {isUnread ? (<Text style={{ color: item.color, fontWeight: 'bold', fontSize: 15}}>NEW   </Text>) :
                                    (<Text style={{color: '#999'}}>Chat ➔</Text>)}
                                </Pressable>
                            );
                        }}
                    />
                </View>
            </Modal>
        </View>
    );
}