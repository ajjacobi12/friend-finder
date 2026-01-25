import React from 'react'; // useState lets app remember things (eg. messages), useEffect allows app to perform actions (eg. connecting ot the server) as soon as it opens
import { NavigationContainer } from '@react-navigation/native'; // components; similar to HTML's tags <div> or <h1>, view = <div>, text for all strings
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// import screens
import HomeScreen from './screens/HomeScreen';
import ChatScreen from './screens/ChatScreen';
import MapScreen from './screens/MapScreen';

// create the "stack" to allow screens to slide on top of each other
const Stack = createNativeStackNavigator();

export default function App() { 
  return (
    <NavigationContainer>
        {/* navigator manages which screen is currently visible */}

        <Stack.Navigator initialRouteName="Home">
            {/* home screen */}
            <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'Lobby' }}
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

        </Stack.Navigator>
    </NavigationContainer>
  );
}