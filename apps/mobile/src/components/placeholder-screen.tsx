import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PlaceholderScreenProps = {
  title: string;
  subtitle: string;
};

export function PlaceholderScreen({ title, subtitle }: PlaceholderScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>FiveMatch</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07110D',
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
    color: '#35C77B',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F4F7F2',
    fontSize: 34,
    fontWeight: '900',
  },
  subtitle: {
    color: '#98A4B3',
    fontSize: 16,
    lineHeight: 24,
  },
});
