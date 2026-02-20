// MessageItem.js
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { styles } from '../../styles/styles';

const MessageItem = React.memo(({ item, userUUID, onLongPress, onResend, editTimeLimit }) => {
    const { 
        msgID, 
        senderUUID, senderName, 
        context, 
        status, 
        serverTimestamp, timestamp, 
        isDeleted, isEdited 
    } = item;

    const isFailed = status === 'failed';
    const isPending = status === 'pending';
    const isMine = senderUUID === userUUID;

    const handleLongPress = () => {
        // no actions on failed, pending, or deleted messages
        if (isFailed || isPending || isDeleted) return; 

        // only allow edits/deletes on own messages within time limit
        const baseTime = serverTimestamp || timestamp || Date.now();
        const isWithinTime = Date.now() - baseTime < editTimeLimit;
        const canEdit = isMine && !isDeleted && isWithinTime;

        onLongPress(item, canEdit);
    };

    return (
        <Pressable
            onLongPress={handleLongPress}
            delayLongPress={200}
            style={[
                styles.messageBubble, 
                isMine ? styles.myMessage : styles.theirMessage,
                isFailed && { opacity: 0.7, borderColor: 'red', borderWidth: 1},
                isPending && {opacity: 0.6 },
                isDeleted && styles.deletedBubble
            ]}
        >
            {/* --- SENDER & TIMESTAMP --- */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontWeight: 'bold', color: '#555', fontSize: 12 }}>
                    {isMine ? 'You' : (senderName)} • { serverTimestamp
                        ? new Date(serverTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : isMine ? (isFailed ? "Failed" : "Sending...") : "Just now" }
                </Text>
            </View>

            {/* --- DELETED MESSAGE OR TEXT --- */}
            {isDeleted ? (
                <Text style={{ fontStyle: 'italic', color: '#666', fontSize: 16, marginTop: 5 }}>
                    Message deleted
                </Text>
            ) : (
                <Text style={{ fontSize: 16, marginTop: 5 }}>{context.text}</Text>
            )}

            {/* --- EDITED LABEL & RETRY BUTTON --- */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 }}>
                {!!isEdited && !isDeleted && (
                    <Text style={{ fontStyle: 'italic', color: '#666', fontSize: 10, marginTop: 2 }}>
                        (Edited)
                    </Text>
                )}

                {/* --- RESEND BUTTON FOR FAILED MESSAGES --- */}
                {isFailed && (
                    <Pressable 
                        onPress={() => onResend(item)}
                        hitSlop={15}
                        style={{ backgroundColor: '#ff4444', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}
                    >
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 10 }}>Retry</Text>
                    </Pressable>
                )}
            </View>
        </Pressable>
    );
});

export default MessageItem;