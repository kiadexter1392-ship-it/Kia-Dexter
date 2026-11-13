import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.logo}>
        <Text style={styles.logoText}>AD</Text>
      </View>
      <Text style={styles.title}>ارسلان دوجو</Text>
      <Text style={styles.subtitle}>نسخه ۱.۰.۰</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#c9a44e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#c9a44e',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
  },
});
