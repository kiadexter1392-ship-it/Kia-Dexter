import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import api from '../services/api';

export default function RegisterScreen({ navigation }) {
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    password: '',
    password2: '',
    discipline: 'کاراته',
    gender: 'مرد',
    age: '',
    height_cm: '',
    weight_kg: '',
  });
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (formData.password !== formData.password2) {
      Alert.alert('خطا', 'تکرار رمز عبور مطابقت ندارد');
      return;
    }

    setLoading(true);
    try {
      await api.register(formData);
      Alert.alert('موفقیت', 'ثبت‌نام با موفقیت انجام شد', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('خطا', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>→ بازگشت</Text>
        </TouchableOpacity>
        <Text style={styles.title}>ثبت‌نام</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>نام و نام خانوادگی *</Text>
        <TextInput
          style={styles.input}
          value={formData.full_name}
          onChangeText={(v) => setFormData({ ...formData, full_name: v })}
          placeholder="نام کامل"
          placeholderTextColor="#666"
        />

        <Text style={styles.label}>نام کاربری (انگلیسی) *</Text>
        <TextInput
          style={styles.input}
          value={formData.username}
          onChangeText={(v) => setFormData({ ...formData, username: v.toLowerCase() })}
          placeholder="username"
          placeholderTextColor="#666"
          autoCapitalize="none"
        />

        <Text style={styles.label}>رشته ورزشی *</Text>
        <View style={styles.disciplineRow}>
          {['کاراته', 'کراسفیت', 'بوکس', 'ژیمناستیک', 'موی تای'].map((d) => (
            <TouchableOpacity
              key={d}
              style={[
                styles.disciplineChip,
                formData.discipline === d && styles.disciplineChipActive,
              ]}
              onPress={() => setFormData({ ...formData, discipline: d })}
            >
              <Text
                style={[
                  styles.disciplineText,
                  formData.discipline === d && styles.disciplineTextActive,
                ]}
              >
                {d}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>جنسیت</Text>
        <View style={styles.genderRow}>
          {['مرد', 'زن'].map((g) => (
            <TouchableOpacity
              key={g}
              style={[
                styles.genderChip,
                formData.gender === g && styles.genderChipActive,
              ]}
              onPress={() => setFormData({ ...formData, gender: g })}
            >
              <Text
                style={[
                  styles.genderText,
                  formData.gender === g && styles.genderTextActive,
                ]}
              >
                {g}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>سن</Text>
            <TextInput
              style={styles.input}
              value={formData.age}
              onChangeText={(v) => setFormData({ ...formData, age: v })}
              placeholder="سن"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>قد (cm)</Text>
            <TextInput
              style={styles.input}
              value={formData.height_cm}
              onChangeText={(v) => setFormData({ ...formData, height_cm: v })}
              placeholder="قد"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
          </View>
        </View>

        <Text style={styles.label}>وزن (kg)</Text>
        <TextInput
          style={styles.input}
          value={formData.weight_kg}
          onChangeText={(v) => setFormData({ ...formData, weight_kg: v })}
          placeholder="وزن"
          placeholderTextColor="#666"
          keyboardType="numeric"
        />

        <Text style={styles.label}>رمز عبور *</Text>
        <TextInput
          style={styles.input}
          value={formData.password}
          onChangeText={(v) => setFormData({ ...formData, password: v })}
          placeholder="رمز عبور"
          placeholderTextColor="#666"
          secureTextEntry
        />

        <Text style={styles.label}>تکرار رمز عبور *</Text>
        <TextInput
          style={styles.input}
          value={formData.password2}
          onChangeText={(v) => setFormData({ ...formData, password2: v })}
          placeholder="تکرار رمز"
          placeholderTextColor="#666"
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#1a1a1a" />
          ) : (
            <Text style={styles.buttonText}>ثبت‌نام</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  header: {
    marginTop: 50,
    marginBottom: 30,
  },
  backButton: {
    color: '#c9a44e',
    fontSize: 16,
    marginBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#c9a44e',
  },
  form: {
    marginTop: 10,
  },
  label: {
    color: '#c9a44e',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  disciplineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  disciplineChip: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  disciplineChipActive: {
    backgroundColor: '#c9a44e',
    borderColor: '#c9a44e',
  },
  disciplineText: {
    color: '#aaa',
    fontSize: 14,
  },
  disciplineTextActive: {
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  genderChip: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  genderChipActive: {
    backgroundColor: '#c9a44e',
    borderColor: '#c9a44e',
  },
  genderText: {
    color: '#aaa',
    fontSize: 16,
  },
  genderTextActive: {
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  half: {
    flex: 1,
  },
  button: {
    backgroundColor: '#c9a44e',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
