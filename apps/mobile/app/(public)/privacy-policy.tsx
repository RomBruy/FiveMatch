import { ScrollView, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'

export default function PrivacyPolicyScreen() {
  const { t } = useTranslation()

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('privacy.title', { defaultValue: 'Politique de confidentialité' })}</Text>

      <Text style={styles.sectionTitle}>{t('privacy.dataProcessors', { defaultValue: 'Sous-traitants' })}</Text>
      <Text style={styles.body}>
        {t('privacy.dataProcessorsIntro', {
          defaultValue:
            'FiveMatch fait appel aux prestataires tiers suivants pour le traitement des données :',
        })}
      </Text>

      <Text style={styles.processor}>{t('privacy.clerkTitle', { defaultValue: 'Clerk' })}</Text>
      <Text style={styles.body}>
        {t('privacy.clerkDescription', {
          defaultValue: "Gestion de l'authentification et des sessions utilisateurs.",
        })}
      </Text>

      <Text style={styles.processor}>{t('privacy.rekognitionTitle', { defaultValue: 'AWS Rekognition' })}</Text>
      <Text style={styles.body}>
        {t('privacy.rekognitionDescription', {
          defaultValue: 'Analyse des photos de profil pour validation du contenu.',
        })}
      </Text>

      <Text style={styles.processor}>{t('privacy.geminiTitle', { defaultValue: 'Google Gemini' })}</Text>
      <Text style={styles.body}>
        {t('privacy.geminiDescription', {
          defaultValue: "Génération des attributs de carte via l'IA.",
        })}
      </Text>

      <Text style={styles.processor}>{t('privacy.posthogTitle', { defaultValue: 'PostHog' })}</Text>
      <Text style={styles.body}>
        {t('privacy.posthogDescription', {
          defaultValue:
            "Nous utilisons PostHog pour des analyses d'utilisation anonymes. Aucune information personnellement identifiable n'est envoyée. Les données sont stockées sur les serveurs EU de PostHog (Francfort) conformément au RGPD.",
        })}
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
    gap: 8,
  },
  title: {
    color: Colors.ink,
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    marginBottom: 24,
  },
  sectionTitle: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 4,
  },
  processor: {
    color: Colors.ink,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 12,
  },
  body: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
})
