// MessageItem.js
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { styles } from '../../styles';

const MessageItem = React.memo(({ item, userUUID, onLongPress, onResend, editTimeLimit }) => {
    console.log(`Rendering message item: ${item.id}`); 

    const isFailed = item.status === 'failed';
    const isPending = item.status === 'pending';
    const isMine = item.senderUUID === userUUID;

    const handleLongPress = () => {
        if (isFailed || isPending) return; // no actions on failed messages

        const timestamp = item.serverTimestamp || Date.now();
        const isWithinTime = Date.now() - timestamp < editTimeLimit;
        const canEdit = isMine && !item.isDeleted && isWithinTime;
        // only allow edits/deletes on own messages within time limit
        onLongPress(item, canEdit);
    };

    return (
        <Pressable
            onLongPress={handleLongPress}
            delayLongPress={200}
            style={[
                styles.messageBubble, 
                item.senderUUID === userUUID ? styles.myMessage : styles.theirMessage,
                isFailed && { opacity: 0.7, borderColor: 'red', borderWidth: 1},
                isPending && {opacity: 0.6 },
                item.isDeleted && styles.deletedBubble
            ]}
        >
            {/* --- SENDER & TIMESTAMP --- */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontWeight: 'bold', color: item.color, fontSize: 12 }}>
                    {item.sender} • { item.serverTimestamp
                        ? new Date(item.serverTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : isMine ? (isFailed ? "Failed" : "Sending...") : "Just now" }
                </Text>
            </View>

            {/* --- DELETED MESSAGE OR TEXT --- */}
            {item.isDeleted ? (
                <Text style={{ fontStyle: 'italic', color: '#666', fontSize: 16, marginTop: 5 }}>
                    Message deleted
                </Text>
            ) : (
                <Text style={{ fontSize: 16, marginTop: 5 }}>{item.context.text}</Text>
            )}

            {/* --- EDITED LABEL & RETRY BUTTON --- */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 }}>
                {item.isEdited && !item.isDeleted && (
                    <Text style={{ fontStyle: 'italic', color: '#666', fontSize: 10, marginTop: 2 }}>
                        (edited)
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