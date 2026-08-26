import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../constants/colors'
import { Fonts, Radius } from '../../../constants/tokens'
import { Input } from '../../../components/ui/Input'
import { PressableScale } from '../../../components/ui/PressableScale'
import { TextureType } from '../../../components/ui/TextureType'
import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  HELP_PINNED,
  articlesInCategory,
} from '../../../lib/help-content'
import { useTutorialSeen } from '../../../lib/onboarding'

/**
 * The help centre.
 *
 * The two withdrawal questions sit above the topic grid, with a red edge. A FAQ
 * that leads with an alphabetical topic list makes people hunt; these two are
 * what gets searched under time pressure, and until now the app answered
 * neither of them anywhere.
 */
export default function HelpIndexScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const { replay } = useTutorialSeen()

  const term = query.trim().toLowerCase()
  // Title-only search. Matching article bodies would surface a dozen results for
  // a word like "match" and bury the one people wanted.
  const results = term
    ? HELP_ARTICLES.filter((a) => t(`help.article.${a.id}.title`).toLowerCase().includes(term))
    : []

  const openArticle = (id: string) => router.push(`/(app)/help/article/${id}` as never)

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled"
    >
      <TextureType lines={[{ text: 'AIDE' }]} fontSize={170} style={styles.texture} />

      <View style={styles.nav}>
        <PressableScale
          style={styles.back}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={18} color={Colors.inkSecondary} />
        </PressableScale>
        <Text style={styles.navTitle}>{t('help.title').toUpperCase()}</Text>
      </View>

      <Input value={query} onChangeText={setQuery} placeholder={t('help.search')} />

      {term.length > 0 ? (
        <View style={styles.group}>
          {results.map((article) => (
            <PressableScale
              key={article.id}
              style={styles.qrow}
              onPress={() => openArticle(article.id)}
              accessibilityRole="button"
            >
              <Text style={styles.qText}>{t(`help.article.${article.id}.title`)}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.inkDisabled} />
            </PressableScale>
          ))}
          {results.length === 0 && (
            // Says what happened rather than dangling a label with no action.
            // A "contact us" row belongs here once that screen exists.
            <View style={styles.qrow}>
              <Text style={styles.qEmpty}>{t('help.noResults', { term: query.trim() })}</Text>
            </View>
          )}
        </View>
      ) : (
        <>
          <Text style={styles.label}>{t('help.pinned').toUpperCase()}</Text>
          <View style={styles.pinnedList}>
            {HELP_PINNED.map((id) => (
              <PressableScale
                key={id}
                style={[styles.qrow, styles.qrowHot]}
                onPress={() => openArticle(id)}
                accessibilityRole="button"
              >
                <Text style={styles.qText}>{t(`help.article.${id}.title`)}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.inkDisabled} />
              </PressableScale>
            ))}
          </View>

          <Text style={styles.label}>{t('help.byTopic').toUpperCase()}</Text>
          <View style={styles.topics}>
            {HELP_CATEGORIES.map((category) => {
              const count = articlesInCategory(category).length
              return (
                <PressableScale
                  key={category}
                  style={styles.topic}
                  onPress={() => router.push(`/(app)/help/${category}` as never)}
                  accessibilityRole="button"
                  // Empty categories are still listed rather than hidden: a topic
                  // that vanishes reads as a broken app, not as "nothing here yet".
                  disabled={count === 0}
                >
                  <Text style={styles.topicTitle}>{t(`help.category.${category}.title`)}</Text>
                  <Text style={styles.topicCount}>
                    {t('help.articleCount', { count }).toUpperCase()}
                  </Text>
                </PressableScale>
              )
            })}
          </View>

          <Text style={styles.label}>{t('help.more').toUpperCase()}</Text>
          <View style={styles.group}>
            {/* The tutorial is re-openable and never replays on its own. One that
                reappears is a punishment; one that cannot be found again just
                turns into a support question. */}
            <PressableScale
              style={styles.qrow}
              onPress={() => {
                replay()
                router.replace('/(app)' as never)
              }}
              accessibilityRole="button"
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t('help.replayTutorial.title')}</Text>
                <Text style={styles.rowSub}>{t('help.replayTutorial.body')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.inkDisabled} />
            </PressableScale>
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
  texture: { top: 20, right: -40 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  back: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 30,
    letterSpacing: 1.5, // 0.05em @ 30 (display register)
  },
  label: {
    marginTop: 6,
    color: Colors.inkSecondary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.4, // 0.14em @ 10 (label-caps register)
  },
  pinnedList: { gap: 6 },
  group: { borderRadius: Radius.sm, overflow: 'hidden', backgroundColor: Colors.surface },
  qrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  qrowHot: { borderLeftWidth: 3, borderLeftColor: Colors.primary },
  qText: { flex: 1, color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 13, lineHeight: 17 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 13, lineHeight: 17 },
  rowSub: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 11 },
  qEmpty: { flex: 1, color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 13 },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  topic: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 13,
    paddingVertical: 14,
    gap: 6,
  },
  topicTitle: { color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 12.5, lineHeight: 16 },
  topicCount: {
    color: Colors.inkDisabled,
    fontFamily: Fonts.interSemiBold,
    fontSize: 9,
    letterSpacing: 0.9, // 0.10em @ 9 (label-caps register)
  },
})
