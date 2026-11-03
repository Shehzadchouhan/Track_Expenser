export type AppLanguage = 'en' | 'hi';

const LANGUAGE_STORAGE_KEY = 'track_expenser_language';
const languageListeners = new Set<() => void>();

export function subscribeToLanguage(listener: () => void): () => void {
  languageListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    languageListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export function getSavedLanguage(): AppLanguage {
  return localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'hi' ? 'hi' : 'en';
}

export function getServerLanguage(): AppLanguage {
  return 'en';
}

export function saveLanguage(language: AppLanguage): void {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  languageListeners.forEach((listener) => listener());
}

export function categoryLabel(category: string, language: AppLanguage): string {
  if (language === 'en') return category;

  const hindiLabels: Record<string, string> = {
    'Online Deposit': 'ऑनलाइन जमा / बैलेंस',
    'Cash Deposit': 'नकद जमा / बैलेंस',
    Salary: 'वेतन',
    Freelance: 'फ्रीलांस',
    Investment: 'निवेश',
    'Other Income': 'अन्य कमाई',
    'Food & Dining': 'खाना-पीना',
    Groceries: 'किराना',
    Transportation: 'यातायात',
    'Housing & Utilities': 'घर और बिल',
    Entertainment: 'मनोरंजन',
    'Health & Medical': 'स्वास्थ्य',
    Shopping: 'खरीदारी',
    'Other Expense': 'अन्य खर्च',
    General: 'सामान्य',
  };

  return hindiLabels[category] || category;
}

export function accountLabel(name: string, language: AppLanguage): string {
  if (language === 'en') return name;

  const hindiAccounts: Record<string, string> = {
    'Bank / UPI': 'बैंक / UPI (ऑनलाइन)',
    'Bank / UPI (Online)': 'बैंक / UPI (ऑनलाइन)',
    Cash: 'नकद (हाथ में)',
    'Cash (In Hand)': 'नकद (हाथ में)',
    'Online Vault': 'ऑनलाइन वॉल्ट (बैंक बचत)',
    'Cash Vault': 'कैश वॉल्ट (नकद गुल्लक)',
    'Savings Vault': 'बचत वॉल्ट (सुरक्षित)',
  };

  return hindiAccounts[name] || name;
}
