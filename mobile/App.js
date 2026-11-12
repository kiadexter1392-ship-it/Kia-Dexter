import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import CoachDashboardScreen from './src/screens/CoachDashboardScreen';
import MemberPanelScreen from './src/screens/MemberPanelScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#1a1a1a' },
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="CoachDashboard" component={CoachDashboardScreen} />
        <Stack.Screen name="MemberPanel" component={MemberPanelScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
