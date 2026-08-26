import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../constants/colors'
import { Fonts, Radius } from '../../../constants/tokens'
import { PressableScale } from '../../../components/ui/PressableScale'
import {
  HELP_CATEGORIES,
  articlesInCategory,
  rolesInCategory,
  type HelpCategory,
} from '../../../lib/help-content'

/**
 * One topic's articles, grouped by role.
 *
 * "I'm playing" and "I'm organising" are different questions that use the same
 * words — someone looking for how to cancel means one of two entirely different
 * flows depending on which they are. Sorting by role answers that before they
 * read a single title.
 *
 * The short rule sits above the list for the people who will not open anything.
 */
export default function HelpCategoryScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { category } = useLocalSearchParams<{ category: string }>()

  const valid = HELP_CATEGORIES.includes(category as HelpCategory)
    ? (category as HelpCategory)
    : null

  // An unknown slug is a broken deep link, not a state worth designing for.
  if (!valid) {
    router.replace('/(app)/help' as never)
    return null
  }

  const articles = articlesInCategory(valid)

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
        <Text style={styles.navTitle} numberOfLines={1}>
          {t(`help.category.${valid}.title`).toUpperCase()}
        </Text>
      </View>

      {/* The answer for anyone who reads one thing and leaves. */}
      <View style={styles.rule}>
        <Text style={styles.ruleText}>{t(`help.category.${valid}.rule`)}</Text>
      </View>

      {rolesInCategory(valid).map((role) => (
        <View key={role} style={styles.roleBlock}>
          <Text style={styles.label}>{t(`help.role.${role}`).toUpperCase()}</Text>
          <View style={styles.group}>
            {articles
              .filter((a) => a.role === role)
              .map((article, index) => (
                <PressableScale
                  key={article.id}
                  style={[styles.qrow, index > 0 && styles.qrowDivided]}
                  onPress={() => router.push(`/(app)/help/article/${article.id}` as never)}
                  accessibilityRole="button"
                >
                  <Text style={styles.qText}>{t(`help.article.${article.id}.title`)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.inkDisabled} />
                </PressableScale>
              ))}
          </View>
        </View>
      ))}

      <View style={{ height: insets.bottom + 32 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 20, gap: 12 },
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
    flex: 1,
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 28,
    letterSpacing: 1.4, // 0.05em @ 28 (display register)
  },
  rule: {
    backgroundColor: Colors.paper,
    borderRadius: Radius.sm,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  ruleText: { color: Colors.paperInk, fontFamily: Fonts.inter, fontSize: 12.5, lineHeight: 18 },
  roleBlock: { gap: 8, marginTop: 4 },
  label: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.4, // 0.14em @ 10 (label-caps register)
  },
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
