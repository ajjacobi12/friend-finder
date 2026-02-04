// SidebarUserItem.js
import React, { useCallback } from 'react';
import { Pressable, Text, View, FlatList } from 'react-native';
import Modal from 'react-native-modal';
import { styles } from '../../styles';
import { useChatLogic } from '../hooks/useChatLogic';
import { useUser } from '../../UserContext';

// this doesn't need to constantly re-render, so we wrap it in React.memo
// just visual component for each user in the sidebar list
const SidebarUserItem = React.memo(({ item, isUnread, onChatPress }) => {
    return (
        <Pressable
            onPress={() => onChatPress(item)}
            style={[
                styles.userItem,
                {
                    borderLeftWidth: 4,
                    borderLeftColor: isUnread ? item.color : 'transparent',
                    backgroundColor: isUnread ? item.color + '20' : 'transparent',
                }
            ]}
        >
            <View style={[styles.userDot, { backgroundColor: item.color, marginLeft: 5 }]} />
            <View style={{ flex: 1 }}>
                <Text style={[styles.userName, isUnread && { fontWeight: 'bold' } ]}>
                    {item.name}
                </Text>
            </View>
            {isUnread ? (
                <Text style={{ color: item.color, fontWeight: 'bold', fontSize: 15}}>NEW   </Text>
            ) : (
            <Text style={{color: '#999'}}>Chat ➔</Text>
            )}
        </Pressable>
    );
});

export default function Sidebar({ isVisible, setIsSidebarVisible, navigation }) {
    const { friends, unreadRooms, userUUID } = useUser();

    // passing navigation on to chat logic hook so it can navigate to chat screen
    const chat = useChatLogic({ navigation });
    
    const renderUser = useCallback(( { item }) => {
        const itemDmRoomId = [userUUID, item.id].sort().join('_');
        const isUnread = unreadRooms.includes(itemDmRoomId);

        return (
            <SidebarUserItem
                item={item}
                isUnread={isUnread}
                onChatPress={(user) => {
                    chat.startPrivateChat(user, () => setIsSidebarVisible(false));
                }}
            />
        );
    }, [userUUID, unreadRooms, chat.startPrivateChat, setIsSidebarVisible]);

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
                    keyExtractor={(item) => item.id}
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