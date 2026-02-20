// loginscreen.js
// ----- IMPORTS -------
import React, { useRef, useState } from 'react';
import { View, Text, TextInput, StatusBar, Pressable, Animated, Dimensions, Keyboard, TouchableWithoutFeedback, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { styles } from '../styles/styles';
import { useLoginLogic } from '../hooks/useLoginLogic';

const { width } = Dimensions.get('window');

export default function LoginScreen( { navigation }) {
    const [isJoinScreen, setIsJoinScreen] = useState(false);

    const {
        tempCode, setTempCode,
        errorMsg, setErrorMsg,
        loading, createNewSession, joinSession
    } = useLoginLogic({ navigation, isJoinScreen, hideJoinInput });
        
    const insets = useSafeAreaInsets();
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

    const isJoinDisabled = tempCode.trim().length === 0 || loading;

    // if (!isConnected) {
    //     return (
    //         <View style={[styles.container, {justifyContent: 'center', flex: 1}]}>
    //             <StatusBar barStyle="dark-content" /> 
    //             <View style={{ alignItems: 'center', justifyContent: 'center' }}>
    //                 <Text style={{ fontSize: 22, fontWeight: 'bold', color: 'red', textAlign: 'center' }}>
    //                 The server is offline. Please try again later.
    //                 </Text>
    //             </View>
    //         </View>
    //     );
    // }

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
                    <Pressable 
                        style={[styles.button, { width: '100%', height: 100, justifyContent: 'center', paddingHorizontal: 25}]} 
                        onPress={createNewSession}
                        disabled={loading}
                    >
                        <Text style={[styles.buttonText, {fontSize: 40, textAlign: 'center' }]}>
                            {loading ? "Creating..." : "New Session"}
                        </Text>
                    </Pressable>

                    <View style={{ marginVertical: 40, backgroundColor: '#ccc', height: 2, width: '80%' }} />

                    {/* join session button */}
                    <Pressable 
                        style={[styles.button, { backgroundColor: '#77e1ede4', marginTop: 0, width: '100%', height: 100, justifyContent: 'center'}]} 
                        onPress={showJoinInput}
                        disabled={loading}
                    >
                        <Text style={[styles.buttonText, {fontSize: 40}]}>Join Session</Text>
                    </Pressable>
                </View>
                   
                {/* ---- SCREEN 2: JOIN INPUT (RIGHT) ---- */}
                <View style={{ width: width, flex: 1, alignItems: 'center' }}>

                    {/* START HEADER */}
                    <View style={[styles.customHeader, { height: 60 + insets.top, paddingTop: insets.top, width: width }]}>

                        {/* LEFT SLOT */}
                        <View style={{ flex: 1, alignItems: 'flex-start', justifyContent: 'center' }}>
                            {/* back button */}
                            <Pressable 
                                onPress={hideJoinInput}
                                style={({ pressed }) => [
                                    styles.headerButton,
                                    styles.headerButtonStandard,
                                    { backgroundColor: pressed ? '#007aff15' : '#ffffff' }
                                ]}
                            >
                                <Text style={{ color: '#007aff', fontSize: 20, fontWeight: 'bold' }}>❮ Back</Text>
                            </Pressable>
                        </View>  

                        {/* CENTER SLOT */}
                        <View style={styles.absoluteHeaderTitle}>
                                <Text style={[styles.headerTitleText, { fontSize: 22 }]}>Join Session</Text>
                        </View>

                        {/* RIGHT SLOT */}
                        <View style={{ flex: 1, alignItems: 'flex-end' }} />
                    </View>
                    {/* END HEADER */}

                    <View style={[styles.contentWrapper, { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 230 }]}>
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
                        <Pressable 
                            style={[styles.button, {
                                backgroundColor: '#28a745',
                                marginTop: 20,
                                width: '50%',
                                height: 80,
                                justifyContent: 'center',
                                opacity: isJoinDisabled ? 0.6 : 1,
                                paddingHorizontal: 20,
                                paddingVertical: 0
                            }]} 
                            disabled={isJoinDisabled}
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
                        </Pressable>
                    </View>
                </View>
            </Animated.View>
        </View>
        </TouchableWithoutFeedback>
    </View>
    );
}