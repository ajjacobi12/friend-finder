import React from 'react';
import { View, Text } from 'react-native';
import { styles } from "../styles";

export default function ChatScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.statusText}>💬 Messages</Text>
            <View style={styles.statusCard}>
                <Text style={styles.messageText}>
                    Chat coming soon!
                </Text>
            </View>
        </View>
    );
}