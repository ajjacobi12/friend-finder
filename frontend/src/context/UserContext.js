// frontend/src/context/UserContext.js

// ---- IMPORTS -----
import React, { useState, createContext, useContext, useEffect, useCallback, useRef, useMemo } from 'react';
import { Alert, TouchableOpacity, View, Text, Animated, PanResponder, ActivityIndicator } from 'react-native';
import { useAudioPlayer } from 'expo-audio';

import socket from '../api/socket';
import { navigationRef } from '../services/navigationService';
import { storageService } from '../services/storageService';
import { styles } from '../styles/styles';

import { joinSessionAction } from '../services/socketServices';


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
    const [isHost, setIsHost] = useState(false);
    const [notification, setNotification] = useState(null);
    const [allMessages, setAllMessages] = useState({});
    const [userUUID, setUserUUID] = useState(null);
    const [unreadRooms, setUnreadRooms] = useState([]);
    const [currentActiveRoom, setCurrentActiveRoom] = useState(null);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [isRehydrating, setIsRehydrating] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    const slideAnim = useRef(new Animated.Value(-100)).current;
    const hideTimeout = useRef(null);
    const showOverlayTimeoutRef = useRef(null);

    const justCreatedSession = useRef(false);
    const activeRoomRef = useRef(currentActiveRoom);

    const isConnectingRef = useRef(false);
    const isConnectedRef = useRef(isConnected);
    const isReconnectingRef = useRef(isReconnecting);
    const isLoadingRef = useRef(isLoading);
    const isRehydratingRef = useRef(isRehydrating);

    const nameRef = useRef(name);
    const selectedColorRef = useRef(selectedColor);
    const sessionIDRef = useRef(sessionID);
    const isHostRef = useRef(isHost);
    const userUUIDRef = useRef(userUUID);
    const sessionUsersRef = useRef(sessionUsers);

    const audioSource = require('../../assets/ding.mp3');
    const player = useAudioPlayer(audioSource);

    // using a ref removes the useEffect dependency on userUUID so it doesn't run 
    // (remove and re-attach every single socket listener) every time a user joins, userUUID, etc. changes
    // Sync all refs to state so socket listeners always see the truth
    useEffect(() => {
        nameRef.current = name;
        selectedColorRef.current = selectedColor;
        sessionIDRef.current = sessionID;
        isHostRef.current = isHost;
        userUUIDRef.current = userUUID;
        sessionUsersRef.current = sessionUsers;
        activeRoomRef.current = currentActiveRoom;
        isConnectedRef.current = isConnected;
        isReconnectingRef.current = isReconnecting;
        isLoadingRef.current = isLoading;
        isRehydratingRef.current = isRehydrating;
    }, [name, selectedColor, sessionID, isHost, currentActiveRoom, userUUID, sessionUsers, isConnected, 
        isReconnecting, isRehydrating]);

    // --- CLEANUP FUNCTION ----
    const handleCleanExit = useCallback(async (fullReset = false) => {

        if (fullReset) {
            await storageService.clearIdentity();
            await storageService.clearPrefs();
            setName('');
            setSelectedColor('#cccccc');
            nameRef.current = '';
            selectedColorRef.current = '#cccccc';
        }

        setSessionID(null);
        setSessionUsers([]);
        setIsHost(false);
        setHasRegistered(false);
        setIsReconnecting(false);
        setIsLoading(false);

        sessionIDRef.current = null;
        sessionUsersRef.current = [];
        isHostRef.current = false;
        isReconnectingRef.current = false;
        isLoadingRef.current = false;

        // remove socket "identity badges"
        socket.auth = { userUUID: null, sessionID: null };
    }, []);

    // runs once when app boots
    useEffect(() => {
        const rehydrate = async () => {
            try {
                const savedIdentity = await storageService.loadIdentity();
                const savedPrefs = await storageService.loadPrefs();
                console.log("Saved identity: ", savedIdentity);
                console.log("Saved prefs: ", savedPrefs);

                if (savedIdentity?.userUUID && savedIdentity?.sessionID) {
                    console.log(`[REHYDRATE] Found existing session: `, savedIdentity.sessionID);

                    // restore the state
                    setUserUUID(savedIdentity.userUUID);
                    setSessionID(savedIdentity.sessionID);
                    setName(savedPrefs?.name || "New User");
                    setSelectedColor(savedPrefs?.color || '#cccccc');

                    userUUIDRef.current = savedIdentity.userUUID;
                    sessionIDRef.current = savedIdentity.sessionID;
                    nameRef.current = savedPrefs?.name || "New User";
                    selectedColorRef.current = savedPrefs?.color || '#cccccc';

                    socket.auth = {
                        userUUID: savedIdentity.userUUID,
                        sessionID: savedIdentity.sessionID
                    };
                    
                    // validate with server immediately
                    try {
                        console.log(`[REHYDRATE] Trying joinSessionAction.`);

                        const response = await joinSessionAction(
                            savedIdentity.sessionID, 
                            savedIdentity.userUUID,
                            { name: (savedPrefs?.name || "New User"), color: (savedPrefs?.color || '#cccccc') }
                        );
                        // console.log("Response: ", response);
                        if (response.success) {
                            console.log(`[REHYDRATE] Successful joinSessionAction response.`);
                            setIsConnected(socket.connected);
                            isConnectedRef.current = socket.connected;

                            // skip login screeen
                            if (response.isRegistered) {
                                setHasRegistered(true);
                                setIsHost(response.isHost);
                                setSessionUsers(response.currentUsers || []);

                                isHostRef.current = response.isHost;
                                sessionUsersRef.current = response.currentUsers || [];
                            } else {
                                setHasRegistered(false);
                                if (navigationRef.isReady()) {
                                    navigationRef.navigate('Profile');
                                } else {
                                    console.log("NavigationRef not ready yet, directing user to login.");
                                }
                            }
                        } else {
                            console.log(`[REHYDRATE] Unsuccessful joinSessionAction response.`);

                            // session expired or reaped
                            await handleCleanExit(true);
                        }
                    } catch (err) {
                        // if server is unreachable, stay in 'reconnecting'
                        // if logic error (404), wipe it
                        if (err.message.includes("exist")) await handleCleanExit(true);
                    }
                }
            } catch (err) {
                console.error("Rehydration failed: ", err);
            } finally {
                setIsRehydrating(false);
                isRehydratingRef.current = false;
            }
        };   
        rehydrate();
    }, []);

    // change my connection status
    useEffect(() => {
        if (userUUID) {
            setSessionUsers(prev => prev.map(u => 
                u.uuid === userUUID ? { ...u, status: isConnected ? 'online' : 'offline' } : u
            ));
        }
    }, [isConnected, userUUID]);

    // update async storage
    const updateDiskIdentity = async (updates) => {
        const current = await storageService.loadIdentity();
        if (current) {
            await storageService.saveIdentity({ ...current, ...updates});
        }
    };

    const updateDiskPrefs = async (updates) => {
        const current = await storageService.loadPrefs();
        if (current) {
            await storageService.savePrefs({ ...current, ...updates});
        }
    };

    // --- SHOW NOTIFICATION FUNCTION ---
    const showNotification = useCallback((data) => {
        // console.log("notification triggered", data);
        // clear any existing timer
        if (hideTimeout.current) clearTimeout(hideTimeout.current);
        hideTimeout.current = null;

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
        setCurrentActiveRoom(chatRoomID);
        activeRoomRef.current = chatRoomID;
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
            chatRoomID, msgID, senderUUID, context, 
            serverTimestamp, timestamp,
        } = messageData;

        return {
            chatRoomID,
            msgID,
            senderUUID,
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
                if (joinedUser && joinedUser.uuid !== userUUIDRef.current) {
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
            isConnectingRef.current = false;

            // clear overlay immediately on reconnect
            if (showOverlayTimeoutRef.current) {
                clearTimeout(showOverlayTimeoutRef.current);
                showOverlayTimeoutRef.current = null;
            }

            // reset UI states
            setIsConnected(true);
            setIsLoading(false);
            setIsReconnecting(false);

            // don't do this if user is rebooting the app, only for brief drops & reconnections in service
            if (isRehydratingRef.current) {
                console.log("Rehydration logic is happening, stopping onConnect logic.");
                return;
            }

            console.log("[CONNECT] Connected:", socket.id);

            // ensures that if socket drops, the next reconnection attempt sends the "ID badge" automatically
            socket.auth = { userUUID: userUUIDRef.current, sessionID: sessionIDRef.current };

            // silent rejoin/reconnection logic for 
            if (sessionIDRef.current && userUUIDRef.current) {
                console.log("[SILENT REJOIN] attempt for user ", userUUIDRef.current);
                try {
                    const savedPrefs = await storageService.loadPrefs();
                    const currentName = savedPrefs?.name || nameRef.current;
                    const currentColor = savedPrefs?.color || selectedColorRef.current;

                    const response = await joinSessionAction(
                        sessionIDRef.current, 
                        userUUIDRef.current, 
                        { name: currentName, color: currentColor }
                    );

                    if (response.success) {
                        if (response.isRegistered) {
                            setName(desanitize(response.name));
                            setSelectedColor(response.color);
                            setIsHost(response.isHost);
                            setHasRegistered(true);
                            setSessionUsers(response.currentUsers || []);
                            console.log("[SILENT REJOIN] success. Restored profile.");
                        } else {
                            setIsHost(response.isHost);
                            setSessionUsers(response.currentUsers || []);
                            console.log("User still in setup phase, staying on Profile.");                       
                        }
                    } else {
                        // server said no (eg. session was deleted)
                        handleCleanExit(true);
                    }
                } catch (err) {
                    // only wipe if session is gone from database (404)
                    // if it's 505 or timeout, keep session and wait for next onConnect
                    const errorMsg = err.message.toLowerCase();
                    if (errorMsg.includes("not found") || errorMsg.includes("exist") || errorMsg.includes("expired")) {
                        console.log("[SILENT REJOIN] unsuccessful: ", err.message);
                        handleCleanExit(true);
                    }
                } finally {
                    setIsLoading(false);
                }
            }
        };

        const onDisconnect = (reason) => {
            console.log("Disconnected:", reason);
            setIsConnected(false);

            // if clean disconnect (server kicked us or we left), don't show overlay
            if (reason === "io server disconnect" || reason === "io client disconnect") {
                console.log("Permanent disconnect detected. Cleaning up.");
                handleCleanExit();
                return;
            }
            // if accidental drop,
            // const isAccidental = reason == "transport close" || reason === "ping timeout";
            if (sessionIDRef.current) {
                console.log("Temporary drop. Keeping session alive for reconnection.");

                // clear existing just in case
                // wait 1.5 seconds before showing "reconnecting" overlay
                if (showOverlayTimeoutRef.current) clearTimeout(showOverlayTimeoutRef.current);
                showOverlayTimeoutRef.current = setTimeout(() => {
                    if (!isConnectedRef.current) {
                        setIsReconnecting(true);
                        console.log("[DISCONNECT] Showing disconnection overlay. isReconnectingRef:", isReconnectingRef.current);
                    }
                    // remove overlay once timer finishes
                    showOverlayTimeoutRef.current = null;
                }, 1500);
            } 
        };

        const onUserUpdate = (users) => {
            const cleanUsers = users.map(u=> ({
                ...u,
                name: desanitize(u.name),
                status: 'online'
            }));

            setSessionUsers((prev) => {
                joinSoundLogic(cleanUsers, prev);
                leaveSoundLogic(cleanUsers, prev);
                return cleanUsers;
            });
        };

        // message appears immediately on sender's screen, then updates when the server confirms it
        const onReceiveMessage = (inboundData) => {
            const { chatRoomID, msgID } = inboundData;
            const messageData = formatMessageData(inboundData, 'sent');

            const sender = sessionUsersRef.current.find(f => f.uuid === messageData.senderUUID);
            const displayName = sender ? sender.name : "Someone";
 
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
                    title: isDM ? (`👤 ${displayName}`) : (`💬 ${displayName}`), 
                    message: messageData.context.text,
                    chatRoomID: chatRoomID,
                    isDM: isDM,
                    type: 'info'
                });
            }
        };

        const handleEditedByOthers = ({ chatRoomID, msgID, newText }) => {
            try {
                updateLocalMessage(chatRoomID, msgID, { 
                    isEdited: true,
                    newText: desanitize(newText)  
                });
            } catch (err) {
                console.log("[MSG] edit error, ", err.message);
            }
        };

        const handleDeletedByOthers = ({ chatRoomID, msgID, senderUUID }) => {  
            const sender = sessionUsersRef.current.find(u => u.uuid === senderUUID);
            const name = sender ? sender.name : "A user";

            try {
                updateLocalMessage(chatRoomID, msgID, {
                    isDeleted: true,
                    newText: `${desanitize(name)} removed this message.`
                });
            } catch (err) {
                console.log("[MSG] deletion error, ", err.message);
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
            const amIHost = userUUIDRef.current === newHostUUID;
            
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

        const onStatusChange = ({ userUUID, status }) => {
            setSessionUsers(prev => prev.map(u =>
                u.uuid === userUUID ? {...u, status } : u
            ));
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
        socket.on('user-status-change', onStatusChange);
        
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
            socket.off('user-status-change', onStatusChange);
        };
    }, [socket, showNotification, handleCleanExit]); 

    const friends = useMemo(() => {
        return sessionUsers.filter(u => u.uuid !== userUUID);
    }, [sessionUsers, userUUID]);

    const value = useMemo(() => ({
        name, setName, selectedColor, setSelectedColor, hasRegistered, 
        setHasRegistered, socket, isConnected, sessionID, setSessionID, sessionUsers, setSessionUsers,
        handleCleanExit, isHost, setIsHost, allMessages, setAllMessages, justCreatedSession, userUUID, setUserUUID,
        unreadRooms, setUnreadRooms, markAsRead, friends, desanitize, isReconnecting, updateLocalMessage,
        formatMessageData, updateDiskIdentity, updateDiskPrefs, isLoading, setIsLoading, currentActiveRoom, setCurrentActiveRoom
    }), [name, selectedColor, hasRegistered, isConnected, isLoading, sessionID, sessionUsers, isHost, isReconnecting, 
        allMessages, userUUID, friends, currentActiveRoom, handleCleanExit, markAsRead]);

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