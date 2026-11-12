import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import api from '../services/api';

export default function CoachDashboardScreen({ navigation }) {
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [statsData, membersData] = await Promise.all([
        api.getStats(),
        api.getMembers(),
      ]);
      setStats(statsData);
      setMembers(membersData.members || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#c9a44e" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c9a44e" />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>پنل مربی</Text>
        <TouchableOpacity onPress={async () => { await api.logout(); navigation.replace('Login'); }}>
          <Text style={styles.logoutButton}>خروج</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.stats?.members || 0}</Text>
            <Text style={styles.statLabel}>شاگردان</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.stats?.plans || 0}</Text>
            <Text style={styles.statLabel}>تمرینات</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.stats?.announcements || 0}</Text>
            <Text style={styles.statLabel}>اطلاعیه‌ها</Text>
          </View>
        </View>
      )}

      {/* Members List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>شاگردان</Text>
        {members.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>هنوز شاگردی ثبت‌نام نکرده</Text>
          </View>
        ) : (
          members.map((member) => (
            <TouchableOpacity key={member.id} style={styles.memberCard}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {member.full_name?.charAt(0) || '?'}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.full_name}</Text>
                <Text style={styles.memberDiscipline}>{member.discipline || member.style}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>دسترسی سریع</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('CreatePlan')}>
            <Text style={styles.actionIcon}>+</Text>
            <Text style={styles.actionText}>تمرین جدید</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Announcements')}>
            <Text style={styles.actionIcon}>📢</Text>
            <Text style={styles.actionText}>اطلاعیه</Text>
          </TouchableOpacity>
        </View>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 50,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#c9a44e',
  },
  logoutButton: {
    color: '#e2483d',
    fontSize: 16,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 30,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#c9a44e',
  },
  statLabel: {
    color: '#888',
    fontSize: 13,
    marginTop: 5,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#c9a44e',
    marginBottom: 15,
  },
  memberCard: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#c9a44e',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 15,
  },
  memberAvatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  memberDiscipline: {
    fontSize: 13,
    color: '#888',
    marginTop: 3,
  },
  emptyCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  actionIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  actionText: {
    color: '#c9a44e',
    fontSize: 14,
    fontWeight: '600',
  },
});
