import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import {
  getDriverWallet,
  getWalletTransactions,
  requestWithdrawal,
  subscribeToWallet,
} from '@/services/supabase';
import { COLORS } from '@/constants';
import type { DriverWallet, WalletTransaction } from '@/types';

export default function DriverPaymentsScreen() {
  const { user } = useAuth();

  const [wallet, setWallet] = useState<DriverWallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  useEffect(() => {
    loadWalletData();

    const subscription = subscribeToWallet(user?.id!, (updatedWallet) => {
      setWallet(updatedWallet);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadWalletData = async () => {
    try {
      const { data: walletData } = await getDriverWallet(user?.id!);
      const { data: transactionsData } = await getWalletTransactions(user?.id!);

      setWallet(walletData);
      setTransactions(transactionsData || []);
    } catch (error) {
      console.error('Error loading wallet:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadWalletData();
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);

    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!wallet?.can_withdraw) {
      Alert.alert('Error', 'Complete at least one job before withdrawing');
      return;
    }

    if (amount > Number(wallet.balance)) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    setWithdrawing(true);

    try {
      const { data, error } = await requestWithdrawal(user?.id!, amount);

      if (error) {
        Alert.alert('Error', error.message || 'Failed to process withdrawal');
      } else {
        Alert.alert(
          'Withdrawal Requested',
          `£${amount.toFixed(2)} will be transferred to your bank account within 1-3 business days`
        );
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        loadWalletData();
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to process withdrawal');
    } finally {
      setWithdrawing(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Wallet</Text>
          <Text style={styles.headerSubtitle}>Manage your earnings</Text>
        </View>

        <View style={styles.walletCard}>
          <View style={styles.walletHeader}>
            <View>
              <Text style={styles.walletLabel}>Available Balance</Text>
              <Text style={styles.walletBalance}>
                £{Number(wallet?.balance || 0).toFixed(2)}
              </Text>
            </View>
            <View style={styles.walletIcon}>
              <FontAwesome5 name="wallet" size={32} color="rgba(255,255,255,0.8)" />
            </View>
          </View>

          <View style={styles.walletStats}>
            <View style={styles.walletStat}>
              <FontAwesome5 name="arrow-down" size={16} color="rgba(255,255,255,0.7)" />
              <View style={styles.walletStatInfo}>
                <Text style={styles.walletStatLabel}>Total Earned</Text>
                <Text style={styles.walletStatValue}>
                  £{Number(wallet?.total_earned || 0).toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.walletStat}>
              <FontAwesome5 name="arrow-up" size={16} color="rgba(255,255,255,0.7)" />
              <View style={styles.walletStatInfo}>
                <Text style={styles.walletStatLabel}>Withdrawn</Text>
                <Text style={styles.walletStatValue}>
                  £{Number(wallet?.total_withdrawn || 0).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.withdrawButton,
              (!wallet?.can_withdraw || Number(wallet?.balance) === 0) &&
                styles.withdrawButtonDisabled,
            ]}
            onPress={() => setShowWithdrawModal(true)}
            disabled={!wallet?.can_withdraw || Number(wallet?.balance) === 0}
          >
            <FontAwesome5 name="bank" size={16} color="white" />
            <Text style={styles.withdrawButtonText}>
              {!wallet?.can_withdraw
                ? 'Complete a job to withdraw'
                : 'Withdraw to Bank'}
            </Text>
          </TouchableOpacity>
        </View>

        {!wallet?.can_withdraw && (
          <View style={styles.infoCard}>
            <FontAwesome5 name="info-circle" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>
              Complete your first ride to unlock withdrawals
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction History</Text>

          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <FontAwesome5 name="receipt" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>
                Your earnings will appear here
              </Text>
            </View>
          ) : (
            transactions.map((transaction) => (
              <View key={transaction.id} style={styles.transactionCard}>
                <View
                  style={[
                    styles.transactionIcon,
                    transaction.type === 'earning'
                      ? styles.transactionIconEarning
                      : styles.transactionIconWithdrawal,
                  ]}
                >
                  <FontAwesome5
                    name={transaction.type === 'earning' ? 'plus' : 'minus'}
                    size={16}
                    color="white"
                  />
                </View>

                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionTitle}>
                    {transaction.type === 'earning'
                      ? 'Ride Earnings'
                      : 'Bank Withdrawal'}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {formatDate(transaction.created_at)}
                  </Text>
                  {transaction.reference && (
                    <Text style={styles.transactionReference}>
                      {transaction.reference}
                    </Text>
                  )}
                  <View
                    style={[
                      styles.statusBadge,
                      transaction.status === 'completed' && styles.statusBadgeCompleted,
                      transaction.status === 'pending' && styles.statusBadgePending,
                      transaction.status === 'failed' && styles.statusBadgeFailed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        transaction.status === 'completed' && styles.statusTextCompleted,
                        transaction.status === 'pending' && styles.statusTextPending,
                        transaction.status === 'failed' && styles.statusTextFailed,
                      ]}
                    >
                      {transaction.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.transactionAmount,
                    transaction.type === 'earning'
                      ? styles.transactionAmountPositive
                      : styles.transactionAmountNegative,
                  ]}
                >
                  {transaction.type === 'earning' ? '+' : ''}£
                  {Math.abs(Number(transaction.amount)).toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {showWithdrawModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Withdraw Funds</Text>
            <Text style={styles.modalSubtitle}>
              Available: £{Number(wallet?.balance || 0).toFixed(2)}
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Amount to withdraw"
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              keyboardType="decimal-pad"
              placeholderTextColor={COLORS.textMuted}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => {
                  setShowWithdrawModal(false);
                  setWithdrawAmount('');
                }}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButtonPrimary,
                  withdrawing && styles.modalButtonDisabled,
                ]}
                onPress={handleWithdraw}
                disabled={withdrawing}
              >
                {withdrawing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.modalNote}>
              Funds will be transferred to your registered bank account within 1-3
              business days
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  walletCard: {
    marginHorizontal: 24,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  walletLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  walletBalance: {
    fontSize: 40,
    fontWeight: 'bold',
    color: 'white',
  },
  walletIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  walletStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    borderRadius: 12,
  },
  walletStatInfo: {
    flex: 1,
  },
  walletStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  walletStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  withdrawButton: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
  },
  withdrawButtonDisabled: {
    opacity: 0.5,
  },
  withdrawButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 16,
    backgroundColor: COLORS.primary + '10',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  section: {
    padding: 24,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionIconEarning: {
    backgroundColor: COLORS.success,
  },
  transactionIconWithdrawal: {
    backgroundColor: COLORS.error,
  },
  transactionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  transactionReference: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  statusBadgeCompleted: {
    backgroundColor: COLORS.success + '20',
  },
  statusBadgePending: {
    backgroundColor: COLORS.warning + '20',
  },
  statusBadgeFailed: {
    backgroundColor: COLORS.error + '20',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusTextCompleted: {
    color: COLORS.success,
  },
  statusTextPending: {
    color: COLORS.warning,
  },
  statusTextFailed: {
    color: COLORS.error,
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  transactionAmountPositive: {
    color: COLORS.success,
  },
  transactionAmountNegative: {
    color: COLORS.error,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalButtonPrimary: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  modalNote: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
