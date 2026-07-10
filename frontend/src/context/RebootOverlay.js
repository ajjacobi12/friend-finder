// frontend/src/context/RebootOverlay
import { Text, View, ActivityIndicator } from 'react-native';

import { styles } from '../styles/styles';

export const RebootOverlay = () => {
    
    return (
        <View style={[styles.reconnectingOverlay, { backgroundColor: 'white' }]}>
            <ActivityIndicator size="large" color="#000000" />
            <Text style={[styles.reconnectingText, { color: 'black' }]}>Connecting...</Text>
        </View>
    );
};