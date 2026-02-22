// profilescreen.js

// ---- imports ------
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, StatusBar, Pressable, TextInput, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { styles } from '../styles/styles';
import { useProfileLogic } from '../hooks/useProfileLogic';
import ColorPicker from '../components/profile/ColorOptions';

// ---- main UI ----
export default function ProfileScreen({ navigation }) {

    const colorOptions = ['#a0220c', '#2e8b56', '#1e8fff', '#ffd900', '#8824ec',
        '#2ec4ff', '#ff9500', '#095517', '#ff00f7', '#091490', '#09f34f', '#ff0000'
    ];

    const { 
        handleJoin, handleBack, handleColorSelection,
        loading, errorMsg, 
        tempName, setTempName,
        selectedColor, hasRegistered, 
        friends, sessionID
    } = useProfileLogic({ navigation, colorOptions });

    const insets = useSafeAreaInsets();
    
    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* start of header */}
            <View style={[styles.customHeader, { height: 60 + insets.top, paddingTop: insets.top }]}>

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
                    <ColorPicker
                        options={colorOptions}
                        isSelected={selectedColor}
                        friends={friends}
                        onSelect={handleColorSelection}
                    />
                    {/* end of color picker */}
                
                    {errorMsg ? <Text style={{color: 'red'}}>{errorMsg}</Text> : null}

                    {/* enter lobby button */}
                    {(sessionID && !hasRegistered) ? (
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