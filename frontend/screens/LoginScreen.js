// ----- IMPORTS -------
import React, { useState, useLayoutEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StatusBar, Animated, Dimensions, Platform } from 'react-native';
import { styles } from '../styles';
import { useUser } from '../UserContext';
import { KeyboardAvoidingView } from 'react-native';

const { width } = Dimensions.get('window');

export default function LoginScreen( { navigation }) {
    const { setSessionId, secureEmit, setSessionUsers, isConnected, setIsHost } = useUser();
    const [tempCode, setTempCode] = useState(''); // tempCode holds what user is typing into textInput before hitting "join"
    const [errorMsg, setErrorMsg]  = useState('');
    // const [isJoining, setIsJoining] = useState(false);
    const [loading, setLoading] = useState(false);

    const slideAnim = useRef(new Animated.Value(0)).current;

    // ------ START NEW SESSION --------
    const startNewSession = () => {
        if (loading || !isConnected) return;
        setLoading(true);
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

                if (response && response.exists) {           
                    setErrorMsg("");         
                    if (response.currentUsers) {
                        setSessionUsers(response.currentUsers);
                    }
                    setSessionId(code);
                    setIsHost(false);
                    console.log("Navigating to profile...");
                    navigation.navigate('Profile');
                } else {
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
        setErrorMsg("");
        Animated.timing(slideAnim, {
            toValue: -width, // slide whole container left by one screen width
            duration: 300,
            useNativeDriver: true,
        }).start();
    };

    const hideJoinInput = () => {
        setTempCode(""); // clears input when going back
        setErrorMsg("");
        Animated.timing(slideAnim, {
            toValue: 0, // slide back to original position
            duration: 300,
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
        <View style={{ flex: 1, backgroundColor: '#ffffff', overflow: 'hidden' }}>
            <StatusBar barStyle="dark-content" />

            <KeyboardAvoidingView   
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            > 
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
                        style={[styles.button, { width: '100%', height: 100, justifyContent: 'center'}]} 
                        onPress={startNewSession}
                        disabled={loading}
                    >
                        <Text style={[styles.buttonText, {fontSize: 32 }]}>
                            {loading ? "Creating..." : "Start New Session"}
                        </Text>
                    </TouchableOpacity>

                    <View style={{ marginVertical: 30, backgroundColor: '#ccc', height: 2, width: '80%' }} />

                    {/* join session button */}
                    <TouchableOpacity 
                        style={[styles.button, { backgroundColor: '#77e1ede4', marginTop: 10, width: '100%', height: 100, justifyContent: 'center'}]} 
                        onPress={showJoinInput}
                        disabled={loading}
                    >
                        <Text style={[styles.buttonText, {fontSize:40}]}>Join Session</Text>
                    </TouchableOpacity>
                </View>
                   
                {/* ---- SCREEN 2: JOIN INPUT (RIGHT) ---- */}
                <View style={{ width: width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
                    
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
        </KeyboardAvoidingView>
    </View>
    );
}