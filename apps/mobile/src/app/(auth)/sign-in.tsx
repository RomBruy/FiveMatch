import { AuthView } from '@clerk/expo/native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePreferences } from '@/features/preferences/preferences-context';

export default function SignInScreen() {
  const { strings } = usePreferences();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>{strings.appName}</Text>
        <Text style={styles.title}>{strings.auth.signInTitle}</Text>
        <Text style={styles.subtitle}>{strings.auth.signInSubtitle}</Text>
      </View>

      <View style={styles.authCard}>
        <AuthView mode="signInOrUp" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07110D',
    gap: 24,
    padding: 24,
  },
  header: {
    gap: 12,
    paddingTop: 24,
  },
  kicker: {
    color: '#35C77B',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F4F7F2',
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42,
  },
  subtitle: {
    color: '#98A4B3',
    fontSize: 16,
    lineHeight: 24,
  },
  authCard: {
    backgroundColor: '#121922',
    borderColor: '#1D2630',
    borderRadius: 28,
    borderWidth: 1,
    flex: 1,
    overflow: 'hidden',
  },
});
