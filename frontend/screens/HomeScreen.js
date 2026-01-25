import React, { useState, useEffect } from 'react'; // useState lets app remember things (eg. messages), useEffect allows app to perform actions (eg. connecting ot the server) as soon as it opens
import { Text, View, StatusBar, TouchableOpacity, TextInput } from 'react-native'; // components; similar to HTML's tags <div> or <h1>, view = <div>, text for all strings
import { styles } from '../styles';
import socket from '../socket';
import { Audio } from 'expo-av';
//import { TextInput } from 'react-native-web';

export default function HomeScreen({ navigation }) { 
  // defines the main component of the app "function App()" declares a function named App; "export default" makes this function available to be used by other files
     // If project is a collection of files, Node.js needs to know which function is the "main" one to show on the screen. "export default" tells phone "this is the primary piece of UI to render"
     // everything inside these brackets is the "guts" of the app
 

  // ---- STATE VARIABLES -----
  // app memory (state) to store the server's message
  // whenever "set" function is called, React Native automatically re-renders (refreshes) the screen to show the new info
  const [name, setName] = useState(''); 
  // useState function returns exactly 2 things inside an array
  // name is the variable holding te current data
  // setName is the function used to change that data
  const [selectedColor, setSelectedColor] = useState('#007aff');
  const [hasRegistered, setHasRegistered] = useState(false);

  const [connectionStatus, setConnectionStatus] = useState("Offline"); 
  const [friends, setFriends] = useState([]); 
  const [myId, setMyId] = useState("");
  
  const [errorMsg, setErrorMsg] = useState(""); // to hold the "Already picked" text
  const colorOptions = ['#da2d0e', '#2e8b56', '#1e8fff', '#ffd900', '#663399'];

  const [sound, setSound] = useState();
  
  useEffect(() => {
    // "useEffect" is where "brains" of the app live, bridge between static UI and real-time world
    // "useEffect(() => {" is a hook, job is to handle things outside of normal rendering of screen 
    // (eg. starting a timer, fetching data from an API, or in this case, listening to a WebSocket)
    // think of as "on mount" instructions -- it tells app "As soon as you appear on the screen, start doing these specific tasks"

    // set audio mode so it plays 
    Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true
    });

    // listen for when we successful connection
    socket.on('connect', () => { 
        setConnectionStatus("Connected!");
        setMyId(socket.id); // save my specific ID
        // socket.on is "event listener"
        // 'connect' is a reserved keyword in Socket.io; triggers the millisecond the "handshake" wit the server is sucessful
        // () => { ... } is the code that runs only when that connection happens
        // updates state and refreshes screen
    });

    // listen for user updates
    socket.on('user-update', (userList) => {
        setFriends((prevFriends) => {
            // if new list is longer than old list, someone joined
            // also check hasRegistered so it doesn't ding for own entry
            if (userList.length >prevFriends.length && userList.length > 0) {
                playJoinSound();
            }
            return userList;
        });
    });

    // check to see why connection isn't working
    // socket.on('connect_error', (err) => {
    //     console.log("Connection Error:", err.message);
    //     setConnectionStatus("Error: " + err.message);
    // });

    // cleanup: close connection when app closes
    return () => {
        socket.off('connect');
        socket.off('user-update');
    };
    // cleanup funtion, when useEffect returns a function, React saves that function and only runs it when component is destroyed 
    // (eg. user closes app or moves to a different screen)
    // socket.off() tells phone to stop listening
        // needed because if you don't "turn off" the listener and user opens and closes the app 10 times you might end up
        // with 10 "ghost" listeners all trying to update the screen at once, causing app to crash or lag
        // --> called a memory leak
  }, []);
  // [] is dependancy array, tells react how often to run useEffect
  // empty brackets mean "run this exactly once when the app starts and never again"
  // if forgotten, useEffect would run every single time the screen refreshes,
  // since useEffect changes the state (which refreshes the screen), you would create an infinite loop that would freeze the phone
 
  useEffect(() => {
    return sound
        ? () => {
            console.log('Unloading Sound');
            sound.unloadAsync();
        }
        : undefined;
  }, [sound]);


 // ---- Functions -----
 const handleJoin = () => {
    if (name.trim().length > 0) {
        socket.emit('register-user', { name: name, color: selectedColor });
        setHasRegistered(true);
    }
 };

 const selectColor = (color) => {
    // check if friend is already using this color
    const isTaken = friends.some(f => f.color === color);

    if (isTaken) {
        setErrorMsg("Color has already been picked!");
        setTimeout(()=> setErrorMsg(""), 5000);
    } else {
        setSelectedColor(color);
        setErrorMsg(""); // clear error if they pick a valid color
    }
 };

 const handleChangeProfile = () => {
    console.log("Sending unregistered user to server...");
    socket.emit('unregister-user');
    setName('');
    setHasRegistered(false);
 };

 async function playJoinSound() {
    console.log('Loading Sound');
    const { sound : newSound } = await Audio.Sound.createAsync(
        require('../assets/ding.mp3')
    );
    setSound(newSound);

    console.log('Playing Sound');
    await newSound.playAsync();
 }

 // ------ The UI (logic switch) ------
 if (!hasRegistered) {
    return (
        <View style={styles.container}>
            <Text style={styles.label}>Choose Your Profile Name</Text>
            <TextInput
                style={{
                    backgroundColor: 'white',
                    padding: 15,
                    borderRadius: 10,
                    width: '80%',
                    marginBottom: 20,
                    borderWidth: 1,
                    borderColor: '#ddd'
                }}
                placeholder="Enter Username..."
                onChangeText={setName}
            />

            {/* color picker row */}
            {/* display error message if need be */}
            {errorMsg ? (
                <Text style={{ color: 'red', marginBottom: 10, fontWeight: 'bold' }}>{errorMsg}</Text>
            ) : null}

            <View style={{ flexDirection: 'row', marginBottom: 30 }}>
                {colorOptions.map(color => {
                    const isTaken = friends.some(f => f.color === color);
                    
                    return (
                        <TouchableOpacity
                            key={color}
                            onPress={() =>selectColor(color)}
                            style={{
                                width: 40, height: 40, borderRadius: 20, backgroundColor: color,
                                marginHorizontal: 10,
                                // logic: if taken, make it faded, if selected, give it a grey border
                                opacity: isTaken ? 0.3 : 1,
                                borderWidth: isTaken ? 2 : (selectedColor == color ? 3 : 0),
                                borderColor: isTaken ? 'grey' : 'black'
                            }}
                        />
                    );

                })}
            </View>

            <TouchableOpacity
                style={[styles.friendBadge, {backgroundColor: '#5856d6', width: '60%'}]}
                onPress={handleJoin}
                >
                <Text style={{color: 'white', textAlign: 'center', fontWeight: 'bold'}}>Enter Lobby</Text>
            </TouchableOpacity>

        </View>
    );
 }

 // ----- MAIN UI ------
 return (
  // this is where logic (variables and listeners) meet the UI in ReactNative, return must always output JSX (JavaScript XML) which looks like HTML but uses native mobile components
    <View style={styles.container}>
    {/*} View is most fundamental building block, it is a non-visual container used for layout (like div) */}
    {/* style={styles.container} links comoponent to CSS rules defined at the bottom of the file */}
        <StatusBar barStyle="dark-content" />
        {/* controls the very top of phone screen (the clock, battery, and wifi icons) */}
        {/* dark-content sets it to black */}
       
        {/* --- connection status */}
        <Text style={styles.label}>Status:</Text>
        {/* can't put raw strings directly into a "view", must be wrapped in "text" */}
        <Text style={styles.statusText}>{connectionStatus}</Text>
        {/* at first user sees "Offline", as soon as useEffect calls setConnectionStats("connected!"), */}
        {/* React re-runs this return block and the text on screen changes */}


        {/* --- Username and color: current status ---- */}
        <View style={styles.statusCard}>
            {/* braces here mean "go fetch this object from the styles variable" */}
            {/* we are nesting components, have  "card" container holding two or more pieces of text */}
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
                    ID: {myId}
                </Text>
            </View>

            <View style={{ marginVertical: 10, height: 1, backgroundColor: '#eee' }} />

            {/* online friend list */}
            <Text style={styles.cardTitle}>People Nearby:</Text>
            {friends.length <= 1 ? ( // 1 because "you" are always in the list
                <Text style={styles.IDText}>No one else is here yet...</Text>
            ) : (
                friends.map((friend) => (
                    // only show friend if it isn't me
                    friend.id !== myId && (
                        <View 
                        key={friend.id} 
                        style={[styles.friendBadge, { borderColor: friend.color, borderWidth: 2 }]}
                        >
                            <Text style={styles.friendIdText}>
                                👤 {friend.name} 
                            </Text>
                        </View>   
                    )     
                ))
            )}
        </View>

        {/* -- navigation section -- */}
        <View style={{ marginTop: 'auto', marginBottom: 20, width: '100%'}}>
            {/* map */}
            <TouchableOpacity
                onPress={() => navigation.navigate('Map')}
                style={[styles.friendBadge, {backgroundColor: '#007aff', padding: 15}]}
            >
                <Text style={{color: 'white', textAlign: 'center', fontWeight: 'bold'}}>📍 Open Friend Map</Text>
            </TouchableOpacity>

            {/* chat */}
            <TouchableOpacity
                onPress={() => navigation.navigate('Chat')}
                style={[styles.friendBadge, {backgroundColor: '#d6d331', padding: 15, marginTop: 10}]}
            >
                <Text style={{color: 'white', textAlign: 'center', fontWeight: 'bold'}}>💬 Open Chat</Text>
            </TouchableOpacity>

        {/* ---- change profile ---- */}
        <TouchableOpacity
            onPress={handleChangeProfile}
            style={[styles.friendBadge, {backgroundColor: 'lightgrey', padding: 15, marginTop: 10}]}
        >
            <Text style={[styles.friendIdText, {textAlign: 'center'}]}>
                ⚙️ Change Profile
            </Text>
        </TouchableOpacity>
        </View>
    </View>
  );
}
// The syntax follows a Parent-Child relationship:
// The Parent (container) decides where everything sits (in the center of the screen).
// The Child (card) decides how its own interior looks (white background, rounded corners).
// The Content ({serverMessage}) is the dynamic data that fills the card. */}