import React, { useState, useEffect, useLayoutEffect, useRef } from 'react'; // useState lets app remember things (eg. messages), useEffect allows app to perform actions (eg. connecting ot the server) as soon as it opens
import { Text, View, StatusBar, TouchableOpacity, Alert, FlatList, Pressable, ScrollView, 
    Animated, Easing, BackHandler } from 'react-native'; // components; similar to HTML's tags <div> or <h1>, view = <div>, text for all strings
import { useFocusEffect } from '@react-navigation/native';
import { styles } from '../styles';
import { useUser } from '../UserContext';
import TextTicker from 'react-native-text-ticker';
import { useSessionBackHandler } from '../hooks/useSessionBackHandler';

export default function HomeScreen({ navigation }) { 
    // defines the main component of the app "function App()" declares a function named App; "export default" makes this function available to be used by other files
    // If project is a collection of files, Node.js needs to know which function is the "main" one to show on the screen. "export default" tells phone "this is the primary piece of UI to render"
    // everything inside these brackets is the "guts" of the app

    // ---- STATE VARIABLES -----
    // app memory (state) to store the server's message
    // whenever "set" function is called, React Native automatically re-renders (refreshes) the screen to show the new info
    const {
        name, selectedColor, socket, isConnected, sessionUsers, sessionId, secureEmit, 
        handleCleanExit, isHost, onLeave
    } = useUser();

    // takes care of android "back" button
    useSessionBackHandler(onLeave);

    const friends = sessionUsers.filter(u => u.id !== socket.id);

    const removeUser = (sessionID, friend) => {
        Alert.alert(
            "Remove user?",
            `Remove ${friend.name} from sessiion?`,
            [
                {text: "No", style: "cancel", onPress: () => console.log("Canceled remove user.") },
                {text: "Yes", style: "destructive",
                    onPress: () => { 
                        secureEmit('remove-user', { roomID: sessionID, userIdToRemove: friend.id })
                    }
                }
            ]
        );
    };

    const endSessionForAll = () => {
        Alert.alert(
            "End session for all?",
            "End session for all users?",
            [
                {text: "No", style: "cancel", 
                    onPress: () => console.log(`Session ${sessionId} cancellation ended.`) },
                {text: "Yes", style: "destructive", 
                    onPress: () => { secureEmit('end-session', sessionId )}}
            ]
        );
    };

    const handleTransferHost = (sessionID, friend) => {
        Alert.alert(
            "Transfer host?",
            `Make ${friend.name} the new host?`,
            [
                { text: "No", style: "cancel", 
                    onPress: () => console.log(`Host transfer canceled.`) },
                { text: "Yes", style: "destructive",
                    onPress: () => secureEmit('transfer-host', { 
                        roomID: sessionID, 
                        newHostId: friend.id 
                    })
                }
            ]
        );
    };

    // "useEffect" is where "brains" of the app live, bridge between static UI and real-time world
    // "useEffect(() => {" is a hook, job is to handle things outside of normal rendering of screen 
    // (eg. starting a timer, fetching data from an API, or in this case, listening to a WebSocket)
    // think of as "on mount" instructions -- it tells app "As soon as you appear on the screen, start doing these specific tasks"

    // ----- MAIN UI ------

    return (
    // this is where logic (variables and listeners) meet the UI in ReactNative, return must always output JSX (JavaScript XML) which looks like HTML but uses native mobile components
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* ---- CUSTOM HEADER ---- */}
            <View style={styles.customHeader}>
                {/* ---- LEAVE SESSION BUTTON ---- */}
                <View style={{ width: 100, justifyContent: 'center' }}>
                    <Pressable 
                        onPress={onLeave}  // () => means do this only when button is pressed
                        style={({ pressed }) => [
                            styles.headerButton, {
                                backgroundColor: '#ff000046',
                                borderColor: '#ff00005d',
                                borderWidth: 0
                            }
                        ]}>
                        <Text style={{ color: 'black', fontWeight: 'bold', fontSize: 15, textAlign: 'center'}}>{"Leave"}{"\n"}{"Session"}</Text>
                    </Pressable>
                </View>
                
                <View style={styles.absoluteHeaderTitle}>
                    <Text style={[ styles.headerTitleText, { fontSize: 30 }]}>Lobby</Text>
                </View>

                {/* ---- END SESSION FOR ALL BUTTON ---- */}
                <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center'}}>
                    {isHost && (
                    <Pressable 
                        onPress={endSessionForAll}  // () => means do this only when button is pressed
                        style={({ pressed }) => [
                            styles.headerButton, {
                                backgroundColor: '#ff000046',
                                borderColor: '#ff00005d',
                                borderWidth: 0
                            }
                        ]}>
                        <Text style={{ color: 'black', fontWeight: 'bold', fontSize: 15, textAlign: 'center'}}>{"End Session"}{"\n"}{"For All"}</Text>
                    </Pressable>
                    )}
                </View>
            </View>

            <View style={styles.contentWrapper}>
                {/* --- SESSION ID ---- */}
                <View style={[styles.card, {width: '40%', backgroundColor: 'white', alignItems: 'center', padding: 10, marginTop: 20}]}> 
                    <Text style={{ color: '#242625', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 }}>Session ID</Text>
                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: 'black', marginTop: 10 }}>
                        {sessionId || "None"}
                    </Text>
                </View>
            
                {/* --- USER LIST ----- */}
                <View style={[styles.card, { paddingVertical: 15 }]}>
                    {/* --- MY USERNAME AND COLOR ---- */}
                    <View style={[styles.friendBadge, 
                        { 
                            borderColor: selectedColor, 
                            backgroundColor: selectedColor + '25', 
                            borderWidth: 3, 
                        }]}>
                        <Text style={[styles.friendIdText, { fontSize: 20, fontWeight: 'bold', textAlignVertical: 'center', height: 50, lineHeight: 50  }]}>
                            {isHost ? '👑 ' : '⭐ '} { name || "Loading..."}
                        </Text>
                    </View>
                        
                    {/* --- DIVIDER ---- */}
                    <Text style={{ fontSize: 14, color: 'grey', marginTop: 15, marginLeft: 5, marginBottom: 2 }}>
                        PEOPLE NEARBY ({friends.length})
                    </Text>

                    {/* ---- SCROLLABLE FRIENDS LIST ----- */}       
                    <View style={{ 
                        backgroundColor: 'white', 
                        padding: 0, 
                        flexGrow: 0, 
                        maxHeight: 350 
                    }}>
                        <FlatList 
                            data={friends}
                            keyExtractor={(item) => item.id}
                            removeClippedSubviews={true}
                            initialNumToRender={8}
                            contentContainerStyle={{ paddingBottom: 10 }}

                            renderItem={({ item: friend }) => (
                                <View style={[
                                    styles.friendBadge, { 
                                        borderColor: friend.color || '#ccc', 
                                        borderWidth: 2, 
                                        paddingHorizontal: 10, 
                                        overflow: 'hidden', 
                                        marginTop: 10
                                }]}>
                                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: '100%' }}>
                                        <Text style={{ fontSize: 17, fontFamily: 'Courier', includeFontPadding: false, textAlignVertical: 'center', height: 50, lineHeight: 50 }}>
                                            {friend.isHost ? '👑 ' : '👤 '}
                                        </Text>
                                        <TextTicker 
                                            key={isHost ? `host-view-${friend.id}` : `guest-view-${friend.id}`}
                                            style={{ fontSize: 18, flex: 1, marginRight: 10, fontFamily: 'Courier', includeFontPadding: false, textAlignVertical: 'center', height: 50, lineHeight: 30 }}
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
                                    </View>

                                    {/* HOST TOOLS */}
                                    {isHost && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
                                            <TouchableOpacity
                                                onPress={() => handleTransferHost(sessionId, friend )}
                                                style={{ marginLeft: 30 }}>
                                                <Text style={{ fontSize: 20 }}>👑 </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => removeUser(sessionId, friend )}
                                                style={{ marginLeft: 10 }}>
                                                <Text style={{ color: 'red', fontWeight: 'bold', fontSize: 17 }}>Remove</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>   
                            )}

                            ListEmptyComponent={()  => (
                                <Text style={{ fontSize: 12, color: '#8e8e93', marginTop: 10, fontFamily: 'Courier' }}>No one else is here yet...</Text>  
                            )}      
                        />
                    {/* end of scrollable friend list container */}
                    </View>
                {/* end of user list */}
                </View>
            {/* end of content wrapper */}
            </View>
        </View>
    );
}
