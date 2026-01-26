// ----- IMPORTS -------
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StatusBar } from 'react-native';
import { styles } from '../styles';
import { useUser } from '../UserContext';

export default function InitialScreen( { navigation }) {
    const { setSessionId, secureEmit } = useUser();
    const [tempCode, setTempCode] = useState(''); // tempCode holds what user is typing into textInput before hitting "join"
    const [errorMsg, setErrorMsg]  = useState('');
    const [isJoining, setIsJoining] = useState(false);

    // ------ START NEW SESSION --------
    const startNewSession = () => {
        // generate random 6 character key
        const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
        // tell server to create and track this room
        secureEmit('create-session', newId);
        // update global context
        setSessionId(newId);
        // move to profile setup
        navigation.navigate('Profile');
    };

    // ------ JOIN EXISTING SESSION ------
    // this is socket.io acknowledgement, it's asking a question and waiting for an answer
    // response is a function that theserver executes once it finishes checking its database
    const joinSession = () => {
        if (tempCode.length > 0) {
            const code = tempCode.toUpperCase();
            // ask the server "is this a real session?"
            secureEmit('join-session', code, (response) => {
                if (response.exists) {
                    if (response.currentUsers) {
                        const taken = response.currentUsers.map(u => u.color);
                        setTakenColors(taken);
                    }
                    setSessionId(code);
                    navigation.navigate('Profile');
                } else {
                    setErrorMsg("Session not found. Check the code!");
                    setTimeout(() => setErrorMsg(""), 5000);
                }
            });
        }
    };

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
                    <TextInput
                        style={[styles.input, {height: 100, backgroundColor: 'lightgrey', borderRadius: 20, marginTop: 20, width: '75%', paddingHorizontal: 25, fontSize: 25}]}
                        placeholder="Enter Session ID..."
                        placeholderTextColor="#000000"
                        onChangeText={setTempCode}
                        value={tempCode}
                        />
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: '#28a745', marginTop: 20, width: '50%', height: 80, justifyContent: 'center'}]}
                        onPress={joinSession}
                    >
                        <Text style={[styles.buttonText, { fontSize: 30 }]}>Submit</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
     );}