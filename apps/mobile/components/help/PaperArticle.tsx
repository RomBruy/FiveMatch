import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import type { HelpArticle } from '../../lib/help-content'

/**
 * A help article, on paper.
 *
 * Everything else in FiveMatch is a dark, fast surface. Help arrives at the
 * worst moment — someone is stuck, rushed, often annoyed — and the switch to the
 * bone ground changes register: you are no longer in the product, you are
 * reading the notice. It is the same move the paper calendar makes in creation,
 * reused for the same reason: mark the moment where you stop and read.
 *
 * Numbering is only rendered when `steps > 0`, because a numbered list should
 * mean "do these in order", not "here are some facts".
 */
export function PaperArticle({ article }: { article: HelpArticle }) {
  const { t } = useTranslation()
  const key = `help.article.${article.id}`

  return (
    <View style={styles.paper}>
      <Text style={styles.eyebrow}>
        {t(`help.category.${article.category}.title`).toUpperCase()}
      </Text>
      <Text style={styles.title}>{t(`${key}.title`).toUpperCase()}</Text>
      <Text style={styles.lede}>{t(`${key}.lede`)}</Text>

      {article.steps > 0 && (
        <>
          <View style={styles.rule} />
          <View style={styles.steps}>
            {Array.from({ length: article.steps }, (_, i) => (
              <View key={i} style={[styles.step, i > 0 && styles.stepDivided]}>
                <Text style={styles.stepNum}>{i + 1}</Text>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>{t(`${key}.step${i + 1}.title`)}</Text>
                  <Text style={styles.stepBody}>{t(`${key}.step${i + 1}.body`)}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {article.hasAfter && (
        <>
          <View style={styles.rule} />
          <Text style={styles.body}>{t(`${key}.after`)}</Text>
        </>
      )}

      {article.hasNote && (
        <View style={styles.note}>
          <Text style={styles.noteText}>{t(`${key}.note`)}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  paper: {
    backgroundColor: Colors.paper,
    borderRadius: Radius.card,
    padding: 18,
    gap: 11,
  },
  eyebrow: {
    color: Colors.paperRed,
    fontFamily: Fonts.interSemiBold,
    fontSize: 9,
    letterSpacing: 1.53, // 0.17em @ 9 (label-caps register)
  },
  title: {
    color: Colors.paperInk,
    fontFamily: Fonts.bebas,
    fontSize: 27,
    letterSpacing: 1.08, // 0.04em @ 27 (display register)
  },
  lede: {
    color: Colors.paperInk2,
    fontFamily: Fonts.inter,
    fontSize: 13,
    lineHeight: 19,
  },
  body: {
    color: Colors.paperInk2,
    fontFamily: Fonts.inter,
    fontSize: 12.5,
    lineHeight: 19,
  },
  rule: { height: 1, backgroundColor: 'rgba(22,21,15,0.14)' },
  steps: { gap: 0 },
  step: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', paddingVertical: 9 },
  stepDivided: { borderTopWidth: 1, borderTopColor: 'rgba(22,21,15,0.11)' },
  stepNum: {
    width: 19,
    height: 19,
    borderRadius: Radius.full,
    backgroundColor: Colors.paperRed,
    color: Colors.paper,
    fontFamily: Fonts.interBold,
    fontSize: 10,
    lineHeight: 19,
    textAlign: 'center',
    overflow: 'hidden',
  },
  stepText: { flex: 1, gap: 2 },
  stepTitle: {
    color: Colors.paperInk,
    fontFamily: Fonts.interSemiBold,
    fontSize: 12.5,
    lineHeight: 17,
  },
  stepBody: {
    color: Colors.paperInk2,
    fontFamily: Fonts.inter,
    fontSize: 11.5,
    lineHeight: 16,
  },
  note: {
    backgroundColor: 'rgba(212,45,34,0.09)',
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteText: {
    color: Colors.paperInk,
    fontFamily: Fonts.inter,
    fontSize: 11.5,
    lineHeight: 16,
  },
})
