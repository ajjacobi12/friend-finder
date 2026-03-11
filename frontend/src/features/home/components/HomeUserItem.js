// frontend/src/features/home/components/HomeUserItem.js
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import TextTicker from 'react-native-text-ticker';
import { Ionicons } from '@expo/vector-icons';

import { styles } from '../../../styles/styles';

const HomeUserItem = React.memo(({ friend, isHost, onTransfer, onRemove, isTransferOnly = false }) => {

    const isOnline = friend.status === 'online';

    return (
        <View style={[
            styles.friendBadge, { 
                borderColor: friend.color || '#ccc', 
                backgroundColor:  friend.color + '25', 
                borderWidth: 2, 
                paddingHorizontal: 10, 
                // overflow: 'hidden', 
                marginTop: 10,
                opacity: isOnline ? 1.0 : 0.5
            }]}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: '100%' }}>
               
                {/* connection status dot */}
                <View style={{ 
                    width: 15, height: 15, 
                    marginTop: 2,
                    borderRadius: 10, borderWidth: 2, borderColor: isOnline ? '#48e948' : '#7a7979', 
                    backgroundColor: isOnline? '#44db44' : '#999', 
                    shadowColor: isOnline ? '#4bf24b' : '#7a7979', shadowOffset: { width: 0, height: 0}, shadowRadius: 5, elevation: 5, shadowOpacity: 1,
                    zIndex: 10
                }} />
                <Text style={{ fontSize: 17, fontFamily: 'Courier', includeFontPadding: false, textAlignVertical: 'center', height: 50, lineHeight: 50 }}>
                    {isTransferOnly ? '👤 ' : null }
                </Text>
                <TextTicker 
                    key={`ticker-${friend.uuid}-${friend.isHost}`}
                    style={{ fontSize: 22, flex: 1, marginRight: 10, fontFamily: 'Courier', includeFontPadding: false, textAlignVertical: 'center', height: 50, lineHeight: 30 }}
                    duration={7000}
                    loop bounce scroll={true}
                    repeatSpacer={50}
                    marqueeDelay={1000}
                >
                    {friend.name} 
                </TextTicker>
            </View>


                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
                    {friend.isHost && (
                        <Ionicons 
                            name="shield-checkmark"
                            size={22}
                            color="#FFD700"
                            style={{
                                shadowColor: "#ecde8f", 
                                shadowOffset: { width: 0, height: 0 },
                                shadowRadius: 5,
                                shadowOpacity: 0.5,
                                marginTop: 2
                            }}
                        />
                    )}
                    
                    {isHost && (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Pressable
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                onPress={() => onTransfer(friend)}
                                style={{    
                                    marginLeft: 30, paddingRight: 10, 
                                    shadowColor: '#927ffa', shadowOffset: { width: 0, height: 0 }, shadowRadius: 5, shadowOpacity: 0.7,
                                    zIndex: 11 
                                }}
                            >
                                    <Ionicons 
                                        name="shield-checkmark"
                                        size={22}
                                        color="#2600ff"
                                    />
                                {/* <Text style={{ fontSize: 20, lineHeight: 0, marginBottom: 3 }}>👑 </Text> */}
                            </Pressable>

                            {!isTransferOnly && (
                                <Pressable
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    onPress={() => onRemove(friend)}
                                    style={({ pressed }) => ({
                                        opacity: pressed ? 0.5 : 1,
                                        paddingLeft: 5,
                                        shadowColor: '#f46c6c',
                                        shadowOffset: { width: 0, height: 0 },
                                        shadowRadius: 5,
                                        shadowOpacity: 0.7,
                                        zIndex: 11 
                                    })}
                                >
                                    <Ionicons 
                                        name="person-remove-outline"
                                        size={22}
                                        color="#ff4444"
                                    />
                                </Pressable>
                            )}
                        </View>
                    )}
                </View>
        </View>
    );
});

export default HomeUserItem;