// useMapLogic.js
import React, { useCallback } from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { styles } from "../styles/styles";
import { useUser } from '../context/UserContext';
import { useSessionBackHandler } from './useSessionBackHandler';


export const useMapLogic = ({ navigation }) => {

    // take care of android "back" button
    const onLeaveMap = useCallback(() => {
        navigation.navigate('Home' );
        return true;
    }, [ navigation ]);
    useSessionBackHandler(onLeaveMap);

    return {};

};