import React, { useState, useEffect, useLayoutEffect, useRef } from 'react'; // useState lets app remember things (eg. messages), useEffect allows app to perform actions (eg. connecting ot the server) as soon as it opens
import { Text, View, StatusBar, TouchableOpacity, Alert, FlatList, Pressable, ScrollView, Animated, Easing } from 'react-native'; // components; similar to HTML's tags <div> or <h1>, view = <div>, text for all strings
import { styles } from '../styles';
import { useUser } from '../UserContext';
import TextTicker from 'react-native-text-ticker';

export default function HomeScreen({ navigation }) { 
    // defines the main component of the app "function App()" declares a function named App; "export default" makes this function available to be used by other files
    // If project is a collection of files, Node.js needs to know which function is the "main" one to show on the screen. "export default" tells phone "this is the primary piece of UI to render"
    // everything inside these brackets is the "guts" of the app

    // ---- STATE VARIABLES -----
    // app memory (state) to store the server's message
    // whenever "set" function is called, React Native automatically re-renders (refreshes) the screen to show the new info
    const {
        name, selectedColor, socket, isConnected, sessionUsers, sessionId, secureEmit, handleCleanExit, isHost
    } = useUser();

    const friends = sessionUsers.filter(u => u.id !== socket.id);

    const onLeave = () => {
        if (isHost && friends.length > 1) {
        // if host is leaving but there are 2 or more other users, require transfer of ownership first
        Alert.alert(
            "Host transfer required.",
            "You are the host! Please transfer ownership before leaving the session.",
            [{ text: "OK", style: "cancel" }]
        );
        } else if (isHost && friends.length === 1) { // only one other user, auto-transfer host 
            Alert.alert(
                "Are you sure?",
                "Are you sure you'd like to leave the session?",
                [{ text: "No", style: "cancel" }, 
                 { text: "Yes", style: "destructive",
                     onPress: () => {
                        secureEmit('transfer-host', { roomID: sessionId, newHostId: friends[0].id }, () => {
                        secureEmit('leave-session', sessionId);
                        handleCleanExit();
                        });
                     }
                  }]
            );
        } else { // if no one else is in the session or user is not host, just leave
            Alert.alert(
                "Are you sure?",
                "Are you sure you'd like to leave the session?",
                [{ text: "No", style: "cancel" }, 
                 { text: "Yes", style: "destructive",
                    onPress: () => {
                        secureEmit('leave-session', sessionId);
                        handleCleanExit();
                    }
                  }]
            );
        }
    };

    const removeUser = (sessionID, friendID) => {
        Alert.alert(
        "Remove user?",
        "Remove user from sessiion?",
        [{text: "No", 
            style: "cancel",
            onPress: () => console.log("Canceled remove user.") },
            {text: "Yes", 
            style: "destructive",
            onPress: () => { secureEmit('remove-user', { roomID: sessionID, userIdToRemove: friendID })}
        }]
        );
    };

    const endSessionForAll = () => {
        Alert.alert(
        "End session for all?",
        "End session for all users?",
        [{text: "No", 
            style: "cancel",
            onPress: () => console.log(`Session ${sessionId} ended for all users.`) },
            {text: "Yes", 
            style: "destructive",
            onPress: () => { secureEmit('end-session', sessionId )}
        }]
        );
    };

    // "useEffect" is where "brains" of the app live, bridge between static UI and real-time world
    // "useEffect(() => {" is a hook, job is to handle things outside of normal rendering of screen 
    // (eg. starting a timer, fetching data from an API, or in this case, listening to a WebSocket)
    // think of as "on mount" instructions -- it tells app "As soon as you appear on the screen, start doing these specific tasks"
    
    // initial join - tell server who we are
    useEffect(() => {
        secureEmit('update-user', { name, color: selectedColor, sessionId, isHost });
    }, [name, selectedColor, sessionId, isHost]);

    // ----- MAIN UI ------

    return (
    // this is where logic (variables and listeners) meet the UI in ReactNative, return must always output JSX (JavaScript XML) which looks like HTML but uses native mobile components
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* ---- CUSTOM HEADER ---- */}
            <View style={[styles.customHeader, { alignItems: 'center' }]}>
                {/* ---- PROFILE BUTTON ---- */}
                <Pressable
                    onPress={() => navigation.navigate('Profile')}  // () => means do this only when button is pressed
                    style={({ pressed }) => ({
                        marginLeft: 10, 
                        marginTop: 50,
                        height: 45,
                        paddingHorizontal: 10, 
                        paddingVertical: 10,
                        borderRadius: 20, 
                        backgroundColor: '#007aff' + '25',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: '#007bff52'
                    })}>
                    <Text style={{ color: '#007aff', fontWeight: 'bold', fontSize: 20}}>{"☰ Profile"}</Text>
                </Pressable>
                
                <View style={{
                    position: 'absolute',
                    top: 60,
                    left: 0,
                    right: 0,
                    height: 45,
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Text style={{ fontFamily: 'Courier', fontSize: 30, fontWeight: 'bold', marginTop: 0 }}>Lobby</Text>
                </View>

                {/* ---- END SESSION FOR ALL BUTTON ---- */}
                <View style={{ flex: 1, alignItems: 'flex-end'}}>
                {isHost && (
                <Pressable 
                    onPress={endSessionForAll}  // () => means do this only when button is pressed
                    style={({ pressed }) => ({ 
                        marginRight: 10, 
                        marginTop: 50,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 20, 
                        backgroundColor: '#ff000046',
                        borderWidth: 1,
                        borderColor: '#ff00005d' 
                    })}>
                    <Text style={{ color: '#ff0000', fontWeight: 'bold', fontSize: 15, textAlign: 'center'}}>{"End Session"}{"\n"}{"For All"}</Text>
                </Pressable>
                )}
                </View>
            </View>
        
            {/* --- CONNECTION STATUS ----- */}
            {/* <Text style={styles.label}>Status:</Text>
            <Text style={[styles.statusText, {color: isConnected ? 'green' : 'red' }]}>
                {isConnected ? "Connected!" : "Offline"}
            </Text> */}

            {/* --- SESSION ID ---- */}
            <View style={[styles.statusCard, {width: '40%', backgroundColor: 'white', alignItems: 'center', padding: 10, marginTop: 20}]}> 
                <Text style={[styles.label, {color: '#242625', fontSize: 15}]}>Session ID</Text>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: 'black', marginTop: 10 }}>
                    {sessionId || "None"}
                </Text>
            </View>
        
            {/* --- USER LIST ----- */}
            <View style={[styles.userCard, {paddingVertical: 0}]}>
                {/* --- MY USERNAME AND COLOR ---- */}
                <View style={[styles.friendBadge, 
                    { 
                        borderColor: selectedColor, 
                        backgroundColor: selectedColor + '25', 
                        borderWidth: 3, 
                        marginBottom: 2,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        height: 50
                    }]}>
                    <Text style={[styles.friendIdText, { fontSize: 20, fontWeight: 'bold', textAlignVertical: 'center', height: 50, lineHeight: 50  }]}>
                        {isHost ? '👑 ' : '⭐ '} { name || "Loading..."}
                    </Text>

                    <TouchableOpacity
                        onPress={onLeave}
                        style={{ marginLeft: 30 }}>
                        <Text style={{ fontSize: 18, color: 'red', fontWeight: 'bold' }}>Leave</Text>
                    </TouchableOpacity>
                </View>
                    
                {/* --- DIVIDER ---- */}
                <Text style={{ fontSize: 14, color: 'grey', marginTop: 20, marginLeft: 5, marginBottom: 2 }}>
                    PEOPLE NEARBY ({friends.length})
                </Text>

                {/* ---- SCROLLABLE FRIENDS LIST ----- */}       
                <View style={{ 
                    backgroundColor: 'white', 
                    padding: 0, 
                    flexGrow: 0, 
                    maxHeight: 250 
                }}>
                    <FlatList 
                        data={friends}
                        keyExtractor={(item) => item.id}
                        removeClippedSubviews={true}
                        initialNumToRender={6}

                        renderItem={({ item: friend }) => (
                            <View style={[styles.friendBadge, { borderColor: friend.color || '#ccc', borderWidth: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, overflow: 'hidden', height: 50 }]}>
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
                        )}

                        ListEmptyComponent={()  => (
                            <Text style={styles.IDText}>No one else is here yet...</Text>  
                        )}      
                    />
                 </View>
            </View>

                             {/* -- NAVIGATION SECTION -- */}
            <View style={{ marginTop: 'auto', marginBottom: 20, width: '100%'}}>

                {/* map */}
                <TouchableOpacity
                    onPress={() => navigation.navigate('Map')}
                    style={[styles.friendBadge, {backgroundColor: '#007aff', padding: 15}]}>
                    <Text style={{color: 'white', textAlign: 'center', fontWeight: 'bold'}}>📍 Open Friend Map</Text>
                </TouchableOpacity>

                {/* chat */}
                <TouchableOpacity
                    onPress={() => navigation.navigate('Chat', { isDirectMessage: false })}
                    style={[styles.friendBadge, {backgroundColor: '#d6d331', padding: 15, marginTop: 10}]}>
                    <Text style={{color: 'white', textAlign: 'center', fontWeight: 'bold'}}>💬 Open Chat</Text>
                </TouchableOpacity>

            </View>
        </View>
    );
}
