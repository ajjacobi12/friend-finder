// frontend/src/context/NotificationProvider.js
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Animated, PanResponder, TouchableOpacity, Text } from 'react-native';

import { subscribeToNotifications } from '../core/session/notificationService';
import { navigationRef } from '../core/session/navigationService';
import { styles } from '../styles/styles';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {

    const [notification, setNotification] = useState(null);
    const slideAnim = useRef(new Animated.Value(-100)).current;
    const hideTimeout = useRef(null);

    // --- SHOW NOTIFICATION FUNCTION ---
    const showNotification = useCallback((data) => {
        if (hideTimeout.current) clearTimeout(hideTimeout.current);
        hideTimeout.current = null;

        setNotification(data);

        Animated.spring(slideAnim, {
            toValue: 65,
            useNativeDriver: true,
            tension: 50,
            friction: 8
        }).start();

        hideTimeout.current = setTimeout(() => {
            Animated.timing(slideAnim, {
                toValue: -100,
                duration: 300,
                useNativeDriver: true,
            }).start(() => setNotification(null));
        }, 5000);   
    }, [slideAnim]);

    // --- REMOVE NOTIFICATION ---
    const hideNotification = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (event, gestureState) => Math.abs(gestureState.dy) > 5,
            onPanResponderMove: (event, gestureState) => {
                if (gestureState.dy < 0) { 
                    slideAnim.setValue(65 + gestureState.dy);
                }
            },
            onPanResponderRelease: (event, gestureState) => {
                if (gestureState.dy < -20) {
                    if (hideTimeout.current) clearTimeout(hideTimeout.current);
                    Animated.timing(slideAnim, {
                        toValue: -100,
                        duration: 200,
                        useNativeDriver: true,
                    }).start(() => setNotification(null));
                } else {
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
        </NotificationContext.Provider>
    );

};

export const useNotification = () => useContext(NotificationContext);