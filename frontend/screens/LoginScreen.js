// ----- IMPORTS -------
import React, { useState, useLayoutEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StatusBar } from 'react-native';
import { styles } from '../styles';
import { useUser } from '../UserContext';

export default function LoginScreen( { navigation }) {
    const { setSessionId, secureEmit, setFriends } = useUser();
    const [tempCode, setTempCode] = useState(''); // tempCode holds what user is typing into textInput before hitting "join"
    const [errorMsg, setErrorMsg]  = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [loading, setLoading] = useState(false);

    // ------ START NEW SESSION --------
    const startNewSession = () => {
        if (loading) return;
        setLoading(true);
        // generate random 6 character key
        const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
        // tell server to create and track this room
        secureEmit('create-session', newId, () => {
            setLoading(false);
            // update global context
            setSessionId(newId);
            // move to profile setup
            navigation.navigate('Profile');
        });
    };

    // ------ JOIN EXISTING SESSION ------
    // this is socket.io acknowledgement, it's asking a question and waiting for an answer
    // response is a function that theserver executes once it finishes checking its database
    const joinSession = () => {
        if (!tempCode || loading) return;
        setLoading(true);

        if (tempCode.length > 0) {
            const code = tempCode.toUpperCase();
            console.log("Sending join request for session:", code);

            // ask the server "is this a real session?"
            secureEmit('join-session', code, (response) => {
                setLoading(false);
                console.log("Server response for joining session:", response);

                if (response.exists) {           
                    setErrorMsg("");         
                    if (response.currentUsers) {
                        setFriends(response.currentUsers)
                    }
                    setSessionId(code);
                    console.log("Navigating to profile...");
                    navigation.navigate('Profile');
                } else {
                    setErrorMsg("Session not found. Check the code!");
                    setTimeout(() => {setErrorMsg("")}, 5000);
                }
            });
        }
    };

    useLayoutEffect(() => {
        navigation.setOptions({
          headerBackVisible: false,
          headerTitle: isJoining ? "Join Session" : "",
          headerStyle: {
            backgroundColor: '#ffffff',
            elevation: 0,
            shadowOpacity: 0,
          },
          headerLeft: () => isJoining ? (
            <TouchableOpacity
                activeOpacity={1}
                onPress={() => {
                    setIsJoining(false);
                    setErrorMsg("");
                }}  // () => means do this only when button is pressed
                style={{ marginLeft: 5, paddingHorizontal: 5, backgroundColor: '#ffffff'}}>
              <Text style={{ color: '#007aff', fontWeight: 'bold',fontSize: 20}}>Go Back</Text>
            </TouchableOpacity>
          ) : null,
        });
      }, [navigation, isJoining]);

    return (
        <View style={[styles.container, {justifyContent: 'center', marginTop: 80}]}>
            <StatusBar barStyle="dark-content" /> 
            
            {!isJoining ? (
                <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: -100}}>
                    <TouchableOpacity 
                        style={[styles.button, {width: '100%', marginTop: -6, height: 100, justifyContent: 'center'}]}  
                        onPress={startNewSession}>
                        <Text style={[styles.buttonText, {fontSize: 32}]}>Start New Session</Text>
                    </TouchableOpacity>

                    <View style={{ marginVertical: 30, backgroundColor: '#ccc', height: 2, width: '80%' }} />

                    <TouchableOpacity 
                        style={[styles.button, { backgroundColor: '#77e1ede4', marginTop: 10, width: '100%', height: 100, justifyContent: 'center'}]} 
                        onPress={() => setIsJoining(true)}>
                        <Text style={[styles.buttonText, {fontSize:40}]}>Join Session</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                 <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: -150}}>
                    
                    {errorMsg !== "" && (
                        <Text style={{ color: 'red', fontWeight: 'bold', marginBottom: 10 }}>
                            {errorMsg}
                        </Text>
                    )}
                    
                    <TextInput
                        style={[styles.input, {height: 100, backgroundColor: 'lightgrey', borderRadius: 20, marginTop: 20, width: '75%', paddingHorizontal: 25, fontSize: 25}]}
                        placeholder="Enter Session ID..."
                        placeholderTextColor="#000000"
                        onChangeText={setTempCode}
                        value={tempCode}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        // returnKeyType="done"
                        // onSubmitEditing={joinSession}
                        />
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: '#28a745', marginTop: 20, width: '50%', height: 80, justifyContent: 'center'}]}
                        disabled={loading}
                        onPress={joinSession}
                    >
                        <Text style={[styles.buttonText, { fontSize: 30 }]}>{loading ? "Joining..." : "Submit" }</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
     );}