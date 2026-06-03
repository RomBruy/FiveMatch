import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePreferences } from '@/features/preferences/preferences-context';

export function MissingAuthConfigScreen() {
  const { strings } = usePreferences();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>{strings.auth.missingConfigKicker}</Text>
        <Text style={styles.title}>{strings.auth.missingConfigTitle}</Text>
        <Text style={styles.subtitle}>{strings.auth.missingConfigSubtitle}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07110D',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#121922',
    borderColor: '#1D2630',
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    padding: 24,
  },
  kicker: {
    color: '#FFC928',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F4F7F2',
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: '#98A4B3',
    fontSize: 16,
    lineHeight: 24,
  },
});
