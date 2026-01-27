import React, { useState, useEffect, useLayoutEffect } from 'react'; // useState lets app remember things (eg. messages), useEffect allows app to perform actions (eg. connecting ot the server) as soon as it opens
import { Text, View, StatusBar, TouchableOpacity } from 'react-native'; // components; similar to HTML's tags <div> or <h1>, view = <div>, text for all strings
import { styles } from '../styles';
import { useUser } from '../UserContext';
//import { TextInput } from 'react-native-web';

export default function HomeScreen({ navigation }) { 
  // defines the main component of the app "function App()" declares a function named App; "export default" makes this function available to be used by other files
     // If project is a collection of files, Node.js needs to know which function is the "main" one to show on the screen. "export default" tells phone "this is the primary piece of UI to render"
     // everything inside these brackets is the "guts" of the app

  // ---- STATE VARIABLES -----
  // app memory (state) to store the server's message
  // whenever "set" function is called, React Native automatically re-renders (refreshes) the screen to show the new info
  const {
    name, selectedColor, socket, isConnected, friends, sessionId, secureEmit, handleCleanExit
  } = useUser();

  const onLeave = () => {
    secureEmit('leave-session', sessionId);
    handleCleanExit();
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackVisible: false,
      headerStyle: {
        backgroundColor: '#ffffff',
        elevation: 0,
        shadowOpacity: 0,
      },
      headerLeft: () => (
        <TouchableOpacity
            activeOpacity={1}
            onPress={() => navigation.navigate('Profile')}  // () => means do this only when button is pressed
            style={{ marginLeft: 5, paddingHorizontal: 5, backgroundColor: '#ffffff'}}>
          <Text style={{ color: '#007aff', fontWeight: 'bold',fontSize: 20}}>Profile</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={onLeave}  // () => means do this only when button is pressed
                          style={{ marginLeft: 5, paddingHorizontal: 5, backgroundColor: '#ffffff'}}>
          <Text style={{ marginLeft: -5, color: '#ff0000', fontWeight: 'bold', fontSize: 20}}>Leave</Text>
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
    secureEmit('update-user', { name, color: selectedColor, sessionId });
  }, [name, selectedColor, sessionId]);

 // ----- MAIN UI ------
 return (
  // this is where logic (variables and listeners) meet the UI in ReactNative, return must always output JSX (JavaScript XML) which looks like HTML but uses native mobile components
    <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
       
        {/* --- connection status ----- */}
        <Text style={styles.label}>Status:</Text>
        <Text style={[styles.statusText, {color: isConnected ? 'green' : 'red' }]}>
            {isConnected ? "Connected!" : "Offline"}
        </Text>

        <View style={[styles.statusCard, {width: '40%', backgroundColor: 'white', alignItems: 'center', marginTop: -20, padding: 10}]}> 
            <Text style={[styles.label, {color: '#242625', fontSize: 15}]}>Session ID</Text>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: 'black', marginTop: 10 }}>
                {sessionId || "None"}
            </Text>
        </View>

        {/* --- Username and color: current status ---- */}
        <View style={[styles.statusCard, {backgroundColor: 'white' }]}>
            <Text style ={[styles.messageText, { color: '#282525' }]}>
                Username: <Text style={{color: selectedColor, fontWeight: 'bold'}}>{name || 'Anonymous'}</Text>
            </Text>
        </View>

        {/* -- ID section -- */}
        <View style={styles.userCard}>

            {/* my ID */}
            <Text style={styles.cardTitle}>Your ID:</Text>
            <View style={[styles.friendBadge, { borderColor: selectedColor, backgroundColor: selectedColor + '25' }]}>
                <Text style={styles.friendIdText}>
                    ⭐ You: {name || "Loading..."}
                </Text>
                <Text style={{ fontSize: 11, color: 'grey', marginTop: 2 }}>
                    ID: {socket.id}
                </Text>
            </View>

            <View style={{ marginVertical: 10, height: 1, backgroundColor: '#eee' }} />

            {/* online friend list */}
            <Text style={styles.cardTitle}>People Nearby:</Text>
            {friends.length <= 1 ? ( // 1 because "you" are always in the list
                <Text style={styles.IDText}>No one else is here yet...</Text>
            ) : (
                friends
                    .filter(u => u.id !== socket.id) // first remove me from list
                    .map((friend) => (
                    // only show friend if it isn't me
                        <View key={friend.id} 
                            style={[styles.friendBadge, { borderColor: friend.color || '#ccc', borderWidth: 2 }]}>
                            <Text style={styles.friendIdText}>
                                👤 {friend.name} 
                            </Text>
                        </View>   
                ))
            )}
        </View>

        {/* -- navigation section -- */}
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