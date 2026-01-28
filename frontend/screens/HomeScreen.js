import React, { useState, useEffect, useLayoutEffect } from 'react'; // useState lets app remember things (eg. messages), useEffect allows app to perform actions (eg. connecting ot the server) as soon as it opens
import { Text, View, StatusBar, TouchableOpacity, Alert, ScrollView } from 'react-native'; // components; similar to HTML's tags <div> or <h1>, view = <div>, text for all strings
import { styles } from '../styles';
import { useUser } from '../UserContext';

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
        secureEmit('transfer-host', { roomID: sessionId, newHostId: friends[0].id }, () => {
        secureEmit('leave-session', sessionId);
        handleCleanExit();
    });
    } else { // if no one else is in the session or user is not host, just leave
        secureEmit('leave-session', sessionId);
        handleCleanExit();
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

  // --- PROFILE AND LEAVE BUTTONS IN HEADER ----
  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackVisible: false,
      headerStyle: {
        backgroundColor: '#ffffff',
        elevation: 0,
        shadowOpacity: 0,
        height: 125,
      },
      headerLeft: () => (
        <TouchableOpacity
            activeOpacity={1}
            onPress={() => navigation.navigate('Profile')}  // () => means do this only when button is pressed
            style={{ 
                marginLeft: 15, 
                paddingHorizontal: 10, 
                paddingVertical: 10,
                borderRadius: 20, 
                backgroundColor: '#007aff' + '25',
                alignContent: 'center'}}>
          <Text style={{ color: '#007aff', fontWeight: 'bold',fontSize: 20}}>{"☰ Profile"}</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity 
            activeOpacity={1}
            onPress={onLeave}  // () => means do this only when button is pressed
            style={{ 
                marginRight: 15, 
                paddingHorizontal: 10,
                paddingVertical: 10,
                borderRadius: 20, 
                backgroundColor: '#ff0000' + '25' }}>
          <Text style={{ color: '#ff0000', fontWeight: 'bold', fontSize: 20}}>{"👋 Leave"}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, name, selectedColor]);

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
       
        {/* --- CONNECTION STATUS ----- */}
        {/* <Text style={styles.label}>Status:</Text>
        <Text style={[styles.statusText, {color: isConnected ? 'green' : 'red' }]}>
            {isConnected ? "Connected!" : "Offline"}
        </Text> */}

        {/* --- SESSION ID (& HOST ONLY: END SESSION FOR ALL) ---- */}
        <View style={{ 
            flexDirection: 'row', 
            justifyContent: isHost ? 'space-between' : 'center', 
            alignItems: 'center', 
            width: '100%',
            paddingHorizontal: 20}}>
            <View style={[styles.statusCard, {width: '40%', backgroundColor: 'white', alignItems: 'center', padding: 10, marginTop: 10}]}> 
                <Text style={[styles.label, {color: '#242625', fontSize: 15}]}>Session ID</Text>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: 'black', marginTop: 10 }}>
                    {sessionId || "None"}
                </Text>
            </View>
            {isHost && (
                <TouchableOpacity 
                    activeOpacity={1}
                    onPress={endSessionForAll}  // () => means do this only when button is pressed
                    style={{ 
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                        borderRadius: 20, 
                        backgroundColor: '#ff0000' + '25',
                        marginBottom: 10
                    }}>
                    <Text style={{ color: '#000000', fontSize: 20, textAlign: 'center', fontWeight: 'bold' }}>
                        {"End Session\nFor All"}
                    </Text>
                </TouchableOpacity>            
            )}
        </View>
    
        {/* --- USER LIST ----- */}
        <View style={[styles.userCard, {paddingVertical: 10}]}>
            {/* --- MY USERNAME AND COLOR ---- */}
            <View style={[styles.friendBadge, 
                { 
                    borderColor: selectedColor, 
                    backgroundColor: selectedColor + '25', 
                    borderWidth: 3, 
                    marginBottom: 2,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }]}>
                <Text style={[styles.friendIdText, { fontSize: 20, fontWeight: 'bold' }]}>
                    {isHost ? '👑 ' : '⭐ '} { name || "Loading..."}
                </Text>
            </View>
                
            {/* --- DIVIDER ---- */}
            <Text style={{ fontSize: 14, color: 'grey', marginTop: 8, marginLeft: 5, marginBottom: 5 }}>
                PEOPLE NEARBY ({friends.length})
            </Text>

            {/* ---- SCROLLABLE FRIENDS LIST ----- */}        
            <View style={{ 
                backgroundColor: 'white', 
                padding: 0, 
                flexGrow: 0, 
                maxHeight: 250 
            }}>
                <ScrollView 
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={{ paddingBottom: 20 }}
                >
                    {sessionUsers.length <= 1 ? ( // 1 because "you" are always in the list
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
                                    // marginBottom: 10
                                }]}>
                                <Text style={[styles.friendIdText, { fontSize: 17 }]}>
                                    {friend.isHost ? '👑 ' : '👤 '} {friend.name} 
                                </Text>

                                {/* HOST TOOLS */}
                                {isHost && (
                                    <View style={{ 
                                        flexDirection: 'row', 
                                        alignItems: 'center', 
                                        justifyContent: 'flex-end' 
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
                onPress={() => navigation.navigate('Chat')}
                style={[styles.friendBadge, {backgroundColor: '#d6d331', padding: 15, marginTop: 10}]}>
                <Text style={{color: 'white', textAlign: 'center', fontWeight: 'bold'}}>💬 Open Chat</Text>
            </TouchableOpacity>

        </View>
    </View>
  );
}