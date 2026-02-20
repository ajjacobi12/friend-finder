// ColorOptions.js

import React from 'react';
import { Pressable, View } from 'react-native';
import { styles } from '../../styles/styles';

export const ColorPicker = ({ options, isSelected, friends, onSelect }) => {
    return (
        <View style={styles.colorContainer}>
        {options.map((color) => {
            const isTaken = friends.some(f => f.color === color);
            return(
                <Pressable
                    key={color}
                    disabled={isTaken}
                    style={[
                        styles.colorCircle,
                        { backgroundColor: color }, 
                        isTaken && { opacity: 0.3, borderColor: '#696969', borderWidth: 3},
                        isSelected === color && { borderWidth: 3, borderColor: '#000000' }
                    ]}
                    onPress={() => onSelect(color) }
                />
            );
        })}
        </View>
    );
};

export default ColorPicker;