import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, TextInput, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useUser } from '../UserContext';
import { styles } from '../styles';
import { useSessionBackHandler } from '../hooks/useSessionBackHandler';
import { useHeaderHeight } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import { useChatLogic } from '../hooks/useChatLogic';
import { useIsFocused } from '@react-navigation/native';
import MessageItem from './components/MessageItem';
import Sidebar from './components/SidebarUserItem';

export default function ChatScreen({ navigation, route }) {
    const { sessionId, allMessages, userUUID, onLeave, unreadRooms } = useUser();
    const isFocused = useIsFocused();

    const [isSidebarVisible, setIsSidebarVisible] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(true);
    
    const { isDirectMessage, dmRoomID, recipientName } = route.params || {};
    const currentRoomID = isDirectMessage ? dmRoomID : sessionId;

    const chat = useChatLogic({ currentRoomID, isDirectMessage, dmRoomID, recipientName, navigation, sessionId, isFocused });

    const messages = allMessages[currentRoomID] || [];

    const flatListRef = useRef();

    const editTimeLimit = 5 * 60 * 1000; // 5 minutes
    const headerHeight = useHeaderHeight();
    const tabBarHeight = 110; // approximate height of the tab bar

    // take care of android "back" button
    useSessionBackHandler(onLeave);

    // handle scrolling of messages
    const handleScroll = (event) => {
        const offset = event.nativeEvent.contentOffset.y;
        // in inverted list, 0 is at bottom
        // if offset is small, user is near the bottom
        setIsAtBottom(offset < 100);
    };

    const renderMessage = useCallback(({ item }) => (
        <MessageItem item={item} />
    ), []);

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
                keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight + tabBarHeight : 0}
                style={{ flex: 1, backgroundColor: '#f5f5f5' }}
            >

                {/* --- MESSAGE LIST --- */}
                <View style={{ flex: 1 }}>
                    <FlatList
                        ref={flatListRef}
                        data={messages || [] }
                        inverted
                        keyExtractor={(item) => item.id}      
                        contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 15 }}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        removeClippedSubviews={Platform.OS === 'ios'}
                        keyboardShouldPersistTaps="handled"
                        renderItem={renderMessage}
                    />

                    {/* --- SCROLL TO BOTTOM BUTTON --- */}
                    {!isAtBottom && reversedMessages.length > 0 && (
                        <Pressable
                            onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
                            style={{
                                position: 'absolute',
                                bottom: 80,
                                right: 20,
                                backgroundColor: '#ffffff',
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                justifyContent: 'center',
                                alignItems: 'center',
                                elevation: 5,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.2,
                                shadowRadius: 3,
                                zIndex: 10,
                            }}
                        >
                            <Ionicons name="arrow-down" size={24} color="#007aff" />
                        </Pressable>
                    )}

                    {/* --- TYPING INDICATOR --- */}
                    <View style={{ height: 25, paddingHorizontal: 20, justifyContent: 'center' }}>
                        {Object.values(chat.typingUsers).length > 0 && (
                            <Text style={{ fontStyle: 'italic', color: '#888', fontSize: 12 }}>
                                {Object.values(chat.typingUsers).join(', ')} {Object.values(chat.typingUsers).length > 1 ? 'are' : 'is'} typing...
                            </Text>
                        )}
                    </View>

                    {/* --- SPAM WARNING --- */}
                    <View style={{ height: 20, paddingHorizontal: 20, justifyContent: 'center' }}>
                        {chat.spamWarning ? (
                            <Text style={{ color: '#ff4444', fontSize: 12, fontWeight: 'bold' }}>
                                {chat.spamWarning}
                            </Text>
                        ) : null}
                    </View>

                    {/* --- INPUT BOX --- */}
                    <View style={styles.messageInputContainer}>
                        {/* cancel edit button */}
                        {chat.editingMessage && (
                            <Pressable
                                onPress={chat.cancelEditing}
                                style={{ paddingHorizontal: 10, justifyContent: 'center' }}
                            >
                                <Ionicons name="close-circle" size={35} color="#ff3b30" />
                            </Pressable>
                        )}
                        <TextInput
                            style={[
                                styles.messageInput,
                                chat.editingMessage && { borderColor: '#34C759', borderWidth: 1 }
                            ]}
                            placeholder={chat.editingMessage ? "Edit your message..." : "Type a message..."}                            
                            value={chat.message}
                            onChangeText={chat.handleTextChange}
                            onSubmitEditing={() => chat.editingMessage ? chat.saveEdit() : chat.sendMessage()}
                            returnKeyType="send"
                            placeholderTextColor="#838181"
                            blurOnSubmit={false}
                        />

                        {/* send / save button */}
                        <Pressable 
                            onPress={() => chat.editingMessage ? chat.saveEdit() : chat.sendMessage()} 
                            style={[
                                styles.sendButton,
                                chat.editingMessage && { backgroundColor: '#34C759'}
                            ]}
                            disabled={chat.message.trim().length === 0}
                            >
                            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 18 }}>
                                {chat.editingMessage ? "Save" : "Send"}
                            </Text>
                        </Pressable>
                    </View>
                </View>
                {/* end of messaging view */}
            </KeyboardAvoidingView>
            </View>
            {/* end of content wrapper */}
        
            {/* --- SIDEBAR FOR USER LIST --- */}
            <Sidebar 
                isVisible={isSidebarVisible} 
                setIsSidebarVisible={setIsSidebarVisible} 
                navigation={navigation} 
            />
        </View>
    );
}