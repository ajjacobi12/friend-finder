// SidebarItem.js
import React, { useCallback } from 'react';
import { Pressable, Text, View, FlatList } from 'react-native';
import Modal from 'react-native-modal';

import { styles } from '../../styles/styles';
import { useUser } from '../../context/UserContext';

// logic helper, sorts userUUIDs in ascending order then joins with a '_' to keep it consistent
// across both users
const getRoomID = (id1, id2) => [id1, id2].sort().join('_');

// this doesn't need to constantly re-render, so we wrap it in React.memo
// just visual component for each user in the sidebar list
const SidebarItem = React.memo(({ item, isUnread, onChatPress }) => {
    const { name, color } = item;

    return (
        <Pressable
            onPress={() => onChatPress(item)}
            style={[
                styles.userItem,
                {
                    borderLeftWidth: 4,
                    borderLeftColor: isUnread ? color : 'transparent',
                    backgroundColor: isUnread ? color + '20' : 'transparent',
                }
            ]}
        >
            <View style={[styles.userDot, { backgroundColor: color, marginLeft: 5 }]} />
            <View style={{ flex: 1 }}>
                <Text style={[styles.userName, isUnread && { fontWeight: 'bold' } ]}>
                    {name}
                </Text>
            </View>
            {isUnread ? (
                <Text style={{ color: color, fontWeight: 'bold', fontSize: 15}}>NEW   </Text>
            ) : (
            <Text style={{color: '#999'}}>Chat ➔</Text>
            )}
        </Pressable>
    );
});

export default function Sidebar({ isVisible, setIsSidebarVisible, navigation }) {
    const { friends, unreadRooms, userUUID } = useUser();

    // --- OPEN DM ---
    const startPrivateChat = useCallback((targetUser) => {
        setIsSidebarVisible(false);

        // create unique room id for both people
        const DMroomID = getRoomID(userUUID, targetUser.uuid);

        // define the navigation parameters
        navigation.navigate('Chat', {
            isDirectMessage: true,
            DMroomID,
            recipientName: targetUser.name,
        });
    }, [userUUID, navigation, setIsSidebarVisible]);
    
    const renderUser = useCallback(( { item }) => {
        const itemDmRoomId = getRoomID(userUUID, item.uuid);
        const isUnread = unreadRooms.includes(itemDmRoomId);

        return (
            <SidebarItem
                item={item}
                isUnread={isUnread}
                onChatPress={startPrivateChat}
            />
        );
    }, [userUUID, unreadRooms, startPrivateChat]);

    return (
        <Modal
            isVisible={isVisible}
            onBackdropPress={() => setIsSidebarVisible(false)}
            onBackButtonPress={() => setIsSidebarVisible(false)}
            onSwipeComplete={() => setIsSidebarVisible(false)}
            swipeDirection="right"
            animationIn="slideInRight"
            animationOut="slideOutRight"
            animationOutTiming={300}
            hideModalContentWhileAnimating={true}
            swipeThreshold={50}
            useNativeDriver={true}
            useNativeDriverForBackdrop={true}
            backdropTransitionOutTiming={0}
            backdropColor='#f5f5f5'
            style={{ margin: 0, justifyContent: 'flex-end', flexDirection: 'row' }}
            backdropOpacity={0.3}
        >
            <View style={styles.sidebarContainer}>
                <View style={styles.sidebarHeader}>
                    <Text style={styles.sidebarTitle}>Direct Messages</Text>
                    <Pressable onPress={() => setIsSidebarVisible(false)}>
                        <Text style={{ fontSize: 24, fontWeight: 'bold', padding: 10 }}>✕</Text>
                    </Pressable>
                </View>
                <FlatList
                    data={friends}
                    renderItem={renderUser}
                    keyExtractor={(item) => item.uuid}
                    initialNumToRender={10}
                    windowSize={5}
                    ListEmptyComponent={() => (
                        <View style={{ marginTop: 20, alignItems: 'center' }}>
                            <Text style={{ color: '#999', fontStyle: 'italic' }}>
                                No other users online right now.
                            </Text>
                        </View>
                    )}
                />
            </View>
        </Modal>           
    );
}