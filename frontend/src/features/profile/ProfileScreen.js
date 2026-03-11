// frontend/src/features/profile/profilescreen.js

// ---- imports ------
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, StatusBar, Pressable, TextInput, Keyboard, TouchableWithoutFeedback } from 'react-native';

import { styles } from '../../styles/styles';
import { useProfileLogic } from './useProfileLogic';
import ColorPicker from './components/ColorOptions';

import { PROFILE_COLOR_OPTIONS } from '../../constants/profileColorOptions';

// ---- main UI ----
export default function ProfileScreen({ navigation }) {

    const { 
        handleJoin, handleBack, handleColorSelection,
        loading, errorMsg, 
        tempName, setTempName,
        color, hasRegistered, 
        friends, sessionID
    } = useProfileLogic({ navigation, colorOptions: PROFILE_COLOR_OPTIONS });

    const insets = useSafeAreaInsets();
    
    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* start of header */}
            <View style={[styles.customHeader, { height: insets.top, paddingTop: 50 + insets.top }]}>

                {/* LEFT SLOT */}
                <View style={{ flex: 1, alignItems: 'flex-start', justifyContent: 'center' }}>
                    {!hasRegistered && (
                    <Pressable
                        onPress={handleBack}
                        style={({ pressed }) => [
                            styles.headerButton,
                            styles.headerButtonStandard,
                            { backgroundColor: pressed ? '#007aff15' : '#ffffff' }
                        ]}>
                            <Text style={{ color: '#007aff', fontSize: 20, textAlign: 'center', fontWeight: 'bold' }}>❮ Login</Text>
                    </Pressable>
                    )}
                </View>

                {/* CENTER SLOT */}
                <View style={styles.absoluteHeaderTitle}>                    
                    <Text style={styles.headerTitleText}>Profile</Text>
                </View>

                {/* RIGHT SLOT */}
                <View style={{ flex: 1, alignItems: 'flex-end' }} />

            </View> 
            {/* end of header */}

            {/* start of content container */}
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={styles.contentWrapper}>    

                    {/* start of name input */}
                    <Text style={[styles.title, {fontSize: 26, marginTop: 10}]}>Set your username</Text>
                    <View style={[styles.inputWrapper, { paddingVertical: 5, paddingBottom: 0 }]}>
                        <TextInput
                            style={{ fontSize: 25, color: 'black', marginTop: 5, lineHeight: 30 }}
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
                    <ColorPicker
                        options={PROFILE_COLOR_OPTIONS}
                        isSelected={color}
                        friends={friends}
                        onSelect={handleColorSelection}
                    />
                    {/* end of color picker */}
                
                    {errorMsg ? <Text style={{color: 'red'}}>{errorMsg}</Text> : null}

                    {/* enter lobby button */}
                    {(sessionID && !hasRegistered) ? (
                        <Pressable 
                            style={({ pressed }) => [
                                styles.button,
                                pressed && { transform: [{ scale: 0.96 }], backgroundColor: '#005ecb' }
                            ]} 
                            onPress={handleJoin} 
                            disabled={loading}
                        >
                            <Text style={[styles.buttonText, { fontSize: 25 }]}>{loading ? "Entering..." : "Enter Lobby"}</Text>
                        </Pressable>
                    ) : null}

                {/* end of content container */}
                </View>
            </TouchableWithoutFeedback>

        {/* end of entire screen container */}
        </View>
    );
}