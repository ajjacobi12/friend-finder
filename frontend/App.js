// This file is the air traffic control of the app. It doesn't show much content, 
// but it decides which screen/page is in front of the user andprovides global data
// for those screens

// --- IMPORTS ----
import 'react-native-get-random-values';
import React from 'react';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native'; // manages app state and links app to phone's back button
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { UserProvider, useUser } from './UserContext' // "global memory", wrapping everything in this, every screen can access the same data without having to pass it manually every time
import { navigationRef } from './navigationService';
import { TouchableOpacity, Pressable, Text, View} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// import screens
import ProfileScreen from './screens/ProfileScreen'
import HomeScreen from './screens/HomeScreen';
import ChatScreen from './screens/ChatScreen';
import MapScreen from './screens/MapScreen';
import LoginScreen from './screens/LoginScreen'

// initializing the Stack tool to allow screens to slide on top of each other
// two components: stack.navigator (the manager) and stack.screen (the individual pages)
const Stack = createNativeStackNavigator();
const Tab = createMaterialTopTabNavigator();

const myTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#ffffff',
    card: '#ffffff',
  },
};

function TabNavigator() {
  const { unreadRooms } = useUser();
  const hasUnread = unreadRooms.length > 0;

  return(
    <Tab.Navigator
      tabBarPosition="bottom"
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        swipeEnabled: true,
        headerShown: false,
        tabBarActiveTintColor: '#007aff',
        tabBarInactiveTintColor: 'gray',
        tabBarIndicatorStyle: { height: 0 },
        tabBarStyle: {
          height: 80,
          paddingBottom: 10,
          backgroundColor: '#ffffff',
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
        },
        tabBarIcon: ({ focused, color }) => {
          let iconName;
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Map') iconName = focused ? 'map' : 'map-outline';
          else if (route.name === 'Chat') iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={24} color={color} />;
        }
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{
          tabBarIcon: ({ focused, color }) => (
            <View>
              <Ionicons
                name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
                size={24}
                color={color}
              />
              {hasUnread && (
                <View style={{
                  position: 'absolute',
                  right: -6,
                  top: -3,
                  backgroundColor: 'red',
                  borderRadius: 6,
                  width: 12,
                  height: 12,
                  justifyContent: 'center',
                  alignItems: 'center',
                }} />
              )}
            </View>
          )
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
  );
}

function AppNavigator() {
  const { hasRegistered } = useUser();


  return (
    <Stack.Navigator 
      initialRouteName="Login"
      screenOptions={{ headerShown: false }}
    >
      {!hasRegistered ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />  
          <Stack.Screen name="Profile" component={ProfileScreen} />
        </>
      ) : (
      <Stack.Screen name="MainTabs" component={TabNavigator} />    
      )}
     </Stack.Navigator>
  );
}

export default function App() { 
  return (
    <UserProvider> 
        {/* wrapping in this to allow global access of user data */}

        <NavigationContainer ref={navigationRef} theme={myTheme}>
        {/* wrapping in this to allow navigator to manage which screen is currently visible */}
            <AppNavigator/>
        </NavigationContainer>
    </UserProvider>
  );
}