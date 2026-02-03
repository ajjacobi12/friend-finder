import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

export function useSessionBackHandler(onLeaveAction) {
    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                onLeaveAction();
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [onLeaveAction])
    );
}