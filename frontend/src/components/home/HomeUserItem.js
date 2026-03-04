// HomeUserItem.js
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import TextTicker from 'react-native-text-ticker';

import { styles } from '../../styles/styles';

const HomeUserItem = React.memo(({ friend, isHost, onTransfer, onRemove, isTransferOnly = false }) => {

    const isOnline = friend.status === 'online';

    return (
        <View style={[
            styles.friendBadge, { 
                borderColor: friend.color || '#ccc', 
                backgroundColor:  friend.color + '25', 
                borderWidth: 2, 
                paddingHorizontal: 10, 
                overflow: 'hidden', 
                marginTop: 10,
                opacity: isOnline ? 1.0 : 0.5
            }]}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: '100%' }}>
               
                {/* connection status dot */}
                <View style={{ width: 15, height: 15, borderRadius: 10, borderWidth: 2, borderColor: isOnline ? '#37b327' : '#7a7979', backgroundColor: isOnline? '#44db44' : '#999', marginTop: 4 }} />
                <Text style={{ fontSize: 17, fontFamily: 'Courier', includeFontPadding: false, textAlignVertical: 'center', height: 50, lineHeight: 50 }}>
                    {isTransferOnly ? '👤 ' : null }
                </Text>
                <TextTicker 
                    key={`ticker-${friend.uuid}`}
                    style={{ fontSize: 20, flex: 1, marginRight: 10, fontFamily: 'Courier', includeFontPadding: false, textAlignVertical: 'center', height: 50, lineHeight: 30 }}
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
                        <Text style={{ fontSize: 20, lineHeight: 0, marginBottom: 3 }}>👑 </Text>
                    </Pressable>

                    {!isTransferOnly && (
                        <Pressable
                            onPress={() => onRemove(friend)}
                            style={{ marginLeft: 10 }}>
                            <Text style={{ color: 'red', fontWeight: 'bold', fontSize: 20, marginTop: 2 }}>X</Text>
                        </Pressable>
                    )}
                </View>
            )}
        </View>
    );
});

export default HomeUserItem;