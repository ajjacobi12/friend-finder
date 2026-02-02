// ----- IMPORTS -------
import React, { useState, useLayoutEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StatusBar, Animated, Dimensions, Platform, Keyboard, TouchableWithoutFeedback, PanResponder } from 'react-native';
import { styles } from '../styles';
import { useUser } from '../UserContext';

const { width } = Dimensions.get('window');


export default function LoginScreen( { navigation }) {
    const { setSessionId, secureEmit, setSessionUsers, setName, setSelectedColor, setHasRegistered, isConnected, setIsHost, justCreatedSession, userUUID, setUserUUID } = useUser();
    const [tempCode, setTempCode] = useState(''); // tempCode holds what user is typing into textInput before hitting "join"
    const [errorMsg, setErrorMsg]  = useState('');
    const [isJoinScreen, setIsJoinScreen] = useState(false);
    const [loading, setLoading] = useState(false);

    const slideAnim = useRef(new Animated.Value(0)).current;

    const panResponder = React.useMemo(() =>
        PanResponder.create({
            onStartShouldSetPanResponderCapture: () => false, // capture touch immediately
            onStartShouldSetPanResponder: () => isJoinScreen,
            onPanResponderGrant: () => {
                Keyboard.dismiss();
            },
            onMoveShouldSetPanResponder: (event, gestureState) => {
                // only capture if on screen 2 (slideAnim at -width)
                // and if user swipes right dx > 10, ensure vertical movement is also small
                return Math.abs(gestureState.dy) < 10 && gestureState.dx > 10 && isJoinScreen;
            },
            // prevent other components from canceling the swipe
            onPanResponderTerminationRequest: () => false,
            onPanResponderMove: (event, gestureState) => {
                // starting position is -width, add finger movement (dx) to it
                // cap at 0 so screen can slide too far right
                const newX = Math.min(-width + gestureState.dx, 0);
                slideAnim.setValue(newX);
            },
            onPanResponderRelease: (event, gestureState) => {
                // if swipe more than 1/5 of screen, finish transition
                if (gestureState.dx > width / 5) { 
                    hideJoinInput();
                } else { //snap back to screen 2
                    Animated.spring(slideAnim, {
                        toValue: -width,
                        useNativeDriver: true,
                        friction: 2
                    }).start();
                }
            },
    }), [isJoinScreen]);

    // ------ START NEW SESSION --------
    const startNewSession = () => {
        if (loading || !isConnected) return;
        setLoading(true);
        justCreatedSession.current = true;
        // generate random 6 character key
        const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
        // tell server to create and track this room
        secureEmit('create-session', { roomID: newId, existingUUID: userUUID }, (response) => {
            setLoading(false);
            // update global context
            if (response && response.userUUID) {
                setUserUUID(response.userUUID);
                setSessionId(newId);
                setIsHost(true);
                navigation.navigate('Profile'); // move to profile setup
            }
        });
    };

    // ------ JOIN EXISTING SESSION ------
    // this is socket.io acknowledgement, it's asking a question and waiting for an answer
    // response is a function that theserver executes once it finishes checking its database
    const joinSession = () => {
        if (!tempCode || loading || !isConnected) return;
        setLoading(true);
        setErrorMsg("");

        if (tempCode.length > 0) {
            const code = tempCode.toUpperCase();
            console.log("Sending join request for session:", code);

            // ask the server "is this a real session?"
            secureEmit('join-session', { roomID: code, existingUUID: userUUID }, (response) => {
                setLoading(false);
                console.log("Server response for joining session:", response);

                if (response && response.exists && !response.full) {           
                    setErrorMsg("");    
                    // update core session details     
                    setUserUUID(response.userUUID);
                    setSessionId(code);
                    setIsHost(response.isHost || false);

                    if (response.currentUsers) {
                        setSessionUsers(response.currentUsers);
                    }

                    // redirect logic
                    if (response.alreadyRegistered && response.userData) {
                        console.log("Re-entry detected. Restoring profile...");
                        // synce data with stuff from server
                        setName(response.userData.name);
                        setSelectedColor(response.userData.color);
                        setHasRegistered(true);
                    } else {
                        console.log("New user or unregistered. Navigating to profile...");
                        navigation.navigate('Profile');
                    }
                } else if (response && response.exists && response.full) {
                    setErrorMsg("Session is full!");
                    setTimeout(() => {setErrorMsg("")}, 5000);
                }       
                else if (response && !response.exists){
                    setErrorMsg("Session not found. Check the code!");
                    setTimeout(() => {setErrorMsg("")}, 5000);
                }
            });
        } else {
            setLoading(false);
        }
    };

    // --- ANIMATION LOGIC ---
    const showJoinInput = () => {
        setIsJoinScreen(true);
        setErrorMsg("");
        Animated.timing(slideAnim, {
            toValue: -width, // slide whole container left by one screen width
            duration: 300,
            useNativeDriver: true,
        }).start();
    };

    const hideJoinInput = () => {
        Keyboard.dismiss();
        setIsJoinScreen(false);
        setTempCode(""); // clears input when going back
        setErrorMsg("");
        Animated.timing(slideAnim, {
            toValue: 0, // slide back to original position
            duration: 200,
            useNativeDriver: true,
        }).start();
    };

    if (!isConnected) {
        return (
            <View style={[styles.container, {justifyContent: 'center', flex: 1}]}>
                <StatusBar barStyle="dark-content" /> 
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 22, fontWeight: 'bold', color: 'red', textAlign: 'center' }}>
                    The server is offline. Please try again later.
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#ffffff', overflow: 'hidden' }} {...panResponder.panHandlers}>
            <StatusBar barStyle="dark-content" />

            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={{ flex: 1, alignItems: 'flex-start', justifyContent: 'center', width: width }}>

                <Animated.View style={{
                    flexDirection: 'row',
                    width: width * 2, // double width to hold both screens side by side
                    flex: 1,
                    transform: [{ translateX: slideAnim }]
                }}>

                {/* ---- SCREEN 1: MAIN MENU (LEFT) ----- */}
                <View style={{ width: width, alignItems: 'center', justifyContent: 'center',paddingHorizontal: 20 }}>
                    {/* new session button */}
                    <TouchableOpacity 
                        style={[styles.button, { width: '100%', height: 100, justifyContent: 'center', paddingHorizontal: 25}]} 
                        onPress={startNewSession}
                        disabled={loading}
                    >
                        <Text style={[styles.buttonText, {fontSize: 40, textAlign: 'center' }]}>
                            {loading ? "Creating..." : "New Session"}
                        </Text>
                    </TouchableOpacity>

                    <View style={{ marginVertical: 40, backgroundColor: '#ccc', height: 2, width: '80%' }} />

                    {/* join session button */}
                    <TouchableOpacity 
                        style={[styles.button, { backgroundColor: '#77e1ede4', marginTop: 0, width: '100%', height: 100, justifyContent: 'center'}]} 
                        onPress={showJoinInput}
                        disabled={loading}
                    >
                        <Text style={[styles.buttonText, {fontSize: 40}]}>Join Session</Text>
                    </TouchableOpacity>
                </View>
                   
                {/* ---- SCREEN 2: JOIN INPUT (RIGHT) ---- */}
                <View style={{ width: width, flex: 1 }}>
                    <View style={styles.customHeader, { position: 'absolute', top: 50 }}>
                    {/* back button */}
                        <TouchableOpacity 
                            onPress={hideJoinInput}
                            style={{ position: 'absolute', top: 0, left: 20, padding: 10}}
                        >
                            <Text style={{ color: '#007aff', fontSize: 20, fontWeight: 'bold' }}>Back</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.contentWrapper, { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 270 }]}>
                        {/* error message display */}
                        {errorMsg !== "" && (
                            <Text style={{ color: 'red', fontWeight: 'bold', marginBottom: 10, fontSize: 16 }}>
                                {errorMsg}
                            </Text>
                        )}

                        {/* input box */}
                        <TextInput
                            style={{
                                height: 75,
                                backgroundColor: 'lightgrey',
                                borderRadius: 20,
                                width: 300,
                                paddingHorizontal: 25,
                                fontSize: 30,
                                color: 'black',
                                textAlign: 'center'
                            }}
                            placeholder="Enter Session ID..."
                            placeholderTextColor="#838181"
                            onChangeText={setTempCode}
                            value={tempCode}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            returnKeyType="done"
                        />

                        {/* submit button */}
                        <TouchableOpacity 
                            style={[styles.button, {
                                backgroundColor: '#28a745',
                                marginTop: 20,
                                width: '50%',
                                height: 80,
                                justifyContent: 'center',
                                opacity: loading ? 0.6 : 1,
                                paddingHorizontal: 20,
                                paddingVertical: 0
                            }]} 
                            disabled={loading}
                            onPress={joinSession}
                        >
                            <View style={{ height: 60, justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={[styles.buttonText, { 
                                    fontSize: loading ? 32 : 40, 
                                    lineHeight: 45, 
                                    textAlignVertical: 'center', 
                                    includeFontPadding: false 
                                    }]}>
                                    {loading ? "Joining..." : "Submit"}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.View>
        </View>
        </TouchableWithoutFeedback>
    </View>
    );
}