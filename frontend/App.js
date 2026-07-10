// frontend/App.js

// --- IMPORTS ----
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { UserProvider, useUser } from './src/context/UserContext'; 
import { NotificationProvider } from './src/context/NotificationProvider';
import { navigationRef } from './src/core/session/navigationService';

import ProfileScreen from './src/features/profile/ProfileScreen'
import HomeScreen from './src/features/home/HomeScreen';
import ChatScreen from './src/features/chat/ChatScreen';
import MapScreen from './src/features/map/MapScreen';
import LoginScreen from './src/features/login/LoginScreen'

const Stack = createNativeStackNavigator();
// const Tab = createMaterialTopTabNavigator();
const Tab = createBottomTabNavigator();

const myTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#ffffff',
    card: '#ffffff',
  },
};

function TabNavigator() {
  const userContext = useUser();
  if (!userContext) {
    console.log("user context hasn't loaded yet.");
    return  null;
  }
  const { unreadRooms } = useUser();
  const hasUnread = unreadRooms.length > 0;

  return(
    <Tab.Navigator
      // tabBarPosition="bottom"
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        // swipeEnabled: true,
        headerShown: false,
        tabBarActiveTintColor: '#007aff',
        tabBarInactiveTintColor: 'gray',
        // tabBarIndicatorStyle: { height: 0 },
        tabBarStyle: {
          height: 70,
          paddingBottom: 15,
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.2,
          shadowRadius: 10,
        },
        tabBarItemStyle: {
          borderRightWidth: 1,
          borderRightColor: '#e0e0e0',
          borderLeftWidth: 2,
          borderLeftColor: 'rgba(255, 255, 255, 0.8)',
          marginVertical: 4, 
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
      // initialRouteName="Login"
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
    <SafeAreaProvider>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >       
          <NotificationProvider>
            <UserProvider> 

              <NavigationContainer ref={navigationRef} theme={myTheme}>
                  <AppNavigator/>
              </NavigationContainer>
          
          </UserProvider>
        </NotificationProvider>
      </KeyboardAvoidingView>
    </SafeAreaProvider>
  );
}