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

export default function MemberPanelScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [meData, plansData] = await Promise.all([
        api.getMe(),
        api.getPlans(),
      ]);
      setUser(meData.user);
      setPlans(plansData.plans || []);
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
        <View>
          <Text style={styles.greeting}>سلام،</Text>
          <Text style={styles.name}>{user?.full_name || 'کاربر'}</Text>
        </View>
        <TouchableOpacity onPress={async () => { await api.logout(); navigation.replace('Login'); }}>
          <Text style={styles.logoutButton}>خروج</Text>
        </TouchableOpacity>
      </View>

      {/* Profile Card */}
      {user && (
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {user.full_name?.charAt(0) || '?'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.full_name}</Text>
            <Text style={styles.profileDiscipline}>
              {user.discipline || user.style || 'بدون رشته'}
            </Text>
            <Text style={styles.profileBelt}>کمربند: {user.belt || 'سفید'}</Text>
          </View>
        </View>
      )}

      {/* Plans */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>تمرینات من</Text>
        {plans.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>تمرینی اختصاص داده نشده</Text>
          </View>
        ) : (
          plans.map((plan) => (
            <View key={plan.id} style={styles.planCard}>
              <View style={styles.planHeader}>
                <Text style={styles.planTitle}>{plan.title}</Text>
                <View style={[styles.planBadge, { backgroundColor: plan.difficulty === 'سنگین' ? '#e2483d' : plan.difficulty === 'متوسط' ? '#c9a44e' : '#46b07a' }]}>
                  <Text style={styles.planBadgeText}>{plan.difficulty}</Text>
                </View>
              </View>
              <Text style={styles.planBody} numberOfLines={3}>{plan.body}</Text>
              <View style={styles.planFooter}>
                <Text style={styles.planDuration}>{plan.duration}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Quick Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>وضعیت</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{plans.filter(p => p.status === 'done').length}</Text>
            <Text style={styles.statLabel}>انجام شده</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{plans.filter(p => p.status === 'todo').length}</Text>
            <Text style={styles.statLabel}>در انتظار</Text>
          </View>
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
    marginBottom: 20,
  },
  greeting: {
    color: '#888',
    fontSize: 16,
  },
  name: {
    color: '#c9a44e',
    fontSize: 28,
    fontWeight: 'bold',
  },
  logoutButton: {
    color: '#e2483d',
    fontSize: 16,
    fontWeight: '600',
  },
  profileCard: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#c9a44e',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 20,
  },
  profileAvatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  profileDiscipline: {
    color: '#c9a44e',
    fontSize: 14,
    marginBottom: 3,
  },
  profileBelt: {
    color: '#888',
    fontSize: 13,
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
  planCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  planBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
  },
  planBadgeText: {
    color: '#1a1a1a',
    fontSize: 11,
    fontWeight: 'bold',
  },
  planBody: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  planFooter: {
    borderTopWidth: 1,
    borderTopColor: '#444',
    paddingTop: 12,
  },
  planDuration: {
    color: '#888',
    fontSize: 13,
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
  statsRow: {
    flexDirection: 'row',
    gap: 12,
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
});
