// ---- imports ------
import React, { useState, useCallback, useRef, useEffect } from 'react'; // useState lets app remember things (eg. messages), useEffect allows app to perform actions (eg. connecting ot the server) as soon as it opens
import { Text, View, StatusBar, TouchableOpacity, TextInput } from 'react-native'; // components; similar to HTML's tags <div> or <h1>, view = <div>, text for all strings
import { useFocusEffect } from '@react-navigation/native';
import { styles } from '../styles';
import { useUser } from '../UserContext';


// ---- main UI ----
export default function ProfileScreen({ navigation }) {
    // grab "setter" functions from Context
    const { name, setName, selectedColor, setSelectedColor, hasRegistered, 
        setHasRegistered, secureEmit, sessionId, handleCleanExit, friends, socket } = useUser();

    const [errorMsg, setErrorMsg] = useState(""); // to hold the "Already picked" text
    const colorOptions = ['#a0220c', '#2e8b56', '#1e8fff', '#ffd900', '#8824ec',
        '#2ec4ff', '#ff9500', '#095517', '#ff00f7', '#091490', '#09f34f', '#ff0000'
    ];
    const [tempName, setTempName] = useState(name);
    const nameRef = useRef(name);
    const isCleaningUp = useRef(false);
    
    const handleJoin = () => {
        // check if color is taken before joining
        const isColorTaken = friends.some(f =>
            f.color?.toLowerCase() === selectedColor?.toLowerCase() &&
            f.id !== socket.id
        );

        if (isColorTaken) {
            setErrorMsg("That color is taken, please pick another one!");
            return;
        }
        
        setName(tempName);
        setHasRegistered(true);
        // navigate to home screen
        setTimeout(() => {
            navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
         });
        }, 0);
    };

    useEffect(() => {
        nameRef.current = tempName;
    }, [tempName]);

    useFocusEffect(
        useCallback(() => {
            return () => {
                if (hasRegistered) {
                    setName(nameRef.current);  
                }
            };
        }, [hasRegistered, setName])
    );

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            const actionType = e?.action?.type;

            if (hasRegistered || isCleaningUp.current || actionType === 'RESET') {
                return;
            }
            
            isCleaningUp.current = true;
            console.log("Back-exit button detected. Cleaning up...");

            if (sessionId) {
                secureEmit('leave-session', sessionId);
            }

            handleCleanExit();
        });

        return unsubscribe;
    }, [navigation, secureEmit, sessionId, hasRegistered, handleCleanExit]);


    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            
            <Text style={[styles.title, {fontSize: 26}]}>Set your username</Text>
                <View style={styles.box}>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter your name..."
                        value={tempName}
                        onChangeText={setTempName} // directly updates global context
                    />
                </View>
    
            <View style={{ marginVertical: 10, height: 1, backgroundColor: '#eee' }} />


                {/* color picker row */}
                <Text style={[styles.title, {fontSize: 21}]}>Choose your color</Text>
                <View style={styles.colorContainer}>
                    {colorOptions.map((color) => {
                        const heldBySomeoneElse = friends.some(f =>
                            f.color?.toLowerCase() === color.toLowerCase() &&
                            f.id !== socket?.id
                        );

                        return (
                            <TouchableOpacity
                                key={color}
                                disabled={heldBySomeoneElse}
                                style={[
                                    styles.colorCircle,
                                    { backgroundColor: color }, 
                                    heldBySomeoneElse && { opacity: 0.3, borderColor: 'black', borderWidth: 3},
                                    selectedColor === color && { borderWidth: 3, borderColor: 'black' }
                                ]}
                                onPress={() => {
                                    setSelectedColor(color);
                                    setErrorMsg("");
                                }} 
                            />
                        );
                    })}
                </View>
                
                {errorMsg ? <Text style={{color: 'red'}}>{errorMsg}</Text> : null}
                
                {!hasRegistered ? (
                <TouchableOpacity style={styles.button} onPress={handleJoin}>
                    <Text style={styles.buttonText}>Enter Lobby</Text>
                </TouchableOpacity>
                ) : ( null
                )}

            </View>
    );
}

