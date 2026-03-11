// frontend/src/context/NotificationProvider.js
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Animated, PanResponder, TouchableOpacity, Text, View, ActivityIndicator } from 'react-native';
import { subscribeToNotifications } from '../core/session/notificationService';
import { navigationRef } from '../core/session/navigationService';
import { styles } from '../styles/styles';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const { isConnected, isReconnecting } = useUser();

    const [notification, setNotification] = useState(null);
    const slideAnim = useRef(new Animated.Value(-100)).current;
    const hideTimeout = useRef(null);

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
            onMoveShouldSetPanResponder: (event, gestureState) => Math.abs(gestureState.dy) > 5,
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

    useEffect(() => {
        // This subscription replaces the direct calls inside UserContext
        return subscribeToNotifications((data) => {
            showNotification(data);
        });
    }, [showNotification]);

    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}

            {/* notifications */}
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

            {/* overlay during disconnection */}
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

        </NotificationContext.Provider>
    );

};

export const useNotification = () => useContext(NotificationContext);