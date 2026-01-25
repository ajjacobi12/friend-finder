import React from 'react';
import { View, Text } from 'react-native';
import { styles } from "../styles";

export default function MapScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.statusText}>🗺️ Friend Map</Text>
            <View style={styles.statusCard}>
                <Text style={styles.messageText}>
                    Map coming soon!
                </Text>
            </View>
        </View>
    );
}