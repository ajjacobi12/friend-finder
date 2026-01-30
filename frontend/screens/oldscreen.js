                    {/*}    {sessionUsers.length <= 1 ? ( // 1 because "you" are always in the list
                            <Text style={styles.IDText}>No one else is here yet...</Text>
                        ) : (
                            friends.map((friend) => (
                                <View key={friend.id} 
                                    style={[styles.friendBadge, { 
                                        borderColor: friend.color || '#ccc', 
                                        borderWidth: 2,
                                        flexDirection: 'row', 
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        paddingHorizontal: 10,
                                        overflow: 'hidden',
                                        height: 50
                                        // marginBottom: 10
                                    }]}>
                                    <View style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        height: '100%',
                                    }}>
                                        <Text style={{ 
                                            fontSize: 17, 
                                            fontFamily: 'Courier',
                                            includeFontPadding: false,
                                            textAlignVertical: 'center',
                                            height: 50,
                                            lineHeight: 50
                                        }}>
                                            {friend.isHost ? '👑 ' : '👤 '}
                                        </Text>
                                        <TextTicker 
                                            key={isHost ? `host-view-${friend.id}` : `guest-view-${friend.id}`}
                                            style={{ 
                                                fontSize: 18, 
                                                flex: 1, 
                                                marginRight: 10, 
                                                fontFamily: 'Courier',
                                                includeFontPadding: false,
                                                textAlignVertical: 'center',
                                                height: 50,
                                                lineHeight: 30
                                             }}
                                            duration={7000}
                                            loop
                                            bounce
                                            repeatSpacer={50}
                                            marqueeDelay={1000}
                                            scroll={true}
                                            shouldAnimateTreshold={10}
                                            disabled={false}
                                        >
                                            {friend.name} 
                                        </TextTicker>
                                    </View> */}

                                    {/* HOST TOOLS */}
                                    {/* {isHost && (
                                        <View style={{ 
                                            flexDirection: 'row', 
                                            alignItems: 'center', 
                                            justifyContent: 'flex-end',
                                            flexShrink: 0
                                        }}>
                                            <TouchableOpacity
                                                onPress={() => secureEmit('transfer-host', { roomID: sessionId, newHostId: friend.id })}
                                                style={{ marginLeft: 30 }}>
                                                <Text style={{ fontSize: 20 }}>👑 </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => removeUser(sessionId, friend.id)}
                                                style={{ marginLeft: 10 }}>
                                                <Text style={{ color: 'red', fontWeight: 'bold', fontSize: 17 }}>Remove</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>   
                            ))
                        )}
                    </ScrollView>
                </View>
            </View>
 } */}
