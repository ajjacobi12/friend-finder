// ---- imports ------
import React, { useState, useCallback, useRef, useEffect } from 'react'; // useState lets app remember things (eg. messages), useEffect allows app to perform actions (eg. connecting ot the server) as soon as it opens
import { Text, View, StatusBar, Pressable, TextInput, Keyboard, TouchableWithoutFeedback } from 'react-native'; // components; similar to HTML's tags <div> or <h1>, view = <div>, text for all strings
import { useFocusEffect } from '@react-navigation/native';
import { styles } from '../styles';
import { useUser } from '../UserContext';

// ---- main UI ----
export default function ProfileScreen({ navigation }) {
    // grab "setter" functions from Context
    const { name, setName, selectedColor, setSelectedColor, hasRegistered, 
        setHasRegistered, secureEmit, sessionId, setSessionId, handleCleanExit, 
        sessionUsers, setSessionUsers, setIsHost, socket } = useUser();

    const [errorMsg, setErrorMsg] = useState(""); // to hold the "Already picked" text
    const colorOptions = ['#a0220c', '#2e8b56', '#1e8fff', '#ffd900', '#8824ec',
        '#2ec4ff', '#ff9500', '#095517', '#ff00f7', '#091490', '#09f34f', '#ff0000'
    ];
    const [tempName, setTempName] = useState(name);
    const [loading, setLoading] = useState(false);
    const friends = sessionUsers.filter(u => u.id !== socket.id);

    // --- KEEPING TRACK OF COLORS ALREADY SELECTED BY FRIENDS -----
    useEffect(() => {
        const takenColors = friends.map(f => f.color);
        if (!selectedColor || takenColors.includes(selectedColor)) {
            const firstAvailable = colorOptions.find(color => !takenColors.includes(color));

            if (firstAvailable) {
                setSelectedColor(firstAvailable);
            }
        }
    }, [friends]);

    // --- REMEMBER PREVIOUS NAMES ENTERED ----
    useEffect(() => {
        if (name && !tempName) {
            setTempName(name);
        }
    }, [name]);

    // --- SAVES USERNAME WHEN SWITCHING TABS ---
    useFocusEffect(
        useCallback(() => {
            return () => {
                // only update if user is already registered, the name isn't empty, and the name actually changes
                if (hasRegistered) {
                    if (tempName.trim() === "") {
                        setTempName(name);
                    } else if (tempName.trim() !== name) {
                        secureEmit('update-user', {
                            name: tempName.trim(),
                            color: selectedColor,
                            sessionId
                        }, (response) => {
                            if (response && response.success) {
                                setName(tempName.trim());
                                console.log("Auto-save successful");
                            } else {
                                setTempName(name);
                                console.log("Auto-save for color failed: ", response?.message);
                            }
                        });
                    }
                }
            };
        }, [hasRegistered, tempName, name, selectedColor, setName, sessionId])
    );

    // --- HANDLE SWIPING BACK BASED ON HASREGISTERED ----
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            // CASE 1: The user has joined, do nothing
            if (hasRegistered) return;

            // CASE 2: user has not registered, redirect them to login and cleanup
            console.log("Swiping back to Login...");
            if (sessionId)  {
                secureEmit('leave-session', sessionId);
            }
            // handle clean exit stuff except the navigation part
            setSessionId(null);
            setSessionUsers([]);
            setSelectedColor("#a0220c");
            setIsHost(false);
        });

        return unsubscribe;
    }, [navigation, hasRegistered, sessionId]);


    // --- ENTER THE LOBBY FOR THE FIRST TIME ----
    const handleJoin = () => {
        if (loading) return;
        // make sure user has input a name
        if (!tempName || tempName.trim() === "") {
            setErrorMsg("Please enter a username!");
            return;
        }

        // color selection stuff
        if (!selectedColor) {
            setErrorMsg("Please select a color!");
            return;
        }

        // check if color is taken before joining
        const isColorTaken = friends.some(f => f.color === selectedColor);
        if (isColorTaken) {
            setErrorMsg("That color is taken, please pick another one!");
            return;
        }
        
        Keyboard.dismiss();
        setErrorMsg("");
        setLoading(true);

        // tell server who user is before switching screens
        secureEmit('update-user', {
            name: tempName.trim(),
            color: selectedColor
        }, (response) => {
            setLoading(false);
            if (response && response.success) {
                // update locally only after server confirms
                setName(tempName.trim());
                setHasRegistered(true);
            } else {
                setErrorMsg(response.message || "Error joining lobby.");
            }
        });
    };

    // --- GO BACK TO LOGIN SCREEN OR LOBBY ---
    const handleBack = () => {
        Keyboard.dismiss();
        // if entering the profile setup for the first time and going back to login screen
        console.log("User cancelled setup. Returning to login and cleaning up.");
        if (sessionId)  {
            secureEmit('leave-session', sessionId);
        }
        handleCleanExit();
        navigation.goBack();
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* start of header */}
            <View style={styles.customHeader}>
                <View style={{ justifyContent: 'center' }}>
                    {!hasRegistered && (
                    <Pressable
                        onPress={handleBack}
                        style={({ pressed }) => ({
                            marginLeft: 0, 
                            marginTop: 55,
                            height: 45,
                            paddingHorizontal: 10, 
                            paddingVertical: 10,
                            borderRadius: 20, 
                            backgroundColor: '#007aff' + '25',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: '#007bff52'
                        })}>
                            <Text style={{ color: 'black', fontSize: 20, textAlign: 'center'}}>❮ Login</Text>
                    </Pressable>
                    )}
                </View>

                <View style={styles.absoluteHeaderTitle}>                    
                    <Text style={{ fontFamily: 'Courier', fontSize: 30, fontWeight: 'bold' }}>Profile</Text>
                </View>

                {/* empty right slot */}
                <View/>

            </View> 
            {/* end of header */}

            {/* start of content container */}
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={styles.contentWrapper}>    

                    {/* start of name input */}
                    <Text style={[styles.title, {fontSize: 26, marginTop: 10}]}>Set your username</Text>
                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={{ fontSize: 20, color: 'black' }}
                            placeholder="Enter your name..."
                            value={tempName}
                            onChangeText={setTempName}
                            autoFocus={false}
                            maxLength={15}
                        />
                    </View>
                    {/* end of name input */}

                    <View style={{ marginVertical: 10, height: 1, backgroundColor: '#eee' }} />

                    {/* color picker row */}
                    <Text style={[styles.title, {fontSize: 21}]}>Choose your color</Text>
                    <View style={styles.colorContainer}>
                        {colorOptions.map((color) => {
                            const heldBySomeoneElse = friends.some(f => f.color === color);
                                return (
                                    <Pressable
                                        key={color}
                                        disabled={heldBySomeoneElse}
                                        style={[
                                            styles.colorCircle,
                                            { backgroundColor: color }, 
                                            heldBySomeoneElse && { opacity: 0.3, borderColor: '#696969', borderWidth: 3},
                                            selectedColor === color && { borderWidth: 3, borderColor: '#000000' }
                                        ]}
                                        onPress={() => {
                                            const previousColor = selectedColor;
                                            setSelectedColor(color);
                                            setErrorMsg("");

                                            if (hasRegistered) {
                                                secureEmit('update-user', {
                                                    name: tempName.trim() || name,
                                                    color: color,
                                                    sessionId
                                                }, (response) => {
                                                    if (response && response.success) {
                                                        setName(tempName.trim());
                                                    } else {
                                                        setSelectedColor(previousColor);
                                                        setErrorMsg(response.message || "Error saving profile.");
                                                    }
                                                });
                                            }
                                        }} 
                                    />
                                );
                        })}
                    </View>
                    {/* end of color picker */}
                
                    {errorMsg ? <Text style={{color: 'red'}}>{errorMsg}</Text> : null}

                    {/* enter lobby button */}
                    {(sessionId && !hasRegistered) ? (
                        <Pressable 
                            style={styles.button} 
                            onPress={handleJoin} 
                            disabled={loading}
                        >
                            <Text style={[styles.buttonText, { fontSize: 25}]}>{loading ? "Entering..." : "Enter Lobby"}</Text>
                        </Pressable>
                    ) : null}

                {/* end of content container */}
                </View>
            </TouchableWithoutFeedback>

        {/* end of entire screen container */}
        </View>
    );
}