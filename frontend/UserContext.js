// app's long-term memory and its connection to the outside world (the socket)

// ---- IMPORTS -----
import React, { useState, createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { Alert, TouchableOpacity, View, Text, Animated, StyleSheet, PanResponder } from 'react-native';
import socket from './socket';
import { Audio } from 'expo-av';
import { navigationRef } from './navigationService';

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
    const justCreatedSession = useRef(false);

    
    const slideAnim = useRef(new Animated.Value(-100)).current;
    const hideTimeout = useRef(null);

    // --- SHOW NOTIFICATION FUNCTION ---
    const showNotification = useCallback((data) => {
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

    // --- CLEANUP FUNCTION ----
    const handleCleanExit = useCallback(() => {
        setHasRegistered(false);
        setSessionId(null);
        setSessionUsers([]);
        setSelectedColor("#a0220c");
        setIsHost(false);

        if (navigationRef.isReady() && navigationRef.getCurrentRoute()?.name !== 'Login') {
            navigationRef.reset({
            index: 0,
            routes: [{ name: 'Login' }]
            });
        }
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

    // ----- Handle global user updates & connection -----

    // keep a ref to the latest sessionId for cleanup on disconnect
    const sessionIdRef = useRef(sessionId);
    useEffect(() => {
        sessionIdRef.current = sessionId;
    }, [sessionId]);

    // manually poke socket every 5 seconds if it's taking too long to realize the server is back
    const isConnectingRef = useRef(false);
    useEffect(() => {
        const interval = setInterval(() => {
            if (!socket.connected && !isConnectingRef.current) {
                console.log("Socket disconnected, attempting to reconnect...");
                isConnectingRef.current = true;
                socket.disconnect().connect();
            }            
        }, 5000); // every 5 seconds

        return () => clearInterval(interval);
    }, []);

    // keep ref in sync with state, don't need the other useEffect to run every time
    // a new session is created where isHost -> true for creator
    const isHostRef = useRef(isHost);
    useEffect(() => {
        isHostRef.current = isHost;
    }, [isHost]);

    // if socket changes (app starts up): 
    // if connecting set connection status to true
    // if disconnecting/connection drops then start cleanup
    // if user-update is sent then play sound and update user list
    const listenersAttached = useRef(false);
    useEffect(() => {
        if (!socket || listenersAttached.current) return;

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

        setIsConnected(socket.connected);
                    
        socket.on('connect', () => {
            console.log("Connected to server with ID:", socket.id);
            setIsConnected(true);
            isConnectingRef.current = false; // reset the flag upon successful connection
        });

        socket.on('disconnect', (reason) => {
            setIsConnected(false);
            isConnectingRef.current = false;
            console.log("Disconnected from server:", reason);
            if (sessionIdRef.current) handleCleanExit();
        });

        socket.on('user-update', (sessionUsers) => {
            // logic for sound
            setSessionUsers((prev) => {
                if (sessionUsers.length > prev.length && prev.length !== 0) {
                    playJoinSound();
                }
                return sessionUsers;
            });
        });

        socket.on('session-ended', () => {
            if (!isHostRef.current)    {
                Alert.alert("The host has ended the session.");
            }
            handleCleanExit();
        });

        socket.on('removed-from-session', () => {
            Alert.alert("You have been removed from the session by the host.");
            handleCleanExit();
        });

        socket.on('host-change', (newHostId) => {
            if (socket.id === newHostId) {
                if (!justCreatedSession.current) {
                    showNotification({ 
                        title: "👑 System Update", 
                        message: "You are now the host of this session.",
                        type: 'info'
                    });
                }
                setIsHost(true);
            } else {
                setIsHost(false);
            }
            justCreatedSession.current = false;
        });

        socket.on('receive-message', (data) => {
            // saves messages to chat history
            setAllMessages((prevMessages) => ({
                ...prevMessages,
                [data.roomID]: [...(prevMessages[data.roomID] || []), data]
            }));

            // check if user is already viewing this chat
            const currentParams = navigationRef.getCurrentRoute()?.params; 
            const isActiveRoom = currentParams?.roomID === data.roomID || currentParams?.dmRoomID === data.roomID;
            if (isActiveRoom) return;

            // show notification
            const notificationTitle = data.isDirectMessage ? `💬 ${data.sender}` : `👥 General Chat (${data.sender})`;
            showNotification({
                title: notificationTitle,
                message: data.context?.text || "New message",
                roomID: data.roomID,
                fromID: data.id,
                isDM: data.isDirectMessage
            });
        });

        listenersAttached.current = true;
        
        // cleanup 
        return () => {
            console.log("App refreshing or unmounting. Refreshing socket listeners...");
            socket.off('connect');
            socket.off('disconnect');
            socket.off('user-update');
            socket.off('session-ended');
            socket.off('removed-from-session');
            socket.off('host-change');
            socket.off('new-dm-notification');
            socket.off('receive-message');

            isConnectingRef.current = false;
            listenersAttached.current = false;
        };
    }, [showNotification, handleCleanExit]); // empy to ensure it only runs once on mount

    return (
        <UserContext.Provider value={{
            name, setName, selectedColor, setSelectedColor, hasRegistered, 
            setHasRegistered, socket, isConnected, sessionId, setSessionId, sessionUsers, setSessionUsers, secureEmit,
            handleCleanExit, isHost, setIsHost, allMessages, setAllMessages, justCreatedSession
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


const styles = StyleSheet.create({
    notificationBar: {
        position: 'absolute',
        top: 10, // Below the notch/status bar
        left: 10,
        right: 10,
        backgroundColor: '#333',
        padding: 15,
        borderRadius: 10,
        elevation: 10, // Shadow for Android
        shadowColor: '#000', // Shadow for iOS
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        zIndex: 9999,
    },
    notificationTitle: { 
        color: '#fff', 
        fontWeight: 'bold' 
    },
    notificationText: { 
        color: '#ccc', 
        fontSize: 12 
    }
});

// create "hook" to make using this data easy
export const useUser = () => useContext(UserContext);