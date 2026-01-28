// This file is the air traffic control of the app. It doesn't show much content, 
// but it decides which screen/page is in front of the user andprovides global data
// for those screens

// --- IMPORTS ----
import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { DefaultTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native'; // manages app state and links app to phone's back button
//import { createNativeStackNavigator } from '@react-navigation/native-stack'; // creates a mechanism where screens behave like a deck of cards
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { UserProvider } from './UserContext' // "global memory", wrapping everything in this, every screen can access the same data without having to pass it manually every time
import { navigationRef } from './navigationService';

// import screens
import ProfileScreen from './screens/ProfileScreen'
import HomeScreen from './screens/HomeScreen';
import ChatScreen from './screens/ChatScreen';
import MapScreen from './screens/MapScreen';
import LoginScreen from './screens/LoginScreen'

// initializing the Stack tool to allow screens to slide on top of each other
// two components: stack.navigator (the manager) and stack.screen (the individual pages)
const Stack = createStackNavigator();

const myTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#ffffff',
    card: '#ffffff',
  },
};

export default function App() { 
  return (
    <UserProvider> 
        {/* wrapping in this to allow global access of user data */}

        <NavigationContainer ref={navigationRef} theme={myTheme}>
        {/* wrapping in this to allow navigator to manage which screen is currently visible */}

            <Stack.Navigator 
              initialRouteName="Login"
              screenOptions={{
                headerStyle: { 
                  backgroundColor: '#ffffff',
                  elevation: 0,
                  shadowOpacity: 0,
                  borderBottomWidth: 0,
                },
                cardStyle: { backgroundColor: '#ffffff' },
                headerMode: 'screen',
                headerShadowVisible: false,
                cardStyleInterpolator: CardStyleInterpolators.forFadeFromBottomAndroid,
              }}>

                {/* initialRouteName dictates which screen first pops up upon opening app */}
                
                {/* ---- DEFINING THE SCREENS ---- */}

                {/* initial screen */}
                <Stack.Screen
                name="Login" 
                component={LoginScreen} 
                options={{ title: 'Login' }} 
                />  
                {/* ID of the screen */}
                {/* links name to actual file imported */}
                {/* controls the header, what user sees on app */}

                {/* profile screen */}
                <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ 
                  title: 'Profile Setup',
                  headerTitleStyle: { 
                    fontSize: 27, 
                    fontWeight: 'bold',
                    fontFamily: 'Courier',
                    color: '#2f2f4d'
                  } }}
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
                options={{ 
                  title: 'Chat',
                  headerTitleStyle: { 
                    fontSize: 40, 
                    fontWeight: 'bold',
                    fontFamily: 'Courier',
                    color: '#2f2f4d'
                  }
                 }}
                />           

                {/* home screen */}
                <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{ 
                  title: 'Lobby',
                  headerTitleStyle: { 
                    fontSize: 40, 
                    fontWeight: 'bold',
                    fontFamily: 'Courier',
                    color: '#2f2f4d'
                  }
                 }}
                />

            </Stack.Navigator>
        </NavigationContainer>
    </UserProvider>
  );
}