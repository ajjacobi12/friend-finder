import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform, StyleSheet, InteractionManager } from 'react-native';
import Modal from 'react-native-modal';
import { useHeaderHeight } from '@react-navigation/elements';
import { useUser } from '../UserContext';
// import { styles } from '../styles';

export default function ChatScreen({ navigation, route }) {
    const { isDirectMessage, dmRoomID, recipientName } = route.params || {};
    const { socket, sessionId, name, selectedColor, secureEmit, sessionUsers, allMessages, setAllMessages } = useUser();
    const [message, setMessage] = useState('');
    const [isSidebarVisible, setIsSidebarVisible] = useState(false);

    const currentRoomID = isDirectMessage ? dmRoomID : sessionId;
    const messages = allMessages[currentRoomID] || [];

    const flatListRef = useRef();
    const headerHeight = useHeaderHeight();

    const typingTimeoutRef = useRef(null);
    const [isTyping, setIsTyping] = useState(false);
    const isTypingRef = useRef(false);

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
            }   );
        });

        return () => {
            InteractionManager.runAfterInteractions(() => {
                socket.off('user-typing');
                socket.off('user-stop-typing');
                if (isTypingRef.current) { // clean up on unmount
                    secureEmit('stop-typing', { roomID: currentRoomID });
                }
            })
        };
    }, [socket, isTyping]);


    useLayoutEffect(() => {
        navigation.setOptions({
            title: isDirectMessage ? `${recipientName}` : 'Group Chat',
            headerStyle: {
            backgroundColor: '#ffffff',
            elevation: 0,
            shadowOpacity: 0,
            height: 125,
        },
    headerRight: () => (
        <TouchableOpacity 
            activeOpacity={1}
            onPress={() => setIsSidebarVisible(true)}  // () => means do this only when button is pressed
            style={{ 
                marginRight: 15, 
                paddingHorizontal: 10,
                paddingVertical: 13,
                borderRadius: 17, 
                backgroundColor: selectedColor + '25' }}>
            <Text style={{ color: '#000000', fontWeight: 'bold', fontSize: 12, textAlign: 'center'}}>{"Direct"}{"\n"}{"Message"}</Text>
        </TouchableOpacity>
        ),
    });
    }, [navigation, isDirectMessage, recipientName, selectedColor]);

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
        navigation.push('Chat', {
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
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={headerHeight}
                style={{ flex: 1, backgroundColor: '#f5f5f5' }}
            >

            {/* --- MESSAGE LIST --- */}
            <View style={{ flex: 1 }}>
            <FlatList
                ref={flatListRef}
                data={reverseMessages}
                inverted
                keyExtractor={(item, index) => index.toString()}
                removeClippedSubviews={Platform.OS === 'ios'}
                maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                renderItem={({ item }) => (
                    <View style={[
                        styles.messageBubble,
                        item.id === socket.id ? styles.myMessage : styles.theirMessage
                    ]}>
                        <Text style={{ fontWeight: 'bold', color: item.color, fontSize: 12 }}>
                            {item.sender} • {item.time}
                        </Text>
                        <Text style={{ fontSize: 16, marginTop: 5 }}>
                            {item.context.text}
                        </Text>
                    </View>
                )}
            />

                {/* --- TYPING INDICATOR --- */}
                <View style={{ height: 20, paddingHorizontal: 20, marginBottom: 5 }}>
                    {Object.values(typingUsers).length > 0 && (
                        <Text style={{ fontStyle: 'italic', color: '#888', fontSize: 12 }}>
                            {Object.values(typingUsers).join(', ')} {Object.values(typingUsers).length > 1 ? 'are' : 'is'} typing...
                        </Text>
                    )}
                </View>

                {/* --- INPUT BOX --- */}
                <View style={styles.inputContainer}>
                    <TextInput
                        style={[styles.input, { fontSize: 18 }]}
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
        </KeyboardAvoidingView>
        
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

const styles = StyleSheet.create({
    messageBubble: {
        padding: 10,
        margin: 10,
        borderRadius: 10,
        maxWidth: '80%',
    },
    myMessage: {
        backgroundColor: '#007aff' + '20',
        alignSelf: 'flex-end',
        borderBottomRightRadius: 0,
    },
    theirMessage: {
        backgroundColor: '#e5e5ea',
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 0,
    },
    inputContainer: {
        flexDirection: 'row',
        paddingTop: 10,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 20 : 10,
        backgroundColor: 'white',
        alignItems: 'center',
        // height: 80,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    input: {
        flex: 1,
        height: 40,
        borderColor: '#ddd',
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 15,
        marginRight: 10,
        backgroundColor: '#fff',
        height: 45,
    },
    sendButton: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
        height: 40,
        backgroundColor: '#007aff',
        borderRadius: 20,
    },
    sidebarContainer: {
        backgroundColor: '#ffffff',
        width: '80%',
        height: '100%',
        alignSelf: 'flex-end', // Pushes sidebar to the right
        paddingTop: 50,
        paddingHorizontal: 20,
        backfaceVisibility: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: -5, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 5,
    },
    sidebarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 10,
    },
    sidebarTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    userDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 10,
    },
    userName: {
        fontSize: 16,
        flex: 1,
    },
});