// app's long-term memory and its connection to the outside world (the socket)

// ---- IMPORTS -----
import React, { useState, createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { Alert, TouchableOpacity, View, Text, Animated, PanResponder } from 'react-native';
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
    const [isHost, setIsHost] = useState(false);
    const [notification, setNotification] = useState(null);
    const [allMessages, setAllMessages] = useState({});
    const [userUUID, setUserUUID] = useState(null);

    const slideAnim = useRef(new Animated.Value(-100)).current;
    const hideTimeout = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const isConnectingRef = useRef(false);
    const justCreatedSession = useRef(false);

    const sessionIdRef = useRef(sessionId);
    const isHostRef = useRef(isHost);

    // keep a ref to the latest sessionId for cleanup on disconnect
    useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
    useEffect(() => { isHostRef.current = isHost; }, [isHost]);

    // --- CLEANUP FUNCTION ----
    const handleCleanExit = useCallback(() => {
        // clear pending timeout
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        setSessionId(null);
        setSessionUsers([]);
        setSelectedColor("#a0220c");
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
            'end-session'
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
        console.log("notification triggered", data);
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
                            newHostId: friends[0].id 
                        }, () => {
                            secureEmit('leave-session', sessionId);
                            handleCleanExit();
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

    // --- CONNECTION MANAGER ---
    // manually poke socket every 5 seconds if it's taking too long to realize the server is back
    useEffect(() => {
        const interval = setInterval(() => {
            if (!socket.connected && !isConnectingRef.current) {
                console.log("Socket disconnected, attempting to reconnect...");
                isConnectingRef.current = true;
                socket.connect();
            }            
        }, 5000); // every 5 seconds
        return () => clearInterval(interval);
    }, []);


    // ----- CORE SOCKET LISTENERS -----
    // if socket changes (app starts up): 
    // if connecting set connection status to true
    // if disconnecting/connection drops then start cleanup
    // if user-update is sent then play sound and update user list
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

            // silent rejoin logic
            if (sessionIdRef.current && userUUID) {
                console.log("Attempting silent rejoin for: ", sessionIdRef.current);
                socket.emit('join-session', {
                    roomID: sessionIdRef.current,
                    existingUUID: userUUID
                }, (response) => {
                    if (response.exists) {
                        console.log("Rejoin successful");
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
            isConnectingRef.current = false;
            // if accidental drop, start grace period
            // if 'io server disconnect', the server kicked us, so exit immediately
            const isAccidental = reason == "transport close" || reason === "ping timeout";
            if (sessionIdRef.current && isAccidental) {
                reconnectTimeoutRef.current = setTimeout(() => {
                    handleCleanExit();
                }, 15000);
            } else if (reason === "io server disconnect") {
                handleCleanExit();
            }
        };

        const onUserUpdate = (users) => {
            setSessionUsers((prev) => {
                if (users.length > prev.length && prev.length !== 0) playJoinSound();
                return users;
            });
        };

        const onReceiveMessage = (data) => {
            setAllMessages((prev) => {
                const roomMsgs = prev[data.roomID] || [];
                if (roomMsgs.some(m => m.id === data.id)) return prev;
                return { ...prev, [data.roomID]: [...roomMsgs, data] };
            });

            const route = navigationRef.getCurrentRoute();
            const isViewing = (route?.name === 'Chat' && (data.roomID === route.params?.roomID || data.roomID === route.params?.dmRoomID));
            if (!isViewing) {
                showNotification({
                    title: data.isDirectMessage ? `💬 ${data.sender}` : `👥 General Chat (${data.sender})`,
                    message: data.context?.text || "New message",
                    roomID: data.roomID,
                    isDM: data.isDirectMessage
                });
            }
        };

        const onSessionEnded = () => {
            if (!isHostRef.current)    {
                Alert.alert("The host has ended the session.");
            }
            handleCleanExit();
        };

        const onRemoved = () => {
            Alert.alert("Removed", "The host removed you from the session.");
            handleCleanExit();
        };

        const onHostChange = (newHostUUID) => {
            const amIHost = userUUID === newHostUUID;
            if (amIHost && !justCreatedSession.current) {
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
    }, [userUUID, showNotification, handleCleanExit]); // empy to ensure it only runs once on mount

    return (
        <UserContext.Provider value={{
            name, setName, selectedColor, setSelectedColor, hasRegistered, 
            setHasRegistered, socket, isConnected, sessionId, setSessionId, sessionUsers, setSessionUsers, secureEmit,
            handleCleanExit, isHost, setIsHost, allMessages, setAllMessages, justCreatedSession, userUUID, setUserUUID,
            onLeave
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
                            setNotification(null);
                                if (notification.roomID)    {
                                    navigationRef.navigate('Chat', { 
                                        isDirectMessage: notification.isDM,
                                        roomID: !notification.isDM ? notification.roomID : undefined,
                                        dmRoomID: notification.isDM ? notification.roomID : undefined,
                                        recipientName: notification.isDM ? notification.title.replace('💬 ', '') : undefined,
                                    });
                                }
                        }}
                    >
                        <Text style={[styles.notificationTitle, {marginBottom: 2}]}>{notification.title}</Text>
                        <Text style={styles.notificationText} numberOfLines={1}>{notification.message}</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}
        </UserContext.Provider>
    );
};

// create "hook" to make using this data easy
export const useUser = () => useContext(UserContext);
