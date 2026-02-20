// HomeScreen.js
import React, { useState, useCallback } from 'react'; // useState lets app remember things (eg. messages), useEffect allows app to perform actions (eg. connecting ot the server) as soon as it opens
import { Text, View, StatusBar, FlatList, Pressable, Button } from 'react-native'; // components; similar to HTML's tags <div> or <h1>, view = <div>, text for all strings
import TextTicker from 'react-native-text-ticker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeUserItem from '../components/home/HomeUserItem';
import HostTransferModal from '../components/home/HostTransferModal';
import { useHomeLogic } from '../hooks/useHomeLogic';
import { styles } from '../styles/styles';
import { useUser } from '../context/UserContext';

export default function HomeScreen({ navigation }) { 
    // defines the main component of the app "function App()" declares a function named App; "export default" makes this function available to be used by other files
    // If project is a collection of files, Node.js needs to know which function is the "main" one to show on the screen. "export default" tells phone "this is the primary piece of UI to render"
    // everything inside these brackets is the "guts" of the app

    // ---- STATE VARIABLES -----
    // app memory (state) to store the server's message
    // whenever "set" function is called, React Native automatically re-renders (refreshes) the screen to show the new info
    const { name, selectedColor, sessionId, isHost, friends, socket, handleCleanExit } = useUser(); // Added socket here for the hiccup test
    const { endSessionForAll, removeUser, handleTransferHost, leaveSession, leaveSessionAction } = useHomeLogic();  
    const [showTransfer, setShowTransfer] = useState(false);

    const insets = useSafeAreaInsets();

    const renderFriend = useCallback(({ item }) => (
        <HomeUserItem 
            friend={item} 
            isHost={isHost}
            onTransfer={handleTransferHost}
            onRemove={removeUser}
        />
    ), [isHost, handleTransferHost, removeUser]);

    const simulateNetworkHiccup = () => {
        if (!socket) return;
        console.log("--- Test Started: Socket Disconnecting ---");
        // gives disconnect reason "transport close"
        socket.io.engine.close();
        socket.io.opts.reconnection = false;

        // Reconnect automatically after 5 seconds
        setTimeout(() => {
            console.log("--- Test Ending: Attempting Reconnect ---");
            socket.connect();
        }, 5000);
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

            {/* ---- START HEADER ---- */}
            <View style={[styles.customHeader, { height: 60 + insets.top, paddingTop: insets.top }]}>

                {/* ---- LEFT SLOT: LEAVE SESSION BUTTON,  ---- */}
                <View style={{ width: 100, justifyContent: 'center' }}>
                    <Pressable 
                        onPress={() => leaveSession(() => setShowTransfer(true))} 
                        style={({ pressed }) => [
                            styles.headerButton,
                            styles.headerButtonDanger,
                            pressed && styles.headerButtonDangerPressed
                        ]}>
                        <Text style={{ color: 'black', fontWeight: 'bold', fontSize: 15, textAlign: 'center'}}>{"Leave"}{"\n"}{"Session"}</Text>
                    </Pressable>
                </View>
                
                {/* CENTER SLOT */}
                <View style={styles.absoluteHeaderTitle}>
                    <Text style={ styles.headerTitleText }>Lobby</Text>
                </View>

                {/* ---- RIGHT SLOT: END SESSION FOR ALL BUTTON ---- */}
                <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center'}}>
                    {isHost && (
                    <Pressable 
                        onPress={endSessionForAll}  // () => means do this only when button is pressed
                        style={({ pressed }) => [
                            styles.headerButton, 
                            styles.headerButtonDanger,
                            pressed && styles.headerButtonDangerPressed
                        ]}>
                        <Text style={{ color: 'black', fontWeight: 'bold', fontSize: 15, textAlign: 'center'}}>{"End Session"}{"\n"}{"For All"}</Text>
                    </Pressable>
                    )}
                </View>
            </View>
            {/* END HEADER */}

            <View style={styles.contentWrapper}>
                {/* --- SESSION ID ---- */}
                <View style={[styles.card, {width: '40%', backgroundColor: 'white', alignItems: 'center', padding: 10, marginTop: 20}]}> 
                    <Text style={{ color: '#242625', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 }}>Session ID</Text>
                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: 'black', marginTop: 10 }}>
                        {sessionId || "None"}
                    </Text>
                </View>
 
                {/* UNCOMMENT THIS TO TEST NETWORK DROPS
                <View style={[styles.card, {width: '40%', backgroundColor: 'white', alignItems: 'center', padding: 10, marginTop: 20}]}> 
                    <Button 
                        title="Simulate Drop" 
                        onPress={() => simulateNetworkHiccup()} 
                    />
                </View> */}
            
                {/* --- USER LIST ----- */}
                <View style={[styles.card, { paddingVertical: 15 }]}>
                    {/* --- MY USERNAME AND COLOR ---- */}
                    <View style={[styles.friendBadge, 
                        { 
                            borderColor: selectedColor, 
                            backgroundColor: selectedColor + '25', 
                            borderWidth: 3, 
                        }]}>
                        <TextTicker 
                            duration={7000}
                            loop bounce scroll={true}
                            repeatSpacer={50}
                            marqueeDelay={1000}
                            style={[ styles.friendIdText, 
                                { fontSize: 20, fontWeight: 'bold', textAlignVertical: 'center', height: 50, lineHeight: 50  }
                                ]}
                        >
                            {isHost ? '👑 ' : '⭐ '} { name || "Loading..."}
                        </TextTicker>
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
                            data={friends || []}
                            keyExtractor={(item) => item.uuid}
                            removeClippedSubviews={true}
                            initialNumToRender={8}
                            contentContainerStyle={{ paddingBottom: 10 }}
                            renderItem={renderFriend}      
                        />
                    </View>
                {/* end of user list */}
                </View>
            {/* end of content wrapper */}
            </View>

            {/* host transfer modal */}
            <HostTransferModal
                visible={showTransfer}
                onClose={() => setShowTransfer(false)}
                friends={friends}
                onTransfer={async (selectedFriend) => {
                    const confirmed = await handleTransferHost(selectedFriend);
                    if (confirmed) {
                        try {
                            await leaveSessionAction(sessionId);
                            setShowTransfer(false);
                            handleCleanExit();
                        } catch (err) {
                            Alert.alert("Transfer failed", err.message);
                        }
                    }
                }}
            />

        </View>
    );
}