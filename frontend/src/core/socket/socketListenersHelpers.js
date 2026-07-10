// frontend/src/core/socket/socketListenersHelpers.js
import socket from '../../api/socket';

import { emitMsg, emitUserJoined, emitUserLeft, emitYouAreHost } from '../session/notificationService';
import { desanitize } from '../chat/chatUtils';

export const socketListenersHelpers = (config) => {

    const {stateRef, setIsConnected, setIsLoading, setIsReconnecting, setChatHistory, setUnreadRooms, setIsHost, 
        justCreatedSession, player, showOverlayTimeoutRef} = config;

    // --------------------------- onCONNECT -------------------
    // reset the UI 
    const resetConnectionUI = () => {
        console.log("[CONNECT] Connected:", socket.id);

        // clear overlay immediately on reconnect
        if (showOverlayTimeoutRef.current) {
            clearTimeout(showOverlayTimeoutRef.current);
            showOverlayTimeoutRef.current = null;
        }

        // reset UI states
        setIsConnected(true);
        setIsLoading(false);
        setIsReconnecting(false);

        // set the refs right away too
        stateRef.current = {
            ...stateRef.current,
            isConnected: true,
            isLoading: false,
            isReconnecting: false
        };
    };

    // --------------------------- onDISCONNECT -------------------
    const showDisconnectionOverlay = () => {
        if (showOverlayTimeoutRef.current) clearTimeout(showOverlayTimeoutRef.current);
        showOverlayTimeoutRef.current = setTimeout(() => {
            if (!stateRef.current.isConnected) {
                setIsReconnecting(true);
                stateRef.current.isReconnecting = true;
                console.log("[DISCONNECT] Showing disconnection overlay. isReconnectingRef:", stateRef.current.isReconnecting);
            }
            // remove overlay once timer finishes
            showOverlayTimeoutRef.current = null;
        }, 1500);
    };

    // ------------------- onUSERUPDATE -------------------
    // sound & notification logic for user joining/leaving
    const playJoinSound = () => {
        if (player) {
            player.seekTo(0); // restart sound if already playing
            player.play();
        }
    };

    const joinAndLeaveLogic = (newUsers, oldUsers) => {
        // user joining
        const { userUUID } = stateRef.current;
        if (newUsers.length > oldUsers.length && oldUsers.length !== 0) {
            const joinedUser = newUsers.find(u => !oldUsers.some(p => p.uuid === u.uuid));

            if (joinedUser && joinedUser.uuid !== userUUID) {
                playJoinSound();
                setTimeout(() => {
                    emitUserJoined({ 
                        title: `👤 ${joinedUser.name}`, 
                        message: "has joined the session.",
                        type: 'info'
                    });
                }, 0);
            }
        }

        // user leaving
        if (newUsers.length < oldUsers.length) {
            const leftUser = oldUsers.find(p => !newUsers.some(u => u.uuid === p.uuid));

            if (leftUser) {
                setTimeout(() => {
                    emitUserLeft({ 
                        title: `👤 ${leftUser.name}`, 
                        message: "has left the session.",
                        type: 'info'
                    });
                }, 0);
            }
        }
    };

    // ------------------- GENERAL MESSAGING -------------------
    const getSenderName = (senderUUID) => {
        const { sessionUsers } = stateRef.current;
        const sender = sessionUsers.find(f => f.uuid === senderUUID);
        const name = sender ? desanitize(sender.name) : "Someone";

        return name;
    };

    // ------------------- onRECEIVEMSG -------------------
    const saveMsg = (chatRoomID, msgID, msgData) => {
        setChatHistory(prev => {
            const roomMsgs = prev[chatRoomID] || [];

            return {
                ...prev,
                [chatRoomID]: { ...roomMsgs, [msgID]: { ...(roomMsgs[msgID] || {}), ...msgData }}
            };
        });
    };

    const handleUnreadMsg = (chatRoomID, activeRoom, name, msgData) => {
        if (chatRoomID !== activeRoom) {
            setUnreadRooms(prev => {
                if (prev.includes(chatRoomID)) return prev;
                return [...prev, chatRoomID];
            });
            const isDM = chatRoomID.includes('_');
            setTimeout(() => {
                emitMsg({
                    title: isDM ? (`👤 ${name}`) : (`💬 ${name}`), 
                    message: msgData.context.text,
                    chatRoomID: chatRoomID,
                    isDM: isDM,
                    type: 'info'
                });
            }, 0);
        }
    };

    // ------------------- onHOSTCHANGE -------------------
    const handleHostChange = (newHostUUID) => {
        const { userUUID, isHost } = stateRef.current;

        if (justCreatedSession.current) return;

        const amIHost = userUUID === newHostUUID;
        if (amIHost && !justCreatedSession.current && !isHost) {
            setTimeout(() => {
                emitYouAreHost({ 
                    title: "👑 System Update", 
                    message: "You are now the host of this session.",
                    type: 'info'
                });
            })
        } 

        setTimeout(() => {
            setIsHost(amIHost);
            justCreatedSession.current = false;
        }, 0);
    };


    return {
        resetConnectionUI,
        showDisconnectionOverlay,
        joinAndLeaveLogic,
        getSenderName,
        saveMsg,
        handleUnreadMsg,
        handleHostChange,
    };

};