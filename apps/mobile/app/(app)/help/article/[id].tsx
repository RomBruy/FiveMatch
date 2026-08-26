import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../../constants/colors'
import { Fonts, Radius } from '../../../../constants/tokens'
import { PressableScale } from '../../../../components/ui/PressableScale'
import { PaperArticle } from '../../../../components/help/PaperArticle'
import { articlesInCategory, findArticle } from '../../../../lib/help-content'

/**
 * Where an article can be acted on rather than only read.
 *
 * Reading a procedure and then having to reproduce it from memory is where
 * people give up, so an article that describes a thing you can do right now ends
 * with the door to it. Only defined for articles that genuinely have one.
 */
const ARTICLE_ACTION: Record<string, { route: string; labelKey: string }> = {
  'cant-come': { route: '/(app)/matches', labelKey: 'myMatches.title' },
  'cancel-my-match': { route: '/(app)/matches', labelKey: 'myMatches.title' },
  'join-a-match': { route: '/(app)', labelKey: 'nav.play' },
  'how-rating-works': { route: '/(app)/profile/note', labelKey: 'profile.note.title' },
}

export default function HelpArticleScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()

  const article = findArticle(id)

  if (!article) {
    router.replace('/(app)/help' as never)
    return null
  }

  const action = ARTICLE_ACTION[article.id]
  const related = articlesInCategory(article.category).filter((a) => a.id !== article.id).slice(0, 3)

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.nav}>
        <PressableScale
          style={styles.back}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={18} color={Colors.inkSecondary} />
        </PressableScale>
      </View>

      <PaperArticle article={article} />

      {action && (
        <>
          <Text style={styles.label}>{t('help.doNow').toUpperCase()}</Text>
          <PressableScale
            style={styles.actionRow}
            onPress={() => router.push(action.route as never)}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>{t(action.labelKey)}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </PressableScale>
        </>
      )}

      {related.length > 0 && (
        <>
          <Text style={styles.label}>{t(`help.category.${article.category}.title`).toUpperCase()}</Text>
          <View style={styles.group}>
            {related.map((other, index) => (
              <PressableScale
                key={other.id}
                style={[styles.qrow, index > 0 && styles.qrowDivided]}
                // Replace, not push: readers hop sideways between articles, and
                // pushing would build a back stack they have to unwind one by one.
                onPress={() => router.replace(`/(app)/help/article/${other.id}` as never)}
                accessibilityRole="button"
              >
                <Text style={styles.qText}>{t(`help.article.${other.id}.title`)}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.inkDisabled} />
              </PressableScale>
            ))}
          </View>
        </>
      )}

      <View style={{ height: insets.bottom + 32 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 20, gap: 12 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  back: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 6,
    color: Colors.inkSecondary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.4, // 0.14em @ 10 (label-caps register)
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  actionText: { flex: 1, color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 13 },
  group: { borderRadius: Radius.sm, overflow: 'hidden', backgroundColor: Colors.surface },
  qrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  qrowDivided: { borderTopWidth: 1, borderTopColor: Colors.hairline },
  qText: { flex: 1, color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 13, lineHeight: 17 },
})
