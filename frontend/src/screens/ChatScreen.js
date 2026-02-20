// ChatScreens.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, TextInput, Platform, KeyboardAvoidingView, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
// import { KeyboardAwareFlatList } from 'react-native-keyboard-controller'; 

import { styles } from '../styles/styles';
import { useChatLogic } from '../hooks/useChatLogic';
import MessageItem from '../components/chat/MessageItem';
import Sidebar from '../components/chat/SidebarItem';

const editTimeLimit = 5 * 60 * 1000; // 5 minutes

export default function ChatScreen({ navigation, route }) {
    const isFocused = useIsFocused();
    const insets = useSafeAreaInsets();

    const [isSidebarVisible, setIsSidebarVisible] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(true);
    
    const { isDirectMessage, DMroomID, recipientName = 'User' } = route.params || {};

    const {
        message, messages,
        editingMessage, 
        sendMessage, resendMessage,
        typingUsers, spamWarning,
        handleTextChange,
        cancelEditing, saveEdit, 
        handleMessageLongPress,
        sessionId, userUUID,
        unreadRooms
    } = useChatLogic({ isDirectMessage, DMroomID, navigation, isFocused });

    const flatListRef = useRef();

    // handle scrolling of messages
    const handleScroll = (event) => {
        const offset = event.nativeEvent.contentOffset.y;
        // in inverted list, 0 is at bottom
        // if offset is small, user is near the bottom
        setIsAtBottom(offset < 100);
    };

    const renderMessage = useCallback(({ item }) => (
        <MessageItem 
            item={item}
            userUUID={userUUID}
            onLongPress={handleMessageLongPress}
            onResend={resendMessage}
            editTimeLimit={editTimeLimit}
         />
    ), [userUUID, handleMessageLongPress, resendMessage, editTimeLimit]);

    // --- EFFECTS & LISTENERS ---

    // auto scroll only if user is already at bottom of messages or if it's
    // their own message
    useEffect(() => {
        if (messages.length > 0 && (isAtBottom || messages[0].senderUUID === userUUID)) {
            requestAnimationFrame(() => {
                flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            });
        }
    }, [messages.length]);
            
    
    // --- UI LAYOUT ---
    return (
        <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
            {/* --- HEADER --- */}
            <View style={[styles.customHeader, { zIndex: 10, height: 60 + insets.top, paddingTop: insets.top }]}>
                {/* LEFT SLOT: back to group chat button */}
                <View style={{ flex: 1, alignItems: 'flex-start', justifyContent: 'center' }}>
                    {isDirectMessage && (
                        <Pressable
                            onPress={() => { navigation.navigate('Chat', { isDirectMessage: false }) }}
                            style={({ pressed }) => [
                                styles.headerButton,
                                styles.headerButtonStandard,
                                { backgroundColor: pressed ? '#007aff15' : '#ffffff' }
                            ]}>
                            <Text style={{ color: '#007aff', fontSize: 25, fontWeight: '400', marginRight: 2 }}>❮</Text>
                            <Text style={{ color: '#007aff', fontSize: 17, fontWeight: '600' }}> Group</Text>
                            {unreadRooms.includes(sessionId) && <View style={styles.unreadDotOverlap} />}
                        </Pressable>
                    )}
                </View>

                {/* CENTER SLOT: chat label */}
                <View style={styles.absoluteHeaderTitle}>
                    <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.5}
                        style={[styles.headerTitleText, { fontSize: isDirectMessage ? 20 : 25 }]}>
                        {isDirectMessage ? `${recipientName}` : 'Group Chat'}
                    </Text>
                </View>

                {/* RIGHT SLOT: direct message button */}
                <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                    <Pressable
                        onPress={() => setIsSidebarVisible(true)}
                        style={({ pressed }) => [
                            styles.headerButton,
                            styles.headerButtonStandard,
                            {
                                backgroundColor: pressed ? '#007aff15' : '#ffffff',
                                paddingHorizontal: 10,
                                minWidth: 40,
                                paddingRight: 5,
                            }
                        ]}>
                        <Text style={{ color: '#000000', fontSize: 30, lineHeight: 30 }}>☰ </Text>
                        {unreadRooms.some(id => id.includes('_')) && (
                            <View style={styles.unreadDotOverlap} />)}
                    </Pressable>
                </View>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1}}
                behavior={ Platform.OS === 'ios' ? 'padding' : undefined }
            >
            {/* --- MAIN CONTENT AREA --- */}
                <FlatList
                    ref={flatListRef}
                    data={messages || []}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.msgID}
                    inverted
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 15 }}
                    // bottomOffset={Platform.OS === 'ios' ? 0 : 10}
                    
                    // Typing/Spam indicators move here so they stay at the bottom of the list
                    ListHeaderComponent={
                        <View style={{ paddingVertical: 8 }}>
                            {Object.values(typingUsers).length > 0 && (
                                <Text style={{ fontStyle: 'italic', color: '#888', fontSize: 12, paddingLeft: 5 }}>
                                    {Object.values(typingUsers).join(', ')} {Object.values(typingUsers).length > 1 ? 'are' : 'is'} typing...
                                </Text>
                            )}
                            {spamWarning && (
                                <Text style={{ color: '#ff4444', fontSize: 12, fontWeight: 'bold', paddingLeft: 5 }}>
                                    {spamWarning}
                                </Text>
                            )}
                        </View>
                    }
                />

                {/* --- FLOATING SCROLL TO BOTTOM BUTTON --- */}
                {!isAtBottom && messages.length > 0 && (
                    <Pressable
                        onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
                        style={styles.scrollToBottomButton}
                    >
                        <Ionicons name="arrow-down" size={24} color="#007aff" />
                    </Pressable>
                )}

                {/* --- INPUT BOX --- */}
                <View style={[styles.messageInputContainer, { paddingBottom: 10 }]}>
                    {editingMessage && (
                        <Pressable
                            onPress={cancelEditing}
                            style={{ paddingHorizontal: 10, justifyContent: 'center' }}
                        >
                            <Ionicons name="close-circle" size={35} color="#ff3b30" />
                        </Pressable>
                    )}
                    <TextInput
                        style={[
                            styles.messageInput,
                            editingMessage && { borderColor: '#34C759', borderWidth: 1 }
                        ]}
                        placeholder={editingMessage ? "Edit your message..." : "Type a message..."}
                        value={message}
                        onChangeText={handleTextChange}
                        onSubmitEditing={() => editingMessage ? saveEdit() : sendMessage()}
                        returnKeyType="send"
                        placeholderTextColor="#838181"
                        blurOnSubmit={false}
                    />
                    <Pressable
                        onPress={() => editingMessage ? saveEdit() : sendMessage()}
                        style={[
                            styles.sendButton,
                            editingMessage && { backgroundColor: '#34C759' }
                        ]}
                        disabled={message.trim().length === 0}
                    >
                        <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 18 }}>
                            {editingMessage ? "Save" : "Send"}
                        </Text>
                    </Pressable>
                </View>
            </KeyboardAvoidingView>

            {/* --- SIDEBAR --- */}
            <Sidebar
                isVisible={isSidebarVisible}
                setIsSidebarVisible={setIsSidebarVisible}
                navigation={navigation}
            />
        </View>
    );
}