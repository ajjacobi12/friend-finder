// frontend/src/features/chat/ChatScreens.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, TextInput, Platform, KeyboardAvoidingView, FlatList, Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
// import { KeyboardAwareFlatList } from 'react-native-keyboard-controller'; 

import { useUser } from '../../context/UserContext';

import { useChatLogic } from './useChatLogic';
import MessageItem from './components/chat/MessageItem';
import Sidebar from './components/chat/SidebarItem';

import { styles } from '../../styles/styles';

const editTimeLimit = 5 * 60 * 1000; // 5 minutes

export default function ChatScreen({ navigation, route }) {
    const { friends } = useUser();

    const isFocused = useIsFocused();
    const insets = useSafeAreaInsets();

    const [isSidebarVisible, setIsSidebarVisible] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [newMsgBelow, setNewMsgBelow] = useState(false);
    
    const { isDM, DMroomID, recipientName = 'User' } = route.params || {};
    const maxMsgLength = 500;

    const {
        textInput, activeRoomMsgs,
        editingMsg, 
        sendMsg, resendMsg,
        typingUsers, spamWarning,
        handleTextChange,
        cancelEditing, saveEdit, 
        handleMsgLongPress,
        userUUID,
        currentChatRoomID,
        hasUnreadDMs, hasUnreadGroup, pulseAnim
    } = useChatLogic({ isDM, DMroomID, navigation, isFocused, isSidebarVisible, newMsgBelow });

    const flatListRef = useRef();
    const prevMsgCount = useRef(activeRoomMsgs.length);
    const isAutoScrollingRef = useRef(false);

    // Map the UUIDs to Names
    const typingNames = Object.keys(typingUsers)
        .map(uuid => {
            const friend = friends.find(f => f.uuid === uuid);
            return friend ? friend.name : 'Someone';
        });

    // handle scrolling of messages
    const handleScroll = (event) => {
        // need this ref so that if we are autoscrolling, setIsAtBottom is not constantly being reset to false
        // and so the arrow can disappear immediately upon clicking it
        if (isAutoScrollingRef.current) return;

        const offset = event.nativeEvent.contentOffset.y;
        // in inverted list, 0 is at bottom
        // if offset is small, user is near the bottom
        setIsAtBottom(offset < 100);
    };

    const renderMessage = useCallback(({ item }) => (
        <MessageItem 
            item={item}
            userUUID={userUUID}
            onLongPress={handleMsgLongPress}
            onResend={resendMsg}
            editTimeLimit={editTimeLimit}
         />
    ), [userUUID, handleMsgLongPress, resendMsg, editTimeLimit]);

    // --- EFFECTS & LISTENERS ---

    // auto scroll only if user is already at bottom of messages or if it's
    // their own message
    useEffect(() => {
        if (activeRoomMsgs.length === 0) return;
        
        const isMyMine = activeRoomMsgs[0].senderUUID === userUUID;
        
        // only scroll if:
        // 1. it's a message I just sent
        // I am already at the bottom
        if (isMyMine || isAtBottom) {
            requestAnimationFrame(() => {
                if (flatListRef.current) {
                    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                }
            });
        }
        // if neither is true, stay exactly where user is
    }, [activeRoomMsgs.length]);

    // tracks if new message arrives while user has scrolled up in message list
    useEffect(() => {
        if (activeRoomMsgs.length > prevMsgCount.current && !isAtBottom) {
            setNewMsgBelow(true);
        }
    }, [activeRoomMsgs.length]);

    // tracks if user goes back to bottom of list to see new messages
    // also updates the current message count that has been seen
    useEffect(() => {
        if (isAtBottom) {
            setNewMsgBelow(false);
            prevMsgCount.current = activeRoomMsgs.length
        }
    }, [isAtBottom, activeRoomMsgs.length]);

    // --- UI LAYOUT ---
    return (
        <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
            {/* --- HEADER --- */}
            <View style={[styles.customHeader, { zIndex: 10, height: insets.top, paddingTop: 50 + insets.top }]}>
                {/* LEFT SLOT: back to group chat button */}
                <View style={{ flex: 1, alignItems: 'flex-start', justifyContent: 'center' }}>
                    {isDM && (
                        <Pressable
                            onPress={() => { navigation.navigate('Chat', { isDM: false }) }}
                            style={({ pressed }) => [
                                styles.headerButton,
                                styles.headerButtonStandard,
                                {
                                    minWidth: 47,
                                    paddingHorizontal: 10,
                                    paddingTop: 2,
                                    backgroundColor: pressed ? 'rgba(74, 74, 74, 0.1)' : '#ffffff',
                                    borderWidth: pressed ? 1 : (hasUnreadGroup ? 0 : 3),
                                    borderColor: hasUnreadGroup ? 'rgba(135, 206, 250, 0.8)' : 'rgba(83, 82, 82, 0.1)', 
                                }
                            ]}
                        >
                            {({ pressed }) => (
                                <>
                                    {hasUnreadGroup && !pressed && (
                                        <Animated.View 
                                            key="glow-layer"
                                            style={[
                                                StyleSheet.absoluteFillObject,
                                                styles.unreadMsgButton,
                                                { 
                                                    shadowOpacity: pulseAnim, // Override static opacity with the animation
                                                    zIndex: -1 
                                                }
                                            ]} 
                                        />
                                    )}
                                    <Text style={{ color: hasUnreadGroup ? '#4682b4' : '#000000', fontSize: 32, lineHeight: 35, fontWeight: '400', marginRight: 2 }}>❮</Text>
                                    {/* <Text style={{ color: hasUnreadGroup ? '#4682b4' : '#000000', fontSize: 17, fontWeight: '600' }}> Group</Text> */}
                                </>
                            )}
                        </Pressable>
                    )}
                </View>

                {/* CENTER SLOT: chat label */}
                <View style={styles.absoluteHeaderTitle}>
                    <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.5}
                        style={[styles.headerTitleText, { fontSize: isDM ? 20 : 25 }]}>
                        {isDM ? `${recipientName}` : 'Group Chat'}
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
                                backgroundColor: pressed ? 'rgba(74, 74, 74, 0.1)' : '#ffffff',
                                borderWidth: pressed ? 1 : (hasUnreadDMs ? 0 : 3),
                                paddingHorizontal: 5,
                                minWidth: 40,
                                paddingRight: 0,
                                paddingLeft: 8,
                                borderColor: hasUnreadDMs ? 'rgba(135, 206, 250, 0.8)' : 'rgba(83, 82, 82, 0.1)', 
                            }
                        ]}
                    >
                        {({ pressed }) => (
                            <>
                                {hasUnreadDMs && !pressed && (
                                    <Animated.View 
                                        key="glow-layer"
                                        style={[
                                            StyleSheet.absoluteFillObject,
                                            styles.unreadMsgButton,
                                            { 
                                                shadowOpacity: pulseAnim, // Override static opacity with the animation
                                                zIndex: -1 
                                            }
                                        ]} 
                                    />
                                )}
                                <Text style={{ color: hasUnreadDMs ? '#4682b4' : '#000000', fontSize: 35, lineHeight: 35, fontWeight: '400' }}>☰ </Text>
                            </>
                        )}
                    </Pressable>
                </View>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1}}
                behavior={ Platform.OS === 'ios' ? 'padding' : undefined }
            >
                {/* --- MAIN CONTENT AREA --- */}
                <View style={{ flex: 1 }}>
                    <FlatList
                        ref={flatListRef}
                        data={activeRoomMsgs || []}
                        renderItem={renderMessage}
                        keyExtractor={(item) => item.msgID}
                        inverted
                        maintainVisibleContentPosition={{
                            minIndexForVisible: 0,
                            autoscrollToTopThreshold: 10
                        }}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 15 }}
                        // bottomOffset={Platform.OS === 'ios' ? 0 : 10}
                        
                        // Typing/Spam indicators move here so they stay at the bottom of the list
                        ListHeaderComponent={
                            <View style={{ paddingVertical: 8 }}>
                                {/* TYPING INDICATOR */}
                                {typingNames.length > 0 && (
                                    <Text style={{ fontStyle: 'italic', color: '#888', fontSize: 12, paddingLeft: 5 }}>
                                        {typingNames.join(', ')} {typingNames.length > 1 ? 'are' : 'is'} typing...
                                    </Text>
                                )}
                                {/* SPAM WARNING */}
                                {spamWarning && (
                                    <Text style={{ color: '#ff4444', fontSize: 12, fontWeight: 'bold', paddingLeft: 5 }}>
                                        {spamWarning}
                                    </Text>
                                )}
                            </View>
                        }
                    />

                    {/* --- SCROLL TO BOTTOM BUTTON --- */}
                    {!isAtBottom && activeRoomMsgs.length > 0 && (
                        <Pressable
                            onPress={() => {
                                isAutoScrollingRef.current = true;
                            
                                setIsAtBottom(true);
                                setNewMsgBelow(false);
                                flatListRef.current?.scrollToOffset({ offset: 0, animated: true });

                                setTimeout(() => {
                                    isAutoScrollingRef.current = false;
                                }, 1000);
                            }}
                            style={({ pressed }) => [
                                styles.scrollToBottomButton,
                                {
                                    backgroundColor: pressed ? '#cbdff2' : '#ffffff',
                                    bottom: 10,
                                    borderColor: newMsgBelow ? 'rgba(135, 206, 250, 0.8)' : 'rgba(0, 0, 0, 0.1)', 
                                    borderWidth: 1,
                                }
                            ]}
                        >
                            {({ pressed }) => (
                                <>
                                    {newMsgBelow && !pressed && (
                                        <Animated.View 
                                            key="glow-layer"
                                            style={[
                                                StyleSheet.absoluteFillObject,
                                                styles.unreadMsgButton,
                                                { 
                                                    shadowOpacity: pulseAnim, 
                                                    borderRadius: 20,
                                                    zIndex: -1 
                                                }
                                            ]} 
                                        />
                                    )}
                                    <Ionicons name="arrow-down" size={24} color={newMsgBelow ? '#4682b4' : '#007aff'} />
                                </>
                            )}
                        </Pressable>
                    )}
                </View>

                {/* --- INPUT CONTAINER --- */}
                <View style={[
                        styles.messageInputContainer, 
                        { flexDirection: 'column', alignItems: 'stretch', paddingBottom: 7 }
                    ]}
                >
                    {/* top row: buttons and text input */}
                    <View style={{ flexDirection: 'row', alignItems:'center' }}>
                        {/* CANCEL EDIT BUTTON */}
                        {editingMsg && (
                            <Pressable
                                onPress={cancelEditing}
                                style={{ paddingHorizontal: 10, justifyContent: 'center' }}
                            >
                                <Ionicons name="close-circle" size={35} color="#ff3b30" />
                            </Pressable>
                        )}
                        {/* TEXT INPUT BOX */}
                        <TextInput
                            style={[
                                styles.messageInput,
                                editingMsg && { borderColor: '#34C759', borderWidth: 1 },
                                { minHeight: 37, maxHeight: 111 }
                            ]}
                            placeholder={editingMsg ? "Edit your message..." : "Type a message..."}
                            value={textInput}
                            onChangeText={handleTextChange}
                            onSubmitEditing={() => editingMsg ? saveEdit() : sendMsg()}
                            returnKeyType="send"
                            placeholderTextColor="#838181"
                            maxLength={maxMsgLength}
                            blurOnSubmit={false}
                            multiline={true}
                            textAlignVertical="center" // for android
                        />
                        {/* SEND MSG BUTTON */}
                        <Pressable
                            onPress={() => editingMsg ? saveEdit() : sendMsg()}
                            style={[
                                styles.sendButton,
                                editingMsg && { backgroundColor: '#34C759' }
                            ]}
                            disabled={textInput.trim().length === 0}
                        >
                            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 18 }}>
                                {editingMsg ? "Save" : "Send"}
                            </Text>
                        </Pressable>
                    </View>
                    
                    {/* bottom row: character counter */}
                    {/* REMAINING CHARACTER COUNT */}
                    {textInput.length > 400 && (
                        <Text style={{
                            alignSelf: 'flex-end',
                            marginRight: 15,
                            marginTop: 4,
                            fontSize: 10,
                            color: textInput.length >= maxMsgLength ? '#ff3b30' : '#888'
                        }}>
                            {maxMsgLength - textInput.length} characters remaining
                        </Text>
                    )}

                </View>
            </KeyboardAvoidingView>

            {/* --- SIDEBAR --- */}
            <Sidebar
                isVisible={isSidebarVisible}
                setIsSidebarVisible={setIsSidebarVisible}
                navigation={navigation}
                isDM={isDM}
                currentChatRoomID={currentChatRoomID}
            />
        </View>
    );
}