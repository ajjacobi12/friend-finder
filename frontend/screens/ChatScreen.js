import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, Pressable, TextInput, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { useHeaderHeight } from '@react-navigation/elements';
import { useUser } from '../UserContext';
import { styles } from '../styles';
import { useSessionBackHandler } from '../hooks/useSessionBackHandler';

export default function ChatScreen({ navigation, route }) {
    const { isDirectMessage, dmRoomID, recipientName } = route.params || {};
    const { socket, sessionId, name, selectedColor, secureEmit, sessionUsers, 
        allMessages, setAllMessages, onLeave } = useUser();
    const [message, setMessage] = useState('');
    const [isSidebarVisible, setIsSidebarVisible] = useState(false);

    const currentRoomID = isDirectMessage ? dmRoomID : sessionId;
    const messages = allMessages[currentRoomID] || [];

    const flatListRef = useRef();
    const headerHeight = useHeaderHeight();

    const typingTimeoutRef = useRef(null);
    const [isTyping, setIsTyping] = useState(false);
    const isTypingRef = useRef(false);

    // take care of android "back" button
    useSessionBackHandler(onLeave);

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

    const [typingUsers, setTypingUsers] = useState({});
    useEffect(() => {
        if (!socket) return;
        socket.on('user-typing', ( data ) => {
            if (data.roomID === currentRoomID) {
                setTypingUsers(prev => ({ ...prev, [data.id]: data.name }));
            }
        });

        socket.on('user-stop-typing', ( data ) => {
            setTypingUsers(prev => {
                const newState = { ...prev };
                delete newState[data.id];
                return newState;
            });
        });

        return () => {
            socket.off('user-typing');
            socket.off('user-stop-typing');
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            if (isTypingRef.current) { // clean up on unmount
                secureEmit('stop-typing', { roomID: currentRoomID });
            }
            setTypingUsers({});
        };
    }, [socket, currentRoomID]);

    useEffect(() => {
        if (isDirectMessage && dmRoomID) {
            secureEmit('join-dm', { dmRoomID, targetName: recipientName });
        } 
    }, [isDirectMessage, dmRoomID]);

    // --- SEND MESSAGE FUNCTION ---
    const sendMessage = () => {
        if (message.trim().length > 0) { // don't send empty messages

            const messageData = {
                roomID: currentRoomID,
                sender: name,
                context: {
                    text: message,
                    isEncrypted: false,
                    version: "1.0"
                },
                color: selectedColor,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                senderId: socket.id, // to identify own messages
                isDM: !!isDirectMessage
            };


            if (isDirectMessage && dmRoomID) {
                const targetId = dmRoomID.split('_').find(id => id !== socket.id);

                secureEmit('send-direct-message', {
                    ...messageData,
                    recipientId: targetId,
                });
            } else {
                secureEmit('send-message', messageData);
            }

            setAllMessages((prevMessages) => ({
                ...prevMessages,
                [currentRoomID]: [...(prevMessages[currentRoomID] || []), messageData]
            }));

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            secureEmit('stop-typing', { roomID: currentRoomID });
            setIsTyping(false);

            setMessage(''); // clear input box   
        } 
    };

    // --- START PRIVATE CHAT ---
    const startPrivateChat = (targetUser) => {
        setIsSidebarVisible(false);
        // create unique room id for both people
        const generatedDmRoomId = [socket.id, targetUser.id].sort().join('_');
        socket.emit('join-dm', { dmRoomID: generatedDmRoomId, targetName: targetUser.name });
        navigation.navigate('Chat', {
            isDirectMessage: true,
            dmRoomID: generatedDmRoomId,
            recipientName: targetUser.name,
            recipientColor: targetUser.color
        });
    };
        
    // --- LAYOUT ---
    const reverseMessages = React.useMemo(() => [...messages].reverse(), [messages]);
    return (
        <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
            {/* --- HEADER --- */}
            <View style={styles.customHeader}>
                {/* back to group chat button */}
                <View style={{ flex: 1, alignItems: 'flex-start', justifyContent: 'center' }}>
                    {isDirectMessage && (
                    <Pressable
                        onPress={() => {navigation.navigate('Chat')}}
                        style={({ pressed }) => [
                            styles.headerButton,
                            { backgroundColor: '#007aff25', borderColor: '#007bff52', borderWidth: 0 }
                        ]}>
                            <Text style={{ color: 'black', fontSize: 15, textAlign: 'center', fontWeight: 'bold'}}>
                                {"❮ Group\nChat"}
                            </Text>
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
                            { backgroundColor: selectedColor + '25', borderColor: 'transparent' }
                        ]}>
                        <Text style={{ color: '#000000', fontWeight: 'bold', fontSize: 14, textAlign: 'left'}}>{"☰ Direct"}{"\n"}{"Messages"}</Text>
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
                        renderItem={({ item }) => (
                            <View style={[
                                styles.messageBubble,
                                item.senderId === socket.id ? styles.myMessage : styles.theirMessage
                            ]}>
                                <Text style={{ fontWeight: 'bold', color: item.color, fontSize: 12 }}>
                                    {item.sender} • {
                                        item.serverTimestamp
                                        ? new Date(item.serverTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                        : "Just now"
                                    }
                                </Text>
                                <Text style={{ fontSize: 16, marginTop: 5 }}>
                                    {item.context.text}
                                </Text>
                            </View>
                        )}
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
                            onSubmitEditing={sendMessage}
                            returnKeyType="send"
                            placeholderTextColor="#838181"
                            blurOnSubmit={false}
                        />
                        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
                            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 18 }}>Send</Text>
                        </TouchableOpacity>
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
                style={{ 
                    margin: 0,
                    justifyContent: 'flex-end',
                    flexDirection: 'row'
                }}
                backdropOpacity={0.3}
            >
                <View style={styles.sidebarContainer}>
                    <View style={styles.sidebarHeader}>
                        <Text style={styles.sidebarTitle}>Direct Messages</Text>
                        <TouchableOpacity onPress={() => setIsSidebarVisible(false)}>
                            <Text style={{ fontSize: 24, fontWeight: 'bold', padding: 10 }}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={sessionUsers.filter(u => u.id !== socket.id)} // exclude self from user list
                        keyExtractor={(item) => item.id}
                        ListEmptyComponent={() => (
                            <View style={{ marginTop: 20, alignItems: 'center' }}>
                                <Text style={{ color: '#999', fontStyle: 'italic' }}>
                                    No other users online right now.
                                </Text>
                            </View>
                        )}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.userItem}
                                onPress={() => startPrivateChat(item)}
                            >
                                <View style={[styles.userDot, { backgroundColor: item.color }]} />
                                <Text style={styles.userName}>{item.name}</Text>
                                <Text style={{color: '#999'}}>Chat ➔</Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </Modal>
        </View>
    );
}