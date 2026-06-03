import {
  DEFAULT_LOCALE,
  getLocalization,
  normalizeLocale,
  type LocalizationDictionary,
  type SupportedLocale,
} from '@fit-five/shared';
import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const LOCALE_STORAGE_KEY = 'fivematch.preferred_locale';

type PreferencesContextValue = {
  hasStoredLocale: boolean;
  isLoaded: boolean;
  locale: SupportedLocale;
  setLocale: (nextLocale: SupportedLocale) => Promise<void>;
  strings: LocalizationDictionary;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

type PreferencesProviderProps = {
  children: ReactNode;
};

export function PreferencesProvider({ children }: PreferencesProviderProps) {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);
  const [hasStoredLocale, setHasStoredLocale] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadLocale() {
      try {
        const storedLocale = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
        const normalizedLocale = normalizeLocale(storedLocale);

        if (isActive) {
          setLocaleState(normalizedLocale);
          setHasStoredLocale(Boolean(storedLocale));
        }
      } finally {
        if (isActive) {
          setIsLoaded(true);
        }
      }
    }

    void loadLocale();

    return () => {
      isActive = false;
    };
  }, []);

  async function setLocale(nextLocale: SupportedLocale) {
    const normalizedLocale = normalizeLocale(nextLocale);

    setLocaleState(normalizedLocale);
    setHasStoredLocale(true);
    await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, normalizedLocale);
  }

  const value = useMemo<PreferencesContextValue>(
    () => ({
      hasStoredLocale,
      isLoaded,
      locale,
      setLocale,
      strings: getLocalization(locale),
    }),
    [hasStoredLocale, isLoaded, locale],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider.');
  }

  return context;
}
