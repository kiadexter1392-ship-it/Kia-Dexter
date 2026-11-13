import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { api } from '../services/api';

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({ full_name: '', username: '', phone: '', password: '', password2: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const handleRegister = async () => {
    setError('');
    if (!form.full_name.trim()) return setError('نام و نام خانوادگی الزامی است');
    if (!/^[a-zA-Z0-9._-]{3,}$/.test(form.username)) return setError('نام کاربری باید انگلیسی و حداقل ۳ حرف باشد');
    if (form.password.length < 6) return setError('رمز عبور باید حداقل ۶ حرف باشد');
    if (form.password !== form.password2) return setError('تکرار رمز عبور مطابقت ندارد');

    setLoading(true);
    try {
      const result = await api.post('/api/register', form);
      if (result.ok) {
        navigation.replace('MemberPanel', { user: result.user });
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError('خطا در اتصال به سرور');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>→</Text>
          </TouchableOpacity>
          <Text style={styles.title}>ثبت‌نام</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>نام و نام خانوادگی</Text>
          <TextInput style={styles.input} value={form.full_name} onChangeText={set('full_name')} placeholder="مثال: علی احمدی" placeholderTextColor="#6b6560" />

          <Text style={styles.label}>نام کاربری (انگلیسی)</Text>
          <TextInput style={styles.input} value={form.username} onChangeText={set('username')} placeholder="username" placeholderTextColor="#6b6560" autoCapitalize="none" autoCorrect={false} />

          <Text style={styles.label}>شماره موبایل</Text>
          <TextInput style={styles.input} value={form.phone} onChangeText={set('phone')} placeholder="09123456789" placeholderTextColor="#6b6560" keyboardType="phone-pad" />

          <Text style={styles.label}>رمز عبور</Text>
          <TextInput style={styles.input} value={form.password} onChangeText={set('password')} placeholder="حداقل ۶ حرف" placeholderTextColor="#6b6560" secureTextEntry />

          <Text style={styles.label}>تکرار رمز عبور</Text>
          <TextInput style={styles.input} value={form.password2} onChangeText={set('password2')} placeholder="رمز عبور را تکرار کنید" placeholderTextColor="#6b6560" secureTextEntry />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.submitBtn} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#1a1408" /> : <Text style={styles.submitText}>ثبت‌نام</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080d' },
  scroll: { paddingHorizontal: 28, paddingTop: 60, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#14141f', borderWidth: 1, borderColor: '#2a2a40', justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  backText: { color: '#d4a853', fontSize: 20, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '800', color: '#f8f4ec' },
  form: { gap: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#9a9488', marginBottom: 6 },
  input: { backgroundColor: '#14141f', borderWidth: 1, borderColor: '#2a2a40', borderRadius: 14, padding: 16, fontSize: 15, color: '#f8f4ec', textAlign: 'right' },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center', marginTop: 4 },
  submitBtn: { backgroundColor: '#d4a853', borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 8, shadowColor: '#d4a853', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 },
  submitText: { fontSize: 16, fontWeight: '700', color: '#1a1408' },
});
