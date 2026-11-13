import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { api } from '../services/api';

export default function CoachDashboardScreen({ route, navigation }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [statsRes] = await Promise.all([api.get('/v1/stats')]);
      if (statsRes.ok) setStats(statsRes.stats);
    } catch (e) { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const stats_cards = stats ? [
    { label: 'کل شاگردان', value: stats.members, icon: '👥' },
    { label: 'فعال', value: stats.activeMembers, icon: '✅' },
    { label: 'تمرینات', value: stats.plans, icon: '📋' },
    { label: 'تکمیل شده', value: stats.done, icon: '🏆' },
  ] : [];

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#d4a853" />
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#d4a853" />}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>سلام، {route.params?.user?.full_name || 'مربی'} 👋</Text>
          <Text style={styles.subtitle}>پنل مدیریت باشگاه</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>خروج</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {stats_cards.map((s, i) => (
          <View key={i} style={styles.statCard}>
            <Text style={styles.statIcon}>{s.icon}</Text>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>دسترسی سریع</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity style={styles.actionCard} onPress={() => {}}>
          <Text style={styles.actionIcon}>➕</Text>
          <Text style={styles.actionText}>شاگرد جدید</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => {}}>
          <Text style={styles.actionIcon}>📝</Text>
          <Text style={styles.actionText}>تمرین جدید</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => {}}>
          <Text style={styles.actionIcon}>📊</Text>
          <Text style={styles.actionText}>جدول پیشرفت</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => {}}>
          <Text style={styles.actionIcon}>📢</Text>
          <Text style={styles.actionText}>اطلاعیه</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080d' },
  content: { padding: 24, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#08080d', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#f8f4ec' },
  subtitle: { fontSize: 13, color: '#6b6560', marginTop: 4 },
  logoutBtn: { backgroundColor: '#14141f', borderWidth: 1, borderColor: '#2a2a40', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  logoutText: { color: '#9a9488', fontSize: 13, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  statCard: { width: '47%', backgroundColor: '#14141f', borderWidth: 1, borderColor: '#2a2a40', borderRadius: 18, padding: 18, position: 'relative', overflow: 'hidden' },
  statIcon: { fontSize: 22, marginBottom: 8 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#d4a853' },
  statLabel: { fontSize: 12, color: '#9a9488', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#f8f4ec', marginBottom: 16 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: { width: '47%', backgroundColor: '#14141f', borderWidth: 1, borderColor: '#2a2a40', borderRadius: 18, padding: 20, alignItems: 'center', gap: 8 },
  actionIcon: { fontSize: 28 },
  actionText: { fontSize: 13, fontWeight: '600', color: '#9a9488' },
});
