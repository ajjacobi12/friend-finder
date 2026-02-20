// HomeUserItem.js
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import TextTicker from 'react-native-text-ticker';

import { styles } from '../../styles/styles';

const HomeUserItem = React.memo(({ friend, isHost, onTransfer, onRemove, isTransferOnly = false }) => {
    return (
        <View style={[
            styles.friendBadge, { 
                borderColor: friend.color || '#ccc', 
                backgroundColor: friend.color + '25', 
                borderWidth: 2, 
                paddingHorizontal: 10, 
                overflow: 'hidden', 
                marginTop: 10
            }]}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: '100%' }}>
                <Text style={{ fontSize: 17, fontFamily: 'Courier', includeFontPadding: false, textAlignVertical: 'center', height: 50, lineHeight: 50 }}>
                    {isTransferOnly? '👤 ' : (friend.isHost ? '👑 ' : '👤 ')}
                </Text>
                <TextTicker 
                    key={`ticker-${friend.uuid}`}
                    style={{ fontSize: 18, flex: 1, marginRight: 10, fontFamily: 'Courier', includeFontPadding: false, textAlignVertical: 'center', height: 50, lineHeight: 30 }}
                    duration={7000}
                    loop bounce scroll={true}
                    repeatSpacer={50}
                    marqueeDelay={1000}
                >
                    {friend.name} 
                </TextTicker>
            </View>

            {isHost && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
                    <Pressable
                        onPress={() => onTransfer(friend)}
                        style={{ marginLeft: 30 }}>
                        <Text style={{ fontSize: 20 }}>👑 </Text>
                    </Pressable>

                    {!isTransferOnly && (
                        <Pressable
                            onPress={() => onRemove(friend)}
                            style={{ marginLeft: 10 }}>
                            <Text style={{ color: 'red', fontWeight: 'bold', fontSize: 17 }}>Remove</Text>
                        </Pressable>
                    )}
                </View>
            )}
        </View>
    );
});

export default HomeUserItem;