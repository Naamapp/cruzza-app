import { SUBSCRIPTION_AMOUNT } from '@/constants';

// GoCardless API integration
// Note: In production, these calls should be made through your backend
// to protect your API keys and handle webhooks properly

const GC_API_BASE = 'https://api.gocardless.com';
const GC_ACCESS_TOKEN = process.env.EXPO_PUBLIC_GOCARDLESS_ACCESS_TOKEN || '';

interface GoCardlessCustomer {
  id: string;
  email: string;
  given_name: string;
  family_name: string;
  address_line1?: string;
  city?: string;
  postal_code?: string;
  country_code: string;
}

interface GoCardlessMandate {
  id: string;
  status: string;
  scheme: string;
  next_possible_charge_date?: string;
}

interface GoCardlessPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  charge_date: string;
}

class GoCardlessService {
  private headers: HeadersInit;

  constructor() {
    this.headers = {
      'Authorization': `Bearer ${GC_ACCESS_TOKEN}`,
      'GoCardless-Version': '2015-07-06',
      'Content-Type': 'application/json',
    };
  }

  async createCustomer(customerData: Partial<GoCardlessCustomer>): Promise<GoCardlessCustomer | null> {
    try {
      const response = await fetch(`${GC_API_BASE}/customers`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          customers: {
            email: customerData.email,
            given_name: customerData.given_name,
            family_name: customerData.family_name,
            country_code: 'GB',
            ...customerData,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create customer: ${response.statusText}`);
      }

      const data = await response.json();
      return data.customers;
    } catch (error) {
      console.error('GoCardless create customer error:', error);
      return null;
    }
  }

  async createMandate(customerId: string, accountData: {
    account_holder_name: string;
    account_number: string;
    sort_code: string;
  }): Promise<GoCardlessMandate | null> {
    try {
      // First create customer bank account
      const accountResponse = await fetch(`${GC_API_BASE}/customer_bank_accounts`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          customer_bank_accounts: {
            account_number: accountData.account_number,
            branch_code: accountData.sort_code.replace(/-/g, ''),
            account_holder_name: accountData.account_holder_name,
            country_code: 'GB',
            links: {
              customer: customerId,
            },
          },
        }),
      });

      if (!accountResponse.ok) {
        throw new Error(`Failed to create bank account: ${accountResponse.statusText}`);
      }

      const accountData2 = await accountResponse.json();
      const bankAccountId = accountData2.customer_bank_accounts.id;

      // Create mandate
      const mandateResponse = await fetch(`${GC_API_BASE}/mandates`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          mandates: {
            scheme: 'bacs',
            metadata: {
              source: 'cruzza_app',
            },
            links: {
              customer_bank_account: bankAccountId,
            },
          },
        }),
      });

      if (!mandateResponse.ok) {
        throw new Error(`Failed to create mandate: ${mandateResponse.statusText}`);
      }

      const mandateData = await mandateResponse.json();
      return mandateData.mandates;
    } catch (error) {
      console.error('GoCardless create mandate error:', error);
      return null;
    }
  }

  async createPayment(mandateId: string, amount: number = SUBSCRIPTION_AMOUNT): Promise<GoCardlessPayment | null> {
    try {
      const response = await fetch(`${GC_API_BASE}/payments`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          payments: {
            amount: Math.round(amount * 100), // Convert to pence
            currency: 'GBP',
            charge_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days from now
            reference: `CRUZA_SUB_${Date.now()}`,
            metadata: {
              subscription_type: 'monthly',
            },
            links: {
              mandate: mandateId,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create payment: ${response.statusText}`);
      }

      const data = await response.json();
      return data.payments;
    } catch (error) {
      console.error('GoCardless create payment error:', error);
      return null;
    }
  }

  async createSubscription(mandateId: string): Promise<any | null> {
    try {
      const response = await fetch(`${GC_API_BASE}/subscriptions`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          subscriptions: {
            amount: Math.round(SUBSCRIPTION_AMOUNT * 100),
            currency: 'GBP',
            interval_unit: 'monthly',
            day_of_month: 1,
            name: 'Cruzza Monthly Subscription',
            links: {
              mandate: mandateId,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create subscription: ${response.statusText}`);
      }

      const data = await response.json();
      return data.subscriptions;
    } catch (error) {
      console.error('GoCardless create subscription error:', error);
      return null;
    }
  }

  // Validate UK sort code format
  validateSortCode(sortCode: string): boolean {
    const cleanSortCode = sortCode.replace(/-/g, '');
    return /^\d{6}$/.test(cleanSortCode);
  }

  // Validate UK account number format
  validateAccountNumber(accountNumber: string): boolean {
    return /^\d{8}$/.test(accountNumber);
  }

  // Format sort code to standard format (XX-XX-XX)
  formatSortCode(sortCode: string): string {
    const clean = sortCode.replace(/\D/g, '');
    if (clean.length >= 4) {
      return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
    } else if (clean.length >= 2) {
      return `${clean.slice(0, 2)}-${clean.slice(2)}`;
    }
    return clean;
  }
}

export const goCardlessService = new GoCardlessService();
