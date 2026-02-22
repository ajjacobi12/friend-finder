// UserContext.js

// ---- IMPORTS -----
import React, { useState, createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { Alert, TouchableOpacity, View, Text, Animated, PanResponder, ActivityIndicator } from 'react-native';
import { useAudioPlayer } from 'expo-audio';

import socket from '../services/socketServices';
import { navigationRef } from '../services/navigationService';
import { styles } from '../styles/styles';

// create context object (empty container) to hold global data
const UserContext = createContext();

// create provider component
// "wraps" the app and provides the data to everyone inside
// "children" are the components wrapped by UserProvider
export const UserProvider = ({ children }) => {
    const [name, setName] = useState('');
    const [selectedColor, setSelectedColor] = useState('#a0220c');
    const [hasRegistered, setHasRegistered] = useState(false);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [sessionID, setSessionID] = useState(null);
    const [sessionUsers, setSessionUsers] = useState([]);
    const [friends, setFriends] = useState([]);
    const [isHost, setIsHost] = useState(false);
    const [notification, setNotification] = useState(null);
    const [allMessages, setAllMessages] = useState({});
    const [userUUID, setUserUUID] = useState(null);
    const [unreadRooms, setUnreadRooms] = useState([]);
    const [currentActiveRoom, setCurrentActiveRoom] = useState(null);
    const [isReconnecting, setIsReconnecting] = useState(false);

    const slideAnim = useRef(new Animated.Value(-100)).current;
    const hideTimeout = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const isConnectingRef = useRef(false);
    const justCreatedSession = useRef(false);
    const activeRoomRef = useRef(currentActiveRoom);
    const showOverlayTimeoutRef = useRef(null);

    const sessionIDRef = useRef(sessionID);
    const isHostRef = useRef(isHost);

    const audioSource = require('../../assets/ding.mp3');
    const player = useAudioPlayer(audioSource);

    // keep a ref to the latest sessionID for cleanup on disconnect
    useEffect(() => { sessionIDRef.current = sessionID; }, [sessionID]);
    useEffect(() => { isHostRef.current = isHost; }, [isHost]);
    useEffect(() => { activeRoomRef.current = currentActiveRoom; }, [currentActiveRoom]);

    // --- CLEANUP FUNCTION ----
    const handleCleanExit = useCallback(() => {
        // clear pending timeout
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        setSessionID(null);
        setSessionUsers([]);
        setFriends([]);
        setSelectedColor('#cccccc');
        setIsHost(false);
        setHasRegistered(false);
        setIsReconnecting(false);
    }, []);

    // --- SHOW NOTIFICATION FUNCTION ---
    const showNotification = useCallback((data) => {
        // console.log("notification triggered", data);
        // clear any existing timer
        if (hideTimeout.current) clearTimeout(hideTimeout.current);

        setNotification(data);

        // slide down animation
        Animated.spring(slideAnim, {
            toValue: 65,
            useNativeDriver: true,
            tension: 50,
            friction: 8
        }).start();

        // auto-hide after 5 seconds
        hideTimeout.current = setTimeout(() => {
            Animated.timing(slideAnim, {
                toValue: -100,
                duration: 300,
                useNativeDriver: true,
            }).start(() => setNotification(null));
        }, 5000);   
    }, [slideAnim]);

    // ---  GET RID OF NOTIFICATION ---
    const hideNotification = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dy) > 5,
            onPanResponderMove: (event, gestureState) => {
                if (gestureState.dy < 0) { // if swiped up
                    slideAnim.setValue(65 + gestureState.dy);
                }
            },
            onPanResponderRelease: (event, gestureState) => {
                if (gestureState.dy < -20) { // if swiped up enough
                    if (hideTimeout.current) clearTimeout(hideTimeout.current);
                    Animated.timing(slideAnim, {
                        toValue: -100,
                        duration: 200,
                        useNativeDriver: true,
                    }).start(() => setNotification(null));
                } else {
                    // snap back down
                    Animated.spring(slideAnim, {
                        toValue: 65,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    // --- UNREAD MESSAGES ---
    // function called from chat.js when entering a room
    const markAsRead = useCallback((chatRoomID) => {
        activeRoomRef.current = chatRoomID;
        setCurrentActiveRoom(chatRoomID);
        setUnreadRooms(prev => prev.filter(roomID => roomID !== chatRoomID));
    }, []);

    // --- DESANITIZE INCOMING TEXT ---
    const desanitize = (text) => {
        if (typeof text !== 'string') return '';
        return text
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'");
    };

    // --- UPDATE LOCAL MESSAGE DATA ---
    const updateLocalMessage = (chatRoomID, msgID, updates) => {

        if (!chatRoomID || !msgID) {
            throw new Error(`[STORAGE ERROR] Update failed: ${!chatRoomID ? 'chatRoomID' : 'msgID'} is missing.`);
        }

        setAllMessages(prev => {
            const roomMsgs = prev[chatRoomID];
            if(!roomMsgs || roomMsgs.length === 0) return prev;

            // filter through messages based on chatRoomID and find the one with matching msgID
            return {
                ...prev,
                [chatRoomID]: roomMsgs.map(m => {
                    if (m.msgID === msgID) {
                        // append updates, and if new text, update the context: text
                        const { newText, serverTimestamp, ...otherUpdates } = updates;
                        const updatedMsg = { ...m, ...otherUpdates };
                        if (newText !== undefined) updatedMsg.context = { ...m.context, text: desanitize(newText) };
                        if (serverTimestamp !== undefined) updatedMsg.timestamp = serverTimestamp;
                        return updatedMsg;
                    }
                    return m;
                })
            };
        });
    };

    const formatMessageData = (messageData, status) => {
        const {
            chatRoomID, msgID, senderUUID, senderName, color, context, 
            serverTimestamp, timestamp,
        } = messageData;

        return {
            chatRoomID,
            msgID,
            senderUUID,
            senderName: desanitize(senderName),
            color,
            context: {
                isEncrypted: false,
                text: desanitize(context.text),
                version: "1.0"
            },
            timestamp: serverTimestamp || timestamp || Date.now(),
            status
        };
    };

    // --- CONNECTION MANAGER ---
    // manually poke socket every 5 seconds if it's taking too long to realize the server is back
    // useEffect(() => {
    //     const interval = setInterval(() => {
    //         if (!socket.connected && !isConnectingRef.current) {
    //             console.log("Socket disconnected, attempting to reconnect...");
    //             isConnectingRef.current = true;
    //             socket.connect();
    //         }            
    //     }, 5000); // every 5 seconds
    //     return () => clearInterval(interval);
    // }, []);


    // ----- CORE SOCKET LISTENERS -----
    // if socket changes (app starts up): 
    // if connecting set connection status to true
    // if disconnecting/connection drops then start cleanup
    // if is sent then play sound and update user list
    useEffect(() => {
        // sound stuff
        const playJoinSound = () => {
            if (player.playing) {
                player.seekTo(0); // restart sound if already playing
            }
            player.play();
        };

        const joinSoundLogic = (newUsers, oldUsers) => {
            if (newUsers.length > oldUsers.length && oldUsers.length !== 0) {
                const joinedUser = newUsers.find(u => !oldUsers.some(p => p.uuid === u.uuid));
                // notify only if joined user is not self
                if (joinedUser && joinedUser.uuid !== userUUID) {
                    playJoinSound();
                    showNotification({ 
                        title: `👤 ${joinedUser.name} `, 
                        message: "has joined the session.",
                        type: 'info'
                    });
                }
            }
        };

        const leaveSoundLogic = (newUsers, oldUsers) => {
            if (newUsers.length < oldUsers.length) {
                const leftUser = oldUsers.find(p => !newUsers.some(u => u.uuid === p.uuid));
                // notify only if left user is not self
                if (leftUser) {
                    showNotification({ 
                        title: `👤 ${leftUser.name} `, 
                        message: "has left the session.",
                        type: 'info'
                    });
                }
            }
        };

        // --- HANDLERS ---
        const onConnect = async () => {
            console.log("Connected", socket.id);
            setIsConnected(true);
            isConnectingRef.current = false;

            // clear overlay immediately on reconnect
            setIsReconnecting(false);
            if (showOverlayTimeoutRef.current) {
                clearTimeout(showOverlayTimeoutRef.current);
                showOverlayTimeoutRef.current = null;
            }

            // silent rejoin logic
            if (sessionIDRef.current && userUUID) {
                console.log("[SILENT REJOIN] attempt for user ", userUUID);
                try {
                    const response = await joinSessionAction(sessionIDRef.current, userUUID);
                    if (response.alreadyRegistered) {
                        setName(desanitize(response.name));
                        setSelectedColor(response.color);
                        setIsHost(response.isHost);
                        setHasRegistered(true);
                        console.log("[SILENT REJOIN] success. Restored profile.");
                    } else {
                        console.log("User still in setup phase, staying on Profile.");                       
                    }
                } catch (err) {
                    console.log("[SILENT REJOIN] unsuccessful: ", err.message);
                    handleCleanExit();
                }
            }

            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        };

        const onDisconnect = (reason) => {
            console.log("Disconnected: ", reason);
            setIsConnected(false);

            // if clean disconnect (server kicked us or we left),don't show overlay
            if (reason === "io server disconnect" || reason === "io client disconnect") {
                handleCleanExit();
                return;
            }
            // if accidental drop, start grace period
            // if 'io server disconnect', the server kicked us, so exit immediately
            // const isAccidental = reason == "transport close" || reason === "ping timeout";
            if (sessionIDRef.current) {
                // wait 1.5 seconds before showing "reconnecting" overlay
                showOverlayTimeoutRef.current = setTimeout(() => {
                    setIsReconnecting(true);
                }, 1500);
                // 15s cleanup grace period
                reconnectTimeoutRef.current = setTimeout(() => {
                    handleCleanExit();
                    setIsReconnecting(false);
                }, 15000);
            } 
        };

        const onUserUpdate = (users) => {
            const cleanUsers = users.map(u=> ({
                ...u,
                name: desanitize(u.name)
            }));

            setSessionUsers((prev) => {
                joinSoundLogic(cleanUsers, prev);
                leaveSoundLogic(cleanUsers, prev);
                return cleanUsers;
            });

            const otherUsers = cleanUsers.filter(u => u.uuid !== userUUID);
            setFriends(otherUsers);
        };

        // message appears immediately on sender's screen, then updates when the server confirms it
        const onReceiveMessage = (inboundData) => {
            const { chatRoomID, msgID } = inboundData;
            const messageData = formatMessageData(inboundData, 'sent');
 
            setAllMessages(prev => {
                const roomMsgs = prev[chatRoomID] || [];
                const existingMsgIndex = roomMsgs.findIndex(m => m.msgID === msgID);
                if (existingMsgIndex !== -1) {
                    // check if we already have a "local" version of this message
                    // theoretically this should never happen where we recieve a message we sent, but who knows
                    const updatedMsgs = [...roomMsgs];
                    updatedMsgs[existingMsgIndex] = {
                        ...roomMsgs[existingMsgIndex],
                        ...messageData,
                    };
                    return { ...prev, [chatRoomID]: updatedMsgs };
                }
                // otherwise, just add the new message
                return {
                    ...prev,
                    [chatRoomID]: [messageData, ...roomMsgs]
                };
            });

            // unread logic
            // console.log("activeRoomRef.current: ", activeRoomRef.current);
            // console.log("messageData.chatRoomID: ", messageData.chatRoomID);
            if (chatRoomID !== activeRoomRef.current) {
                setUnreadRooms(prev => {
                    // if the room is already in unread list, do nothing
                    if (prev.includes(chatRoomID)) return prev;
                    // otherwise add it to the list
                    return [...prev, chatRoomID];
                });
                const isDM = chatRoomID.includes('_');
                showNotification({ 
                    title: isDM ? (`👤 ${messageData.senderName}`) : (`💬 ${messageData.senderName}`), 
                    message: messageData.context.text,
                    chatRoomID: chatRoomID,
                    isDM: isDM,
                    type: 'info'
                });
            }
        };

        const handleDeletedByOthers = ( chatRoomID, msgID, senderName ) => {  
            try {
                updateLocalMessage(chatRoomID, msgID, {
                    isDeleted: true,
                    newText: `${desanitize(senderName)} removed this message.`
                });
            } catch (err) {
                console.log("[MSG] deletion error, ", err.message);
            }
        };

        const handleEditedByOthers = ( chatRoomID, msgID, newText ) => {
            try {
                updateLocalMessage(chatRoomID, msgID, { 
                    isEdited: true,
                    newText: desanitize(newText)  
                });
            } catch (err) {
                console.log("[MSG] edit error, ", err.message);
            }
        };

        const onSessionEnded = () => {
            if (!isHostRef.current) Alert.alert("The host has ended the session.");
            handleCleanExit();
        };

        const onRemoved = () => {
            Alert.alert("Removed", "The host removed you from the session.");
            handleCleanExit();
        };

        const onHostChange = (newHostUUID) => {
            const amIHost = userUUID === newHostUUID;
            
            if (amIHost && !justCreatedSession.current && !isHostRef.current) {
                showNotification({ 
                    title: "👑 System Update", 
                    message: "You are now the host of this session.",
                    type: 'info'
                });
            } 
            setIsHost(amIHost);
            justCreatedSession.current = false;
        };

        // --- ATTACH ---
                    
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('user-update', onUserUpdate);
        socket.on('receive-message', onReceiveMessage);
        socket.on('message-deleted', handleDeletedByOthers);
        socket.on('message-edited', handleEditedByOthers);
        socket.on('session-ended', onSessionEnded);
        socket.on('removed-from-session', onRemoved);
        socket.on('host-change', onHostChange);
        
        // ---DETACH (cleanup) --- 
        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('user-update', onUserUpdate);
            socket.off('receive-message', onReceiveMessage);
            socket.off('message-deleted', handleDeletedByOthers);
            socket.off('message-edited', handleEditedByOthers);
            socket.off('session-ended', onSessionEnded);
            socket.off('removed-from-session', onRemoved);
            socket.off('host-change', onHostChange);
        };
    }, [socket, userUUID, showNotification, handleCleanExit]); 

    const value = useMemo(() => ({
        name, setName, selectedColor, setSelectedColor, hasRegistered, 
        setHasRegistered, socket, isConnected, sessionID, setSessionID, sessionUsers, setSessionUsers,
        handleCleanExit, isHost, setIsHost, allMessages, setAllMessages, justCreatedSession, userUUID, setUserUUID,
        unreadRooms, setUnreadRooms, markAsRead, friends, setFriends, desanitize, isReconnecting, updateLocalMessage,
        formatMessageData
    }), [name, selectedColor, hasRegistered, isConnected, sessionID, sessionUsers, isHost, isReconnecting, allMessages, userUUID, friends, handleCleanExit, markAsRead]);

    return (
        <UserContext.Provider value={value}>
            {children}

            {notification && (
                <Animated.View 
                    {...hideNotification.panHandlers}
                    style={[
                        styles.notificationBar,
                        {
                            transform: [{ translateY: slideAnim }]
                        }
                        ]}
                >
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => { 
                            const { chatRoomID, isDM, title } = notification;
                            setNotification(null);
                                if (chatRoomID)    {
                                    navigationRef.navigate('Chat', { 
                                        isDirectMessage: isDM,
                                        DMroomID: isDM ? chatRoomID : null,
                                        recipientName: isDM ? title.replace('👤 ', '').replace('💬 ', '') : undefined,
                                    });
                                }
                        }}
                    >
                        <Text style={[styles.notificationTitle, {marginBottom: 2}]}>{notification.title}</Text>
                        <Text style={styles.notificationText} numberOfLines={1}>{notification.message}</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}

            {!isConnected && (
                <View style={[styles.reconnectingOverlay, !isReconnecting && { backgroundColor: 'transparent' }]}>
                    {/* spinner and text only visible once isReconnecting is true, which is a disconnection > 1.5 s */}
                    {isReconnecting && (
                        <View style={styles.reconnectBox}>
                            <ActivityIndicator size="large" color="#ffffff" />
                            <Text style={styles.reconnectingText}>Reconnecting to server...</Text>
                        </View>
                    )}   
                </View>
            )}
        </UserContext.Provider>
    );
};

// create "hook" to make using this data easy
export const useUser = () => useContext(UserContext);