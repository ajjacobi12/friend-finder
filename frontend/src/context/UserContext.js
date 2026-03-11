// frontend/src/context/UserContext.js

// ---- IMPORTS -----
import React, { useState, useRef, createContext, useContext, useEffect, useMemo } from 'react';

import socket from '../api/socket';

import { useIdentityManager } from '../core/identity/useIdentityManager';
import { useChatServices } from '../core/chat/useChatServices'
import { useSessionLifecycle } from '../core/session/useSessionLifecycle';
import { useSocketListeners } from '../core/socket/useSocketListeners';

// create context object (empty container) to hold global data
const UserContext = createContext();

// create provider component
// "wraps" the app and provides the data to everyone inside
// "children" are the components wrapped by UserProvider
export const UserProvider = ({ children }) => {

    // set states
    const [name, setName] = useState('');
    const [color, setColor] = useState(null);  // used to be "selectedColor" and "setSelectedColor"
    const [hasRegistered, setHasRegistered] = useState(false);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [sessionID, setSessionID] = useState(null);
    const [sessionUsers, setSessionUsers] = useState([]);
    const [isHost, setIsHost] = useState(false);
    const [chatHistory, setChatHistory] = useState({});
    const [userUUID, setUserUUID] = useState(null);
    const [unreadRooms, setUnreadRooms] = useState([]);
    const [activeRoom, setActiveRoom] = useState(null);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [isRebooting, setIsRebooting] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    // standalone refs
    const justCreatedSession = useRef(false);

    // state refs
    const stateRef = useRef({
        name, color, isHost, hasRegistered,
        sessionID, userUUID, sessionUsers,
        activeRoom, 
        isConnected, isReconnecting, isLoading,
        isRebooting
    });

    // keep refs in synce with states
    useEffect(() => {
        stateRef.current = {
            name, color, isHost, hasRegistered,
            sessionID, userUUID, sessionUsers,
            activeRoom,
            isConnected, isReconnecting, isLoading,
            isRebooting
        };
    }, [name, color, isHost, sessionID, userUUID, sessionUsers, 
        activeRoom, isConnected, isReconnecting, isLoading, isRebooting]);

    // keeps friends in sync with sessionUsers
    const friends = useMemo(() => {
        return sessionUsers.filter(u => u.uuid !== userUUID);
    }, [sessionUsers, userUUID]);

    // keep online connection status updated
    useEffect(() => {
        const { userUUID } = stateRef.current;
        if (userUUID) {
            setSessionUsers(prev => prev.map(u => 
                u.uuid === userUUID ? { ...u, status: isConnected ? 'online' : 'offline' } : u
            ));
        }
    }, [isConnected]);

    // functions for setting states, refs, saved preferences (async storage), and the "ID badge" attached to the socket
    const { setAllThingsIdentity, setAllThingsPrefs, updateDiskPrefs } = useIdentityManager({ 
        setUserUUID, setSessionID, setName, setColor, stateRef 
    });

    // also contains reboot useEffect
    const { handleCleanExit, finalizeSession } = useSessionLifecycle({
        stateRef,
        setAllThingsIdentity, setAllThingsPrefs,  
        setName, setColor, setSessionID, setIsHost,
        setSessionUsers, setHasRegistered, 
        setIsReconnecting, setIsLoading, setIsRebooting
    });

    // mark messages as unread and update local message
    const { markAsRead, updateLocalMsg } = useChatServices(
        stateRef, setActiveRoom, setUnreadRooms, setChatHistory
    );    

    // socket listeners
    useSocketListeners({ stateRef, setSessionUsers, setIsConnected, setIsLoading, setIsReconnecting, 
        setUnreadRooms, setChatHistory, setIsHost,
        justCreatedSession, finalizeSession, handleCleanExit, updateLocalMsg 
    });

    const value = useMemo(() => ({
        name, setName, color, setColor, hasRegistered, 
        setHasRegistered, socket, isConnected, sessionID, setSessionID, sessionUsers, setSessionUsers,
        handleCleanExit, isHost, setIsHost, chatHistory, setChatHistory, justCreatedSession, userUUID, setUserUUID,
        unreadRooms, setUnreadRooms, markAsRead, friends, isReconnecting, updateLocalMsg,
        isLoading, setIsLoading, activeRoom, setActiveRoom,
        finalizeSession, updateDiskPrefs
    }), [name, color, hasRegistered, isConnected, isLoading, sessionID, sessionUsers, isHost, isReconnecting, 
        chatHistory, userUUID, friends, activeRoom, handleCleanExit, markAsRead, updateLocalMsg]);

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};

// create "hook" to make using this data easy
export const useUser = () => useContext(UserContext);