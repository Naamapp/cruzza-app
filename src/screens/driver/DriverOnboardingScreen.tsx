import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { goCardlessService } from '@/services/gocardless';
import {
  updateDriverProfile,
  createDriverProfile,
  uploadDocument,
  getDriverDocuments,
  createPaymentMandate,
  createPaymentSubscription
} from '@/services/supabase';
import { COLORS, UK_CITIES, SUBSCRIPTION_AMOUNT } from '@/constants';
import type { DriverProfile } from '@/types';

type RootStackParamList = {
  DriverOnboarding: undefined;
  DriverDashboard: undefined;
};

const STEPS = ['Account', 'Documents', 'Payment', 'Review'];

export default function DriverOnboardingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, refreshUser } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Personal Info
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');

  // Step 2: Documents
  const [documents, setDocuments] = useState({
    license: false,
    insurance: false,
    pco: false,
    vehicle: false,
  });
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  // Step 3: Payment
  const [accountName, setAccountName] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleNext = async () => {
    if (currentStep === 0) {
      if (!fullName || !email || !phone || !city) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }

      setLoading(true);
      try {
        await createDriverProfile({
          id: user?.id,
          city,
          rating: 5.0,
          total_trips: 0,
          documents_verified: false,
          payment_status: 'pending',
          subscription_amount: SUBSCRIPTION_AMOUNT,
          is_online: false,
        });
        setCurrentStep(1);
      } catch (error) {
        Alert.alert('Error', 'Failed to save profile');
      } finally {
        setLoading(false);
      }
    } else if (currentStep === 1) {
      // Check if all documents uploaded
      const allUploaded = Object.values(documents).every(v => v);
      if (!allUploaded) {
        Alert.alert('Error', 'Please upload all required documents');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!accountName || !sortCode || !accountNumber) {
        Alert.alert('Error', 'Please fill in all payment details');
        return;
      }
      if (!termsAccepted) {
        Alert.alert('Error', 'Please accept the terms');
        return;
      }

      setLoading(true);
      try {
        // Create GoCardless customer and mandate
        const customer = await goCardlessService.createCustomer({
          email,
          given_name: fullName.split(' ')[0],
          family_name: fullName.split(' ').slice(1).join(' ') || fullName,
        });

        if (!customer) {
          throw new Error('Failed to create customer');
        }

        const mandate = await goCardlessService.createMandate(customer.id, {
          account_holder_name: accountName,
          account_number: accountNumber,
          sort_code: sortCode,
        });

        if (!mandate) {
          throw new Error('Failed to create mandate');
        }

        // Save mandate to database
        await createPaymentMandate({
          driver_id: user?.id!,
          gocardless_mandate_id: mandate.id,
          gocardless_customer_id: customer.id,
          account_holder_name: accountName,
          sort_code: sortCode,
          account_number: accountNumber,
          status: mandate.status,
        });

        // Create subscription for monthly payments
        const subscription = await goCardlessService.createSubscription(mandate.id);

        if (subscription) {
          await createPaymentSubscription({
            mandate_id: mandate.id,
            gocardless_subscription_id: subscription.id,
            amount: SUBSCRIPTION_AMOUNT,
            currency: 'GBP',
            status: subscription.status,
            next_charge_date: subscription.upcoming_payments?.[0]?.charge_date || new Date().toISOString(),
          });

          // Update driver profile
          await updateDriverProfile(user?.id!, {
            payment_status: 'active',
            subscription_renewal_date: subscription.upcoming_payments?.[0]?.charge_date,
          });

          setCurrentStep(3);
        } else {
          throw new Error('Failed to create subscription');
        }
      } catch (error: any) {
        console.error('Payment setup error:', error);
        Alert.alert('Error', error?.message || 'Payment setup failed');
      } finally {
        setLoading(false);
      }
    } else {
      // Complete onboarding
      await refreshUser();
      navigation.replace('DriverDashboard');
    }
  };

  const pickAndUploadDocument = async (docType: keyof typeof documents) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera roll permissions are required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingDoc(docType);
        const asset = result.assets[0];

        const { data, error } = await uploadDocument(
          user?.id!,
          docType as 'license' | 'insurance' | 'pco' | 'vehicle',
          {
            uri: asset.uri,
            name: `${docType}.jpg`,
            type: 'image/jpeg',
          }
        );

        if (error) {
          Alert.alert('Error', 'Failed to upload document');
        } else {
          setDocuments(prev => ({ ...prev, [docType]: true }));
          Alert.alert('Success', 'Document uploaded successfully');
        }
        setUploadingDoc(null);
      }
    } catch (error) {
      setUploadingDoc(null);
      Alert.alert('Error', 'Failed to upload document');
    }
  };

  const formatSortCode = (text: string) => {
    const formatted = goCardlessService.formatSortCode(text);
    setSortCode(formatted);
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((step, index) => (
        <View key={step} style={styles.stepItem}>
          <View
            style={[
              styles.stepDot,
              index <= currentStep && styles.stepDotActive,
            ]}
          />
          <Text
            style={[
              styles.stepLabel,
              index <= currentStep && styles.stepLabelActive,
            ]}
          >
            {step}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Create Account</Text>

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={fullName}
        onChangeText={setFullName}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Phone Number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <View style={styles.pickerContainer}>
        <Text style={styles.pickerLabel}>Select City</Text>
        <ScrollView style={styles.cityList}>
          {UK_CITIES.map((cityOption) => (
            <TouchableOpacity
              key={cityOption.value}
              style={[
                styles.cityOption,
                city === cityOption.value && styles.cityOptionSelected,
              ]}
              onPress={() => setCity(cityOption.value)}
            >
              <Text
                style={[
                  styles.cityOptionText,
                  city === cityOption.value && styles.cityOptionTextSelected,
                ]}
              >
                {cityOption.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Upload Documents</Text>

      {[
        { key: 'license', label: 'Driving License', icon: 'id-card', color: COLORS.primary },
        { key: 'insurance', label: 'Vehicle Insurance', icon: 'file-shield', color: COLORS.secondary },
        { key: 'pco', label: 'PCO License', icon: 'certificate', color: '#3b82f6' },
        { key: 'vehicle', label: 'Vehicle Photos', icon: 'car', color: '#ec4899' },
      ].map((doc) => (
        <TouchableOpacity
          key={doc.key}
          style={[
            styles.documentCard,
            documents[doc.key as keyof typeof documents] && styles.documentCardUploaded,
            uploadingDoc === doc.key && styles.documentCardUploading,
          ]}
          onPress={() => pickAndUploadDocument(doc.key as keyof typeof documents)}
          disabled={uploadingDoc === doc.key}
        >
          {uploadingDoc === doc.key ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <FontAwesome5
              name={documents[doc.key as keyof typeof documents] ? 'check-circle' : doc.icon}
              size={32}
              color={documents[doc.key as keyof typeof documents] ? COLORS.success : doc.color}
            />
          )}
          <View style={styles.documentInfo}>
            <Text style={styles.documentTitle}>{doc.label}</Text>
            <Text style={styles.documentSubtitle}>
              {uploadingDoc === doc.key
                ? 'Uploading...'
                : documents[doc.key as keyof typeof documents]
                ? 'Uploaded'
                : 'Tap to upload'}
            </Text>
          </View>
          <FontAwesome5
            name={documents[doc.key as keyof typeof documents] ? 'check' : 'chevron-right'}
            size={16}
            color={documents[doc.key as keyof typeof documents] ? COLORS.success : COLORS.textMuted}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Setup Payment</Text>
      <Text style={styles.paymentSubtitle}>Secure monthly subscription</Text>

      <View style={styles.paymentCard}>
        <View style={styles.paymentHeader}>
          <View>
            <Text style={styles.paymentLabel}>Monthly Subscription</Text>
            <Text style={styles.paymentAmount}>£{SUBSCRIPTION_AMOUNT.toFixed(2)}</Text>
          </View>
          <FontAwesome5 name="infinity" size={32} color="rgba(255,255,255,0.5)" />
        </View>

        <View style={styles.paymentSecurity}>
          <View style={styles.securityIcon}>
            <FontAwesome5 name="shield-alt" size={16} color={COLORS.success} />
          </View>
          <View>
            <Text style={styles.securityText}>Direct Debit • GoCardless</Text>
            <Text style={styles.securitySubtext}>Bank-level security</Text>
          </View>
        </View>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Account Holder Name"
        value={accountName}
        onChangeText={setAccountName}
      />

      <TextInput
        style={styles.input}
        placeholder="Sort Code (12-34-56)"
        value={sortCode}
        onChangeText={formatSortCode}
        maxLength={8}
      />

      <TextInput
        style={styles.input}
        placeholder="Account Number (8 digits)"
        value={accountNumber}
        onChangeText={setAccountNumber}
        keyboardType="number-pad"
        maxLength={8}
      />

      <TouchableOpacity
        style={styles.termsContainer}
        onPress={() => setTermsAccepted(!termsAccepted)}
      >
        <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
          {termsAccepted && <FontAwesome5 name="check" size={12} color="white" />}
        </View>
        <Text style={styles.termsText}>
          I authorise Cruzza to setup a Direct Debit mandate for £{SUBSCRIPTION_AMOUNT} monthly subscription
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <View style={styles.reviewIcon}>
        <FontAwesome5 name="clock" size={48} color={COLORS.warning} />
      </View>

      <Text style={styles.reviewTitle}>Under Review</Text>
      <Text style={styles.reviewSubtitle}>
        24-48 hours for document verification
      </Text>

      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusValue}>PENDING</Text>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '75%' }]} />
        </View>

        <View style={styles.statusSteps}>
          <Text style={styles.statusStep}>Payment ✓</Text>
          <Text style={styles.statusStep}>Docs ✓</Text>
          <Text style={[styles.statusStep, styles.statusStepPending]}>Approval</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.demoButton}
        onPress={() => setCurrentStep(4)}
      >
        <Text style={styles.demoButtonText}>[Demo: Simulate Approval]</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {renderStepIndicator()}

        {currentStep === 0 && renderStep1()}
        {currentStep === 1 && renderStep2()}
        {currentStep === 2 && renderStep3()}
        {currentStep === 3 && renderStep4()}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>
              {currentStep === 3 ? 'Continue to Dashboard' : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  scrollView: {
    flex: 1,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  stepItem: {
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 32,
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
  },
  stepDotActive: {
    backgroundColor: COLORS.primary,
  },
  stepLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  stepLabelActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  stepContent: {
    padding: 24,
    gap: 16,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    padding: 18,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerContainer: {
    marginTop: 8,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  cityList: {
    maxHeight: 200,
  },
  cityOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f3f4f6',
  },
  cityOptionSelected: {
    backgroundColor: COLORS.primary,
  },
  cityOptionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  cityOptionTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  documentCardUploaded: {
    borderColor: COLORS.success,
    borderStyle: 'solid',
    backgroundColor: COLORS.success + '10',
  },
  documentCardUploading: {
    opacity: 0.6,
  },
  documentInfo: {
    flex: 1,
    marginLeft: 16,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  documentSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  paymentSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: -8,
    marginBottom: 8,
  },
  paymentCard: {
    backgroundColor: '#1e3a8a',
    borderRadius: 20,
    padding: 24,
    marginBottom: 8,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  paymentLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  paymentAmount: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
  },
  paymentSecurity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  securityIcon: {
    width: 32,
    height: 32,
    backgroundColor: 'white',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  securityText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  securitySubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 8,
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  reviewIcon: {
    width: 96,
    height: 96,
    backgroundColor: '#fef3c7',
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  reviewTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  reviewSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  statusCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.warning,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.warning,
    borderRadius: 4,
  },
  statusSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  statusStep: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '600',
  },
  statusStepPending: {
    color: COLORS.textMuted,
  },
  demoButton: {
    alignSelf: 'center',
    marginTop: 24,
    padding: 12,
  },
  demoButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footer: {
    padding: 24,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  button: {
    backgroundColor: COLORS.text,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
