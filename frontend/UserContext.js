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
    const [selectedColor, setSelectedColor] = useState('#da2d0e');
    const [takenColors, setTakenColors] = useState([]);
    const [hasRegistered, setHasRegistered] = useState(false);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [sessionId, setSessionId] = useState(null);
    const [friends, setFriends] = useState([]);

    // --- CLEANUP FUNCTION ----
    const handleCleanExit = useCallback(() => {
        setHasRegistered(false);
        setSessionId(null);
        setFriends([]);
        setTakenColors([]);
        setSelectedColor(null);

        if (navigationRef.isReady()) {
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

    // 1. Handle session joining/leaving
    useEffect(() => {
        if (sessionId) { 
            secureEmit('join-session', sessionId); // sends event named 'join-session' to backend (request to join session)
            return () => {
                secureEmit('leave-session', sessionId);
            };
            // cleanup: tell server you are leaving old session before joining
            // new one or closing the app
        }
    }, [sessionId]); // passes sessionId as payload to backend
    // whenever sessionId changes, tell the server I want to join that room
    // React monitors value of sessionId, if it re-renders but remains the same, React skips effect to save resources

    // 2. Handle global user updates & connection
    useEffect(() => {
        // sound stuff
        const playJoinSound = async () => {
            const { sound } = await Audio.Sound.createAsync(require('./assets/ding.mp3'));
            await sound.playAsync();
            // unload sound after playing to save memory
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) sound.unloadAsync();
            });
        };

        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));

        socket.on('user-update', (userList) => {
            // filter users by current sessionID
            const sessionUsers = userList.filter(u => u.sessionId === sessionId);

            // logic for sound
            setFriends((prev) => {
                if (sessionUsers.length < prev.length && prev.length !== 0){
                    console.log("Someone left the session");
                }
                else if (sessionUsers.length > prev.length && prev.length !== 0) {
                    playJoinSound();
                }
                return sessionUsers;
            });

            // update taken colors
            const colors = sessionUsers.map(u => u.color.toLowerCase());
            setTakenColors(colors);
        });
        
        // cleanup -- stop listening if app closes
        return () => {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('user-update');
        };
    }, [sessionId]); // re-run listener if sessionId changes to ensure correct filtering


    // --- GLOBAL LISTENER ---
    useEffect(() => {
        socket.on('session-terminated', () => {
            alert("The session has expired due to inactivity.");
            handleCleanExit();
        });

        return () => {
            socket.off('session-terminated');
        };
    }, [handleCleanExit]);

    return (
        <UserContext.Provider value={{
            name, setName, selectedColor, setSelectedColor, takenColors, setTakenColors, hasRegistered, 
            setHasRegistered, socket, isConnected, sessionId, setSessionId, friends, setFriends, secureEmit,
            handleCleanExit
        }}>
            {children}
        </UserContext.Provider>
    );
};

// create "hook" to make using this data easy
export const useUser = () => useContext(UserContext);