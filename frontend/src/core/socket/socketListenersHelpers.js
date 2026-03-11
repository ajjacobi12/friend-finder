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
    const showDisconnectionOverlay = (isReconnecting, isConnected) => {
        if (showOverlayTimeoutRef.current) clearTimeout(showOverlayTimeoutRef.current);
        showOverlayTimeoutRef.current = setTimeout(() => {
            if (!isConnected) {
                setIsReconnecting(true);
                console.log("[DISCONNECT] Showing disconnection overlay. isReconnectingRef:", isReconnecting);
            }
            // remove overlay once timer finishes
            showOverlayTimeoutRef.current = null;
        }, 1500);
    };

    // ------------------- onUSERUPDATE -------------------
    // sound & notification logic for user joining/leaving
    const playJoinSound = () => {
        if (player.playing) {
            player.seekTo(0); // restart sound if already playing
        }
        player.play();
    };

    const joinAndLeaveLogic = (newUsers, oldUsers) => {
        // user joining notification & sound logic
        const { userUUID } = stateRef.current;
        if (newUsers.length > oldUsers.length && oldUsers.length !== 0) {
            const joinedUser = newUsers.find(u => !oldUsers.some(p => p.uuid === u.uuid));
            // notify only if joined user is not self
            if (joinedUser && joinedUser.uuid !== userUUID) {
                playJoinSound();
                emitUserJoined({ 
                    title: `👤 ${joinedUser.name} `, 
                    message: "has joined the session.",
                    type: 'info'
                });
            }
        }

        // user leaving notification & sound logic
        if (newUsers.length < oldUsers.length) {
            const leftUser = oldUsers.find(p => !newUsers.some(u => u.uuid === p.uuid));
            // notify only if left user is not self
            if (leftUser) {
                emitUserLeft({ 
                    title: `👤 ${leftUser.name} `, 
                    message: "has left the session.",
                    type: 'info'
                });
            }
        }
    };

    // ------------------- GENERAL MESSAGING -------------------
    const getSenderName = (sessionUsers, senderUUID) => {
        const sender = sessionUsers.find(f => f.uuid === senderUUID);
        const name = sender ? desanitize(sender.name) : "Someone";

        return name;
    };

    // ------------------- onRECEIVEMSG -------------------
    const saveMsg = (chatRoomID, msgID, msgData) => {
        setChatHistory(prev => {
            const roomMsgs = prev[chatRoomID] || [];

            // if local version of message received already exists (which theoretically should never happen)
            //     then update it. If not, then add it
            return {
                ...prev,
                [chatRoomID]: { ...roomMsgs, [msgID]: { ...(roomMsgs[msgID] || {}), ...msgData }}
            };
        });
    };

    const handleUnreadMsg = (chatRoomID, activeRoom, name, msgData) => {
        if (chatRoomID !== activeRoom) {
            setUnreadRooms(prev => {
                // if the room is already in unread list, do nothing
                if (prev.includes(chatRoomID)) return prev;
                // otherwise add it to the list
                return [...prev, chatRoomID];
            });
            const isDM = chatRoomID.includes('_');
            emitMsg({
                title: isDM ? (`👤 ${name}`) : (`💬 ${name}`), 
                message: msgData.context.text,
                chatRoomID: chatRoomID,
                isDM: isDM,
                type: 'info'
            });
        }
    };

    // ------------------- onHOSTCHANGE -------------------
    const handleHostChange = (userUUID, newHostUUID, isHost) => {
        const amIHost = userUUID === newHostUUID;

        if (amIHost && !justCreatedSession.current && !isHost) {
            emitYouAreHost({ 
                title: "👑 System Update", 
                message: "You are now the host of this session.",
                type: 'info'
            });
        } 
        setIsHost(amIHost);
        justCreatedSession.current = false;
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