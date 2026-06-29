import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../../../constants/colors'

export default function MatchDetailScreen() {
  const { t } = useTranslation()
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>{t('match.detail.comingSoon')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },
  placeholder: { color: Colors.inkSecondary, fontSize: 14, fontFamily: 'Inter_400Regular' },
})
