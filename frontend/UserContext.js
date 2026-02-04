// app's long-term memory and its connection to the outside world (the socket)

// ---- IMPORTS -----
import React, { useState, createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { Alert, TouchableOpacity, View, Text, Animated, PanResponder, ActivityIndicator } from 'react-native';
import socket from './socket';
import { Audio } from 'expo-av';
import { navigationRef } from './navigationService';
import { styles } from './styles';

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
    const [sessionId, setSessionId] = useState(null);
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

    const sessionIdRef = useRef(sessionId);
    const isHostRef = useRef(isHost);

    // keep a ref to the latest sessionId for cleanup on disconnect
    useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
    useEffect(() => { isHostRef.current = isHost; }, [isHost]);
    useEffect(() => { activeRoomRef.current = currentActiveRoom; }, [currentActiveRoom]);

    // --- CLEANUP FUNCTION ----
    const handleCleanExit = useCallback(() => {
        // clear pending timeout
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        setSessionId(null);
        setSessionUsers([]);
        setFriends([]);
        setSelectedColor('#cccccc');
        setIsHost(false);
        setHasRegistered(false);
    }, []);

        // --- SECURE MESSAGING ---
    const secureEmit = (eventName, data, callback) => {
        // these events are "public" because the server needs to read the data to manage 
        // rooms and identify users
        const infrastructureEvents = [
            'join-session', 
            'create-session', 
            'update-user', 
            'leave-session',
            'send-message',
            'send-direct-message',
            'join-dm',
            'transfer-host',
            'remove-user',
            'end-session',
            'edit-message',
            'delete-message'
        ];

        if (infrastructureEvents.includes(eventName)) {
            socket.emit(eventName, data, callback);
        } else {
            // future encryption here
            socket.emit(eventName, data, callback);
        }
    };  

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
    const markAsRead = useCallback((roomID) => {
        setCurrentActiveRoom(roomID);
        setUnreadRooms(prev => prev.filter(id => id !== roomID));
    }, []);

    // --- VOLUNTARILY LEAVING A SESSION ---
    const onLeave = () => {
        if (isHost && friends.length > 1) {
        // if host is leaving but there are 2 or more other users, require transfer of ownership first
        Alert.alert(
            "Host transfer required.",
            "You are the host! Please transfer ownership before leaving the session.",
            [{ text: "OK", style: "cancel" }]
        );
        } else if (isHost && friends.length === 1) { // only one other user, auto-transfer host 
            Alert.alert(
                "Confirm Leave?",
                "Are you sure you'd like to leave the session?",
                [{ text: "No", style: "cancel" }, 
                 { text: "Yes", onPress: () => {
                        secureEmit('transfer-host', { 
                            roomID: sessionId, 
                            newHostUUID: friends[0].id 
                        }, (response) => {
                            if (response && response.success) {
                                secureEmit('leave-session', sessionId);
                                handleCleanExit();
                            } else {
                                Alert.alert("Transfer failed.", "Could not transfer host. Please try again.");
                            }
                        });
                     }
                  }]
            );
        } else { // if no one else is in the session or user is not host, just leave
            Alert.alert(
                "Are you sure?",
                "Are you sure you'd like to leave the session?",
                [{ text: "No", style: "cancel" }, 
                 { text: "Yes", style: "destructive",
                    onPress: () => {
                        secureEmit('leave-session', sessionId);
                        handleCleanExit();
                    }
                  }]
            );
        }
    };

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
        const playJoinSound = async () => {
            try {
                const { sound } = await Audio.Sound.createAsync(require('./assets/ding.mp3'));
                await sound.playAsync();
                // unload sound after playing to save memory
                sound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) sound.unloadAsync();
                });
            } catch (error) {
                console.log("Error playing sound:", error);
            }
        };

        // --- HANDLERS ---
        const onConnect = () => {
            console.log("Connected", socket.id);
            setIsConnected(true);
            isConnectingRef.current = false;

            // clear overlay immediately on connect
            setIsReconnecting(false);
            if (showOverlayTimeoutRef.current) {
                clearTimeout(showOverlayTimeoutRef.current);
                showOverlayTimeoutRef.current = null;
            }

            // silent rejoin logic
            if (sessionIdRef.current && userUUID) {
                console.log("Attempting silent rejoin for: ", sessionIdRef.current);
                socket.emit('join-session', {
                    roomID: sessionIdRef.current,
                    existingUUID: userUUID
                }, (response) => {
                    if (response && response.exists) {
                        console.log("Rejoin successful");
                        if (response.alreadyRegistered) {
                            setName(desanitize(response.userData.name));
                            setSelectedColor(response.userData.color);
                            setHasRegistered(true);
                        } else {
                            console.log("User still in setup phase, staying on Profile.");
                        }
                    } else {
                        handleCleanExit();
                    }
                });
            }

            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        };

        const onDisconnect = (reason) => {
            console.log("Disconnected:", reason);
            setIsConnected(false);

            // if clean disconnect (server kicked us or we left),don't show overlay
            if (reason === "io server disconnect" || reason === "io client disconnect") {
                handleCleanExit();
                return;
            }
            // if accidental drop, start grace period
            // if 'io server disconnect', the server kicked us, so exit immediately
            // const isAccidental = reason == "transport close" || reason === "ping timeout";
            if (sessionIdRef.current) {
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
            // notify and play sound if someone joins
            setSessionUsers((prev) => {
                // second check prevents notifications for initial join for user regarding others already in session
                if (cleanUsers.length > prev.length && prev.length !== 0) {
                    const joinedUser = cleanUsers.find(u => !prev.some(p => p.id === u.id));
                    // notify only if joined user is not self
                    if (joinedUser && joinedUser.id !== userUUID) {
                        playJoinSound();
                        showNotification({ 
                            title: `👤 ${joinedUser.name} `, 
                            message: "has joined the session.",
                            type: 'info'
                        });
                    }
                }
                if (cleanUsers.length < prev.length) {
                    const leftUser = prev.find(p => !cleanUsers.some(u => u.id === p.id));
                    // notify only if left user is not self
                    if (leftUser) {
                        showNotification({ 
                            title: `👤 ${leftUser.name} `, 
                            message: "has left the session.",
                            type: 'info'
                        });
                    }
                }
                return cleanUsers;
            });

            const otherUsers = cleanUsers.filter(u => u.id !== userUUID);
            setFriends(otherUsers);
        };

        // message appears immediately on sender's screen, then updates when the server confirms it
        const onReceiveMessage = (messageData) => {
            const desanitizedMessage = {
                ...messageData,
                sender: desanitize(messageData.sender),
                context: {
                    ...messageData.context,
                    text: desanitize(messageData.context.text)
                },
                status: 'sent'
            };

            setAllMessages(prev => {
                const roomID = desanitizedMessage.roomID;
                const roomMsgs = prev[roomID] || [];
                // check if we already have a "local" version of this message
                // look for message with same text/sender that doesn't have a server timestamp yet
                // check if this is a message we sent that the server is returning
                const existingMsgIndex = roomMsgs.findIndex(m => m.id === desanitizedMessage.id);
                // if message is marked locally as failed, the server broadcast is arriving for message
                if (existingMsgIndex !== -1) {
                    const updatedMsgs = [...roomMsgs];
                    updatedMsgs[existingMsgIndex] = {
                        ...roomMsgs[existingMsgIndex],
                        ...desanitizedMessage,
                        status: 'sent'
                    };
                    return { ...prev, [roomID]: updatedMsgs };
                }
                // otherwise, just add the new message
                return {
                    ...prev,
                    [roomID]: [desanitizedMessage, ...roomMsgs]
                };
            });

            // unread logic
            // console.log("activeRoomRef.current: ", activeRoomRef.current);
            // console.log("messageData.roomID: ", messageData.roomID);
            if (desanitizedMessage.roomID !== activeRoomRef.current) {
                setUnreadRooms(prev => {
                    // if the room is already in unread list, do nothing
                    if (prev.includes(desanitizedMessage.roomID)) return prev;
                    // otherwise add it to the list
                    return [...prev, desanitizedMessage.roomID];
                });
                const isDM = desanitizedMessage.roomID.includes('_');
                showNotification({ 
                    title: isDM ? (`👤 ${desanitizedMessage.sender}`) : (`💬 ${desanitizedMessage.sender}`), 
                    message: desanitizedMessage.context.text,
                    roomID: desanitizedMessage.roomID,
                    isDM: isDM,
                    type: 'info'
                });
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
        socket.on('session-ended', onSessionEnded);
        socket.on('removed-from-session', onRemoved);
        socket.on('host-change', onHostChange);
        
        // ---DETACH (cleanup) --- 
        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('user-update', onUserUpdate);
            socket.off('receive-message', onReceiveMessage);
            socket.off('session-ended', onSessionEnded);
            socket.off('removed-from-session', onRemoved);
            socket.off('host-change', onHostChange);
        };
    }, [socket, userUUID, showNotification, handleCleanExit]); 

    return (
        <UserContext.Provider value={{
            name, setName, selectedColor, setSelectedColor, hasRegistered, 
            setHasRegistered, socket, isConnected, sessionId, setSessionId, sessionUsers, setSessionUsers, secureEmit,
            handleCleanExit, isHost, setIsHost, allMessages, setAllMessages, justCreatedSession, userUUID, setUserUUID,
            onLeave, unreadRooms, setUnreadRooms, markAsRead, friends, setFriends, desanitize, isReconnecting
        }}>
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
                            const { roomID, isDM, title } = notification;
                            setNotification(null);
                                if (roomID)    {
                                    navigationRef.navigate('Chat', { 
                                        isDirectMessage: isDM,
                                        dmRoomID: isDM ? roomID : null,
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
