// frontend/src/context/DisconnectOverlay
import { Text, View, ActivityIndicator } from 'react-native';

import { styles } from '../styles/styles';

export const DisconnectOverlay = ({ isReconnecting }) => {

    return (
        <View style={[styles.reconnectingOverlay, !isReconnecting && { backgroundColor: 'transparent' }]}>
            {/* spinner and text only visible once isReconnecting is true, which is a disconnection > 1.5 s */}
            {isReconnecting && (
                <View style={styles.reconnectBox}>
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text style={styles.reconnectingText}>Reconnecting to server...</Text>
                </View>
            )}   
        </View>
    );
};