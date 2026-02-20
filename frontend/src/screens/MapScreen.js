// MapScreen.js
import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { styles } from "../styles/styles";
import { useUser } from '../context/UserContext';
import { useMapLogic } from '../hooks/useMapLogic';


export default function MapScreen({ navigation }) {
    const map = useMapLogic({ navigation });
    
    const insets = useSafeAreaInsets();
    

    return (
        <View style={styles.container}>
            <View style={[styles.customHeader, { height: 60 + insets.top, paddingTop: insets.top }]}>
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