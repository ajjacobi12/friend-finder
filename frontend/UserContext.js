// app's long-term memory and its connection to the outside world (the socket)

// ---- IMPORTS -----
import React, { useState, createContext, useContext, useEffect, useCallback } from 'react';
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
    const [friends, setFriends] = useState([]);

    // --- CLEANUP FUNCTION ----
    const handleCleanExit = useCallback(() => {
        setHasRegistered(false);
        setSessionId(null);
        setFriends([]);
        setSelectedColor("#cccccc");

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
        ];

        if (infrastructureEvents.includes(eventName)) {
            socket.emit(eventName, data, callback);
        } else {
            // future encryption here
            socket.emit(eventName, data, callback);
        }
    };


    // Handle global user updates & connection
    useEffect(() => {
        if (!socket) return;

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
        
        socket.on('connect', () => setIsConnected(true));

        socket.on('disconnect', (reason) => {
            setIsConnected(false);
            console.log("Disconnected from server:", reason);

            if (sessionId) {
                handleCleanExit();
            }
        });

        socket.on('user-update', (userList) => {
            // logic for sound
            setFriends((prev) => {
                if (userList.length > prev.length && prev.length !== 0) {
                    playJoinSound();
                }
                return userList;
            });

        });
        
        // cleanup -- stop listening if app closes
        return () => {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('user-update');
        };
    }, [sessionId, socket, handleCleanExit]); // re-run listener if sessionId changes to ensure correct filtering

    return (
        <UserContext.Provider value={{
            name, setName, selectedColor, setSelectedColor, hasRegistered, 
            setHasRegistered, socket, isConnected, sessionId, setSessionId, friends, setFriends, secureEmit,
            handleCleanExit
        }}>
            {children}
        </UserContext.Provider>
    );
};

// create "hook" to make using this data easy
export const useUser = () => useContext(UserContext);