// ----- IMPORTS -------
import React, { useState, useLayoutEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StatusBar, Animated, Dimensions, Platform, Keyboard, TouchableWithoutFeedback, PanResponder } from 'react-native';
import { styles } from '../styles';
import { useUser } from '../UserContext';
import { KeyboardAvoidingView } from 'react-native';

const { width } = Dimensions.get('window');


export default function LoginScreen( { navigation }) {
    const { setSessionId, secureEmit, setSessionUsers, isConnected, setIsHost, justCreatedSession } = useUser();
    const [tempCode, setTempCode] = useState(''); // tempCode holds what user is typing into textInput before hitting "join"
    const [errorMsg, setErrorMsg]  = useState('');
    const [isJoinScreen, setIsJoinScreen] = useState(false);
    const [loading, setLoading] = useState(false);

    const slideAnim = useRef(new Animated.Value(0)).current;

    const panResponder = React.useMemo(() =>
        PanResponder.create({
            onStartShouldSetPanResponderCapture: () => false, // capture touch immediately
            onStartShouldSetPanResponder: () => isJoinScreen,
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
        secureEmit('create-session', newId, () => {
            setLoading(false);
            // update global context
            setSessionId(newId);
            setIsHost(true);
            navigation.navigate('Profile'); // move to profile setup
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
            secureEmit('join-session', code, (response) => {
                setLoading(false);
                console.log("Server response for joining session:", response);

                if (response && response.exists && !response.full) {           
                    setErrorMsg("");         
                    if (response.currentUsers) {
                        setSessionUsers(response.currentUsers);
                    }
                    setSessionId(code);
                    setIsHost(false);
                    console.log("Navigating to profile...");
                    navigation.navigate('Profile');
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

            <KeyboardAvoidingView   
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            > 
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
                <View style={{ width: width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: 50 }}>

                    {/* back button */}
                    <TouchableOpacity 
                        onPress={hideJoinInput}
                        style={{ position: 'absolute', top: 0, left: 20, padding: 10}}
                    >
                        <Text style={{ color: '#007aff', fontSize: 20, fontWeight: 'bold' }}>Back</Text>
                    </TouchableOpacity>

                    {/* error message display */}
                    {errorMsg !== "" && (
                        <Text style={{ color: 'red', fontWeight: 'bold', marginBottom: 10, fontSize: 16 }}>
                            {errorMsg}
                        </Text>
                    )}

                    {/* input box */}
                    <TextInput
                        style={[styles.input,{
                            height: 100,
                            backgroundColor: 'lightgrey',
                            borderRadius: 20,
                            width: '75%',
                            paddingHorizontal: 25,
                            fontSize: 30,
                            textAlign: 'center'
                        }]}
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
                            opacity: loading ? 0.6 : 1
                        }]} 
                        disabled={loading}
                        onPress={joinSession}
                    >
                        <Text style={[styles.buttonText, { fontSize: 30 }]}>
                            {loading ? "Joining..." : "Submit"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
        </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    </View>
    );
}