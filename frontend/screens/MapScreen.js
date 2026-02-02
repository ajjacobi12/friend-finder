import React from 'react';
import { View, Text } from 'react-native';
import { styles } from "../styles";
import { useUser } from '../UserContext';
import { useSessionBackHandler } from '../hooks/useSessionBackHandler';


export default function MapScreen() {
    const { onLeave } = useUser();
    
    // take care of android "back" button
    useSessionBackHandler(onLeave);

    return (
        <View style={styles.container}>
            <View style={styles.customHeader}>
                <View/>
                <View style={styles.absoluteHeaderTitle}>
                    <Text style={{ fontFamily: 'Courier', fontSize: 30, fontWeight: 'bold', marginTop: 0 }}>🗺️ Map</Text>
                </View>
                <View/>
            </View>

            <View style={[styles.contentWrapper, { justifyContent: 'center' }]}>
                <View style={styles.statusCard}>
                    <Text style={styles.messageText}>
                        Map coming soon!
                    </Text>
                </View>
            </View>
        </View>
    );
}