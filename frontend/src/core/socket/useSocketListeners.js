// frontend/src/core/socket/useSocketListeners.js
import React, { useEffect, useRef, useMemo } from 'react';
import { Alert } from 'react-native';

import { socketListenersHelpers } from './socketListenersHelpers';
import { joinSessionAction } from './socketServices';

import { identityStorage, KEYS } from '../identity/identityStorage';
import { desanitize, formatMsgData } from '../chat/chatUtils';

import socket from '../../api/socket';

const audioSource = require('../../../assets/ding.mp3');

export const useSocketListeners = (config) => {
    
    const { stateRef, setSessionUsers, setIsConnected, setIsLoading, setIsReconnecting, 
        setUnreadRooms, setChatHistory, setIsHost,
        justCreatedSession, finalizeSession, handleCleanExit, updateLocalMsg } = config;

    // --------------------- CONSTANTS & REFS ---------------------
    // sound for users joining and leaving & overlay 
    const player = useAudioPlayer(audioSource);

    const showOverlayTimeoutRef = useRef(null);

    // --------------------- HELPER FUNCTIONS ---------------------
    const { resetConnectionUI, showDisconnectionOverlay, joinAndLeaveLogic, getSenderName, saveMsg, handleUnreadMsg, handleHostChange } = useMemo(() => socketListenersHelpers({
        stateRef, setIsConnected, setIsLoading, setIsReconnecting, setChatHistory, setUnreadRooms, setIsHost, 
        justCreatedSession, player, showOverlayTimeoutRef}), 
        [stateRef, setIsConnected, setIsLoading, setIsReconnecting, setChatHistory, setUnreadRooms, setIsHost, justCreatedSession, player]);

    // ----- CORE SOCKET LISTENERS -----
    // if socket changes (app starts up): 
    // if connecting set connection status to true
    // if disconnecting/connection drops then start cleanup
    // if is sent then play sound and update user list
    useEffect(() => {

        // --- CONNECTION HANDLER ---
        const onConnect = async () => {
            const { isRebooting, userUUID, sessionID } = stateRef.current;

            resetConnectionUI();

            // don't do this if user is rebooting the app, only for brief drops & reconnections in service
            if (isRebooting) {
                console.log("Reboot logic is happening, stopping onConnect logic.");
                return;
            }
            if (!sessionID || !userUUID) {
                console.log("[CONNECT] No sessionID or userUUID. Silent rejoin stopped.");
                return;
            }
            console.log("[CONNECT] Silent rejoin attempt for user ", userUUID);

            // ensures that if socket drops, the next reconnection attempt sends the "ID badge" automatically
            socket.auth = { userUUID, sessionID };
            
            // silent rejoin/reconnection logic
            try {
                const response = await joinSessionAction(
                    sessionID, 
                    userUUID
                );
                await finalizeSession(response, false, 'CONNNECT/REJOIN')
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
        };

        const onDisconnect = (reason) => {
            const { sessionID, isReconnecting, isConnected } = stateRef.current;

            try {
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
                if (sessionID) {
                    console.log("Temporary drop. Keeping session alive for reconnection.");
                    
                    // upon disconnection immediately imploy a clear overlay to prevent user from clicking anything
                    // after 1.5s show a loading symbol
                    showDisconnectionOverlay(isReconnecting, isConnected);
                } 
            } catch (err) {
                console.log("[DISCONNECTION] error:", err.message);
            }
        };

        // update user list for either change in profile or change in number of users
        const onUserUpdate = (users) => {
            try {
                const cleanUsers = users.map(u => {
                    if (!u.name || !u.color) {
                        throw new Error(`[USER UPDATE] Missing identity data for UUID: ${u.uuid}`);
                    }
                    return {
                        ...u,
                        name: desanitize(u.name),
                        color: u.color,
                        status: 'online'
                    }
                });

                setSessionUsers((prev) => {
                    // sound and notification logic for users joining/leaving
                    joinAndLeaveLogic(cleanUsers, prev);
                    return cleanUsers;
                });
            } catch (err) {
                console.log("[USER UPDATE] error:", err.message);
            }
        };

        // message appears immediately on sender's screen, then updates when the server confirms it
        const onReceiveMsg = (inboundData) => {
            const { chatRoomID, msgID } = inboundData;
            const { sessionUsers, activeRoom } = stateRef.current;

            try {
                // format message data, get name of sender
                const msgData = formatMsgData(inboundData, 'sent');

                const senderUUID = msgData.senderUUID;
                const name = getSenderName(sessionUsers, senderUUID);
                
                // save message to local storage
                saveMsg(chatRoomID, msgID, msgData);

                // if user is not focused on chatroom, add it to unreadrooms list and emit notification
                handleUnreadMsg(chatRoomID, activeRoom, name, msgData);
            } catch (err) {
                console.log("[RECEIVE MSG] error:", err.message);
            }
        };

        const handleEditedByOthers = ({ chatRoomID, msgID, newText }) => {
            try {
                // update local storage of edited message, replace with new text
                updateLocalMsg(chatRoomID, msgID, { 
                    isEdited: true,
                    newText: desanitize(newText)  
                });
            } catch (err) {
                console.log("[MSG] edit error, ", err.message);
            }
        };

        const handleDeletedByOthers = ({ chatRoomID, msgID, senderUUID }) => {  
            const { sessionUsers } = stateRef.current;

            try {
                const name = getSenderName(sessionUsers, senderUUID);
                // update local storage of deleted message
                // replace old text with "... removed this message", but keep a record that it once existed
                updateLocalMsg(chatRoomID, msgID, {
                    isDeleted: true,
                    newText: `${name} removed this message.`
                });
            } catch (err) {
                console.log("[MSG] deletion error, ", err.message);
            }
        };

        const onSessionEnded = () => {
            const { isHost } = stateRef.current;
            try {
                // alert user session has ended and perform local data storage cleanup
                if (!isHost) Alert.alert("The host has ended the session.");
                handleCleanExit();
            } catch (err) {
                console.log("[END SESSION] error:", err.message);
            }
        };

        const onRemoved = () => {
            try {
                // alert user they were removed and perform local data storage cleanup
                Alert.alert("Removed", "The host removed you from the session.");
                handleCleanExit();
            } catch (err) {
                console.log("[REMOVE USER] error:", err.message);
            }
        };

        const onHostChange = (newHostUUID) => {
            const { userUUID, isHost } = stateRef.current;
            try {
                // sets locally stored host status and sends notification
                handleHostChange(userUUID, newHostUUID, isHost);
            } catch (err) {
                console.log("[HOST CHANGE] error:", err.message);
            }
        };

        const onStatusChange = ({ userUUID, status }) => {
            try {
                // change locally stored connection status
                setSessionUsers(prev => prev.map(u =>
                    u.uuid === userUUID ? {...u, status } : u
                ));
            } catch (err) {
                console.log("[STATUS CHANGE] error:", err.message);
            }
        };

        // --- ATTACH ---
                    
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('user-update', onUserUpdate);
        socket.on('receive-message', onReceiveMsg);
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
            socket.off('receive-message', onReceiveMsg);
            socket.off('message-deleted', handleDeletedByOthers);
            socket.off('message-edited', handleEditedByOthers);
            socket.off('session-ended', onSessionEnded);
            socket.off('removed-from-session', onRemoved);
            socket.off('host-change', onHostChange);
            socket.off('user-status-change', onStatusChange);
        };
    }, [socket, handleCleanExit]); 

};