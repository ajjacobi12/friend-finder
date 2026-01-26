// This file is the air traffic control of the app. It doesn't show much content, 
// but it decides which screen/page is in front of the user andprovides global data
// for those screens

// --- IMPORTS ----
import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native'; // manages app state and links app to phone's back button
import { createNativeStackNavigator } from '@react-navigation/native-stack'; // creates a mechanism where screens behave like a deck of cards
import { UserProvider } from './UserContext' // "global memory", wrapping everything in this, every screen can access the same data without having to pass it manually every time
import { navigationRef } from './navigationService';

// import screens
import ProfileScreen from './screens/ProfileScreen'
import HomeScreen from './screens/HomeScreen';
import ChatScreen from './screens/ChatScreen';
import MapScreen from './screens/MapScreen';
import InitialScreen from './screens/LoginScreen'

// initializing the Stack tool to allow screens to slide on top of each other
// two components: stack.navigator (the manager) and stack.screen (the individual pages)
const Stack = createNativeStackNavigator();

export default function App() { 
  return (
    <UserProvider> 
        {/* wrapping in this to allow global access of user data */}

        <NavigationContainer ref={navigationRef}>
        {/* wrapping in this to allow navigator to manage which screen is currently visible */}

            <Stack.Navigator initialRouteName="Login">
                {/* initialRouteName dictates which screen first pops up upon opening app */}
                
                {/* ---- DEFINING THE SCREENS ---- */}

                {/* initial screen */}
                <Stack.Screen
                name="Login" 
                component={InitialScreen} 
                options={{ title: 'Login' }} 
                />  
                {/* ID of the screen */}
                {/* links name to actual file imported */}
                {/* controls the header, what user sees on app */}

                {/* profile screen */}
                <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ title: 'Profile Setup' }}
                />    

                {/* map screen */}
                <Stack.Screen
                name="Map"
                component={MapScreen}
                options={{ title: 'Friend Map' }}
                />

                {/* chat screen */}
                <Stack.Screen
                name="Chat"
                component={ChatScreen}
                options={{ title: 'Messages' }}
                />           

                {/* home screen */}
                <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{ title: 'Lobby' }}
                />

            </Stack.Navigator>
        </NavigationContainer>
    </UserProvider>
  );
}