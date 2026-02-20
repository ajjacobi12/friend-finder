// HostTransferModal.js
import React from 'react';
import { View, Text, Modal, Pressable, FlatList, StyleSheet } from 'react-native';
import HomeUserItem from './HomeUserItem';

const HostTransferModal = ({ visible, onClose, friends, onTransfer }) => {
    return (
        <Modal visible={visible} transparent={true} animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Pressable onPress={onClose} hitSlop={15}>
                            <Text style={styles.backArrow}>←</Text>
                        </Pressable>
                        <Text style={styles.title}>Transfer Ownership</Text>
                    </View>

                    <Text style={styles.subtitle}>
                        You must appoint a new host before leaving the session.
                    </Text>

                    <FlatList
                        data={friends}
                        keyExtractor={(item) => item.uuid}
                        renderItem={({ item }) => (
                            <HomeUserItem
                                friend={item}
                                isHost={true}
                                isTransferOnly={true} // Hides the "Remove" button
                                onTransfer={onTransfer}
                            />
                        )}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: '85%',
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        maxHeight: '70%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    backArrow: { fontSize: 28, marginRight: 15 },
    title: { fontSize: 18, fontWeight: 'bold' },
    subtitle: { color: '#666', marginBottom: 20, lineHeight: 20 },
});

export default HostTransferModal;