import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Keyboard } from 'react-native';
import { useUser } from '../UserContext';

export default function ChatScreen({ navigation }) {
    const { socket, sessionId, name, selectedColor, secureEmit } = useUser();
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const flatListRef = useRef();

    useLayoutEffect(() => {
        navigation.setOptions({
            headerStyle: {
            backgroundColor: '#ffffff',
            elevation: 0,
            shadowOpacity: 0,
            height: 125,
        },
    headerRight: () => (
        <TouchableOpacity 
            activeOpacity={1}
            onPress={null}  // () => means do this only when button is pressed
            style={{ 
                marginRight: 15, 
                paddingHorizontal: 13,
                paddingVertical: 13,
                borderRadius: 17, 
                backgroundColor: selectedColor + '25' }}>
            <Text style={{ color: '#000000', fontWeight: 'bold', fontSize: 22, textAlign: 'center'}}>{"☰ Users"}</Text>
        </TouchableOpacity>
        ),
    });
    }, [navigation]);

    // --- LISTEN FOR MESSAGES ---
    useEffect(() => {
        socket.on('receive-message', (data) => {
            setMessages((prevMessages) => [...prevMessages, data]);
        });
        
        return () => socket.off('receive-message');
    }, []);

    // --- SEND MESSAGE ---
    const sendMessage = () => {
        if (message.trim().length > 0) { // don't send empty messages
            const messageData = {
                roomID: sessionId,
                sender: name,
                text: message,
                color: selectedColor,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                id: socket.id // to identify own messages
            };
            secureEmit('send-message', messageData);
            setMessages((prevMessages) => [...prevMessages, messageData]); // add to local chat as well
            setMessage(''); // clear input box   
        } 
    };
        
    // --- LAYOUT ---
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height" }
            keyboardVerticalOffset={120}
            style={{ flex: 1, backgroundColor: '#f5f5f5' }}
        >
        {/* --- MESSAGE LIST --- */}
        <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) => index.toString()}
            onContentSizeChange={() => flatListRef.current.scrollToEnd({ animated: true })}
            renderItem={({ item }) => (
                <View style={[
                    styles.messageBubble,
                    item.id === socket.id ? styles.myMessage : styles.theirMessage
                ]}>
                    <Text style={{ fontWeight: 'bold', color: item.color, fontSize: 12 }}>
                        {item.sender} • {item.time}
                    </Text>
                    <Text style={{ fontSize: 16, marginTop: 5 }}>
                        {item.text}
                    </Text>
                </View>
            )}
        />

        {/* --- INPUT BOX --- */}
        <View style={styles.inputContainer}>
            <TextInput
                style={[styles.input, { fontSize: 18 }]}
                placeholder="Type a message..."
                value={message}
                onChangeText={setMessage}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
                placeholderTextColor="#838181"
            />
            <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
                <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 18 }}>Send</Text>
            </TouchableOpacity>
        </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    messageBubble: {
        padding: 10,
        margin: 10,
        borderRadius: 10,
        maxWidth: '80%',
    },
    myMessage: {
        backgroundColor: '#007aff' + '20',
        alignSelf: 'flex-end',
        borderBottomRightRadius: 0,
    },
    theirMessage: {
        backgroundColor: '#e5e5ea',
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 0,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 10,
        backgroundColor: 'white',
        alignItems: 'center',
        bottomMargin: 40,
        height: 80,
        paddingHorizontal: 30,
    },
    input: {
        flex: 1,
        height: 40,
        borderColor: '#ddd',
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 15,
        marginRight: 10,
        backgroundColor: '#fff',
        bottomMargin: 40,
        height: 45,
    },
    sendButton: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
        height: 40,
        backgroundColor: '#007aff',
        borderRadius: 20,
    },
});