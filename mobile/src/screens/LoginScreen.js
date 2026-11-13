import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { api } from '../services/api';

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('نام کاربری و رمز عبور را وارد کنید');
      return;
    }
    setLoading(true);
    try {
      const role = username === 'arsalan' ? 'coach' : 'member';
      const endpoint = role === 'coach' ? '/api/login' : '/api/login';
      const result = await api.post(endpoint, { username, password });
      if (result.ok) {
        if (role === 'coach') {
          navigation.replace('CoachDashboard', { user: result.user });
        } else {
          navigation.replace('MemberPanel', { user: result.user });
        }
      } else {
        setError(result.error || 'نام کاربری یا رمز عبور اشتباه است');
      }
    } catch (e) {
      setError('خطا در اتصال به سرور');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>AD</Text>
          </View>
          <Text style={styles.brandName}>ارسلان دوجو</Text>
          <Text style={styles.brandSub}>ARSLAN DOJO</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>نام کاربری</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="نام کاربری خود را وارد کنید"
            placeholderTextColor="#6b6560"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>رمز عبور</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="رمز عبور"
            placeholderTextColor="#6b6560"
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#1a1408" />
            ) : (
              <Text style={styles.loginBtnText}>ورود به پنل</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLink}>حساب کاربری ندارید؟ <Text style={styles.registerLinkBold}>ثبت‌نام کنید</Text></Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080d',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: '#d4a853',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#d4a853',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  logoText: {
    fontSize: 38,
    fontWeight: '800',
    color: '#1a1408',
  },
  brandName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f8f4ec',
    marginBottom: 4,
  },
  brandSub: {
    fontSize: 11,
    color: '#6b6560',
    letterSpacing: 3,
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9a9488',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#14141f',
    borderWidth: 1,
    borderColor: '#2a2a40',
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    color: '#f8f4ec',
    textAlign: 'right',
  },
  error: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  loginBtn: {
    backgroundColor: '#d4a853',
    borderRadius: 14,
    padding: 17,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#d4a853',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1408',
  },
  registerLink: {
    textAlign: 'center',
    color: '#9a9488',
    fontSize: 14,
    marginTop: 8,
  },
  registerLinkBold: {
    color: '#d4a853',
    fontWeight: '700',
  },
});
