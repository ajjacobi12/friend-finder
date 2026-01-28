// app's long-term memory and its connection to the outside world (the socket)

// ---- IMPORTS -----
import React, { useState, createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
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
            if (!isHost)    {
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
                Alert.alert("You are now the host of this session.");
                setIsHost(true);
            } else {
                setIsHost(false);
            }
        });

        listenersAttached.current = true;
        
        // cleanup -- stop listening if app closes
        return () => {
            console.log("App refreshing or unmounting. Disconnecting socket...");
            socket.off('connect');
            socket.off('disconnect');
            socket.off('user-update');
            socket.off('session-ended');
            socket.off('removed-from-session');
            socket.off('host-change');

            isConnectingRef.current = false;
            listenersAttached.current = false;
        };
    }, [handleCleanExit]); // re-run listener if sessionId changes to ensure correct filtering

    return (
        <UserContext.Provider value={{
            name, setName, selectedColor, setSelectedColor, hasRegistered, 
            setHasRegistered, socket, isConnected, sessionId, setSessionId, sessionUsers, setSessionUsers, secureEmit,
            handleCleanExit, isHost, setIsHost
        }}>
            {children}
        </UserContext.Provider>
    );
};

// create "hook" to make using this data easy
export const useUser = () => useContext(UserContext);