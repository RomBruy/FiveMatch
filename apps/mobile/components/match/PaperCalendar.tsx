import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'

interface PaperCalendarProps {
  /** Selected date as YYYY-MM-DD, or '' for no selection. */
  value: string
  onChange: (date: string) => void
  /**
   * Optional kickoff time as HH:MM. When supplied, the slot strip renders inside
   * the same paper card: "when" is one decision, not a date here and an hour
   * somewhere below it.
   */
  time?: string
  onTimeChange?: (time: string) => void
}

const DOT_SIZE = 26
// 48px touch floor (UX spec) — each 26px dot sits inside a taller pressable cell.
const CELL_HEIGHT = 44

// Half-hour slots across the hours 5-a-side is actually played. Typing "HH:MM"
// by hand was the awkward part of this form; a slot is one tap.
const TIME_SLOTS = [
  '18:00', '18:30', '19:00', '19:30', '20:00',
  '20:30', '21:00', '21:30', '22:00',
]

type DayCell = {
  date: Date
  inMonth: boolean
}

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateString(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Monday-first grid of the view month, padded with prev/next-month days to full weeks. */
function buildGrid(viewMonth: Date): DayCell[] {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
  const leading = (first.getDay() + 6) % 7 // JS Sunday=0 → Monday-first offset

  const cells: DayCell[] = []
  for (let i = leading; i > 0; i--) {
    cells.push({ date: new Date(first.getFullYear(), first.getMonth(), 1 - i), inMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(first.getFullYear(), first.getMonth(), d), inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]!.date
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false })
  }
  return cells
}

/**
 * The bone calendar — paper surface #1 of 3 (DESIGN.md): paper card radius 20
 * inside the dark screen. Controlled: `value` (YYYY-MM-DD) + `onChange`.
 */
export function PaperCalendar({ value, onChange, time, onTimeChange }: PaperCalendarProps) {
  const { t, i18n } = useTranslation()
  const selected = parseDateString(value)
  const showTime = onTimeChange !== undefined

  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const base = selected ?? new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const cells = useMemo(() => buildGrid(viewMonth), [viewMonth])

  const headerDate = selected ?? todayStart
  const dayNumeral = String(headerDate.getDate())
  const monthName = headerDate.toLocaleDateString(i18n.language, { month: 'long' }).toUpperCase()
  const weekdayName = selected
    ? selected.toLocaleDateString(i18n.language, { weekday: 'long' })
    : ''

  const navLabel = `${viewMonth.toLocaleDateString(i18n.language, { month: 'short' }).toUpperCase()} ${viewMonth.getFullYear()}`

  // Monday-first single-letter weekday header row.
  const weekdayLetters = useMemo(() => {
    const monday = new Date(2026, 0, 5) // a known Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
      return d.toLocaleDateString(i18n.language, { weekday: 'narrow' }).toUpperCase()
    })
  }, [i18n.language])

  const shiftMonth = (delta: number) => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerDate}>
          <Text style={styles.numeral} allowFontScaling={false}>{dayNumeral}</Text>
          <View style={styles.monthRow}>
            <Text style={styles.monthText} numberOfLines={1}>{monthName}</Text>
            {weekdayName.length > 0 && (
              <Text style={styles.weekdayText} numberOfLines={1}>{weekdayName}</Text>
            )}
          </View>
        </View>
        <View style={styles.nav}>
          <Pressable
            onPress={() => shiftMonth(-1)}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 8 }}
            accessibilityRole="button"
          >
            <Text style={styles.navChevron}>{'‹'}</Text>
          </Pressable>
          <Text style={styles.navLabel}>{navLabel}</Text>
          <Pressable
            onPress={() => shiftMonth(1)}
            hitSlop={{ top: 14, bottom: 14, left: 8, right: 14 }}
            accessibilityRole="button"
          >
            <Text style={styles.navChevron}>{'›'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.weekdayHeader}>
        {weekdayLetters.map((letter, i) => (
          <Text key={i} style={styles.weekdayLetter}>
            {letter}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell) => {
          const dateStr = toDateString(cell.date)
          const isSelected = value === dateStr
          const isPast = cell.date.getTime() < todayStart.getTime()
          const isToday = cell.date.getTime() === todayStart.getTime()

          // Each dot carries its day numeral — a date picker must be readable, not just tappable.
          const dot = (
            <View
              style={[
                styles.dot,
                cell.inMonth && isPast && styles.dotPast,
                isToday && !isSelected && styles.dotToday,
                isSelected && styles.dotSelected,
              ]}
            >
              <Text
                style={[
                  styles.dayNumeral,
                  !cell.inMonth && styles.dayNumeralOffMonth,
                  cell.inMonth && isPast && styles.dayNumeralPast,
                  isSelected && styles.dayNumeralSelected,
                ]}
              >
                {cell.date.getDate()}
              </Text>
            </View>
          )

          return (
            <Pressable
              key={dateStr}
              style={styles.cell}
              onPress={cell.inMonth ? () => onChange(dateStr) : undefined}
              disabled={!cell.inMonth}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: !cell.inMonth }}
              accessibilityLabel={cell.date.toLocaleDateString(i18n.language, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            >
              {isSelected ? <View style={styles.halo}>{dot}</View> : dot}
            </Pressable>
          )
        })}
      </View>

      {showTime && (
        <>
          <View style={styles.rule} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.timeStrip}
            keyboardShouldPersistTaps="handled"
          >
            {TIME_SLOTS.map((slot) => {
              const on = time === slot
              return (
                <Pressable
                  key={slot}
                  style={[styles.slot, on && styles.slotOn]}
                  onPress={() => onTimeChange?.(slot)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.slotText, on && styles.slotTextOn]}>{slot}</Text>
                </Pressable>
              )
            })}
          </ScrollView>
          {/* Says the decision back in words — the two halves are one sentence. */}
          <Text style={styles.kickoff} numberOfLines={2}>
            {selected && time
              ? t('match.create.kickoffAt', {
                  date: selected.toLocaleDateString(i18n.language, {
                    weekday: 'long', day: 'numeric', month: 'long',
                  }),
                  time,
                })
              : t('match.create.kickoffPrompt')}
          </Text>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.paper,
    borderRadius: Radius.card,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  // The date block must yield to the month nav, never push it off the card.
  headerDate: { flexShrink: 1, minWidth: 0 },
  numeral: {
    fontFamily: Fonts.bebas,
    fontSize: 64,
    // Bebas ascenders clip when lineHeight < fontSize; 68 is the smallest value
    // that still renders the glyph whole on both platforms.
    lineHeight: 68,
    includeFontPadding: false,
    color: Colors.paperInk,
    fontVariant: ['tabular-nums'],
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  monthText: {
    flexShrink: 1,
    fontFamily: Fonts.interBold,
    fontSize: 15,
    letterSpacing: 0.75, // 0.05em @ 15
    color: Colors.paperInk,
  },
  weekdayText: {
    flexShrink: 1,
    fontFamily: Fonts.interMedium,
    fontSize: 13,
    color: Colors.paperInk2,
    textTransform: 'capitalize',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 8,
  },
  navChevron: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 16,
    color: Colors.paperInk2,
  },
  navLabel: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    color: Colors.paperInk2,
    fontVariant: ['tabular-nums'],
  },
  weekdayHeader: {
    flexDirection: 'row',
    marginTop: 14,
    marginBottom: 4,
  },
  weekdayLetter: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.paperInk2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    height: CELL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPast: {
    backgroundColor: 'transparent',
  },
  dotToday: {
    borderWidth: 1.5,
    borderColor: Colors.paperRed,
  },
  dotSelected: {
    backgroundColor: Colors.paperRed,
  },
  dayNumeral: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    color: Colors.paperInk,
    fontVariant: ['tabular-nums'],
  },
  dayNumeralOffMonth: {
    color: Colors.paperDot,
  },
  dayNumeralPast: {
    color: Colors.paperInk2,
    opacity: 0.55,
  },
  dayNumeralSelected: {
    color: Colors.paper,
    fontFamily: Fonts.interBold,
  },
  rule: {
    height: 1,
    backgroundColor: 'rgba(22,21,15,0.13)',
    marginHorizontal: -4,
    marginTop: 12,
  },
  timeStrip: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 12,
    paddingRight: 4,
  },
  slot: {
    height: 40,
    minWidth: 62,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22,21,15,0.06)',
  },
  slotOn: { backgroundColor: Colors.paperRed },
  slotText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    color: Colors.paperInk,
    fontVariant: ['tabular-nums'],
  },
  slotTextOn: { color: Colors.paper, fontFamily: Fonts.interBold },
  kickoff: {
    fontFamily: Fonts.interMedium,
    fontSize: 11.5,
    lineHeight: 16,
    color: Colors.paperInk2,
    marginTop: 11,
  },
  // Mockup halo: 3px paper gap + 1.5px paperRed outer ring around the selected dot.
  halo: {
    padding: 3,
    borderRadius: (DOT_SIZE + 9) / 2,
    borderWidth: 1.5,
    borderColor: Colors.paperRed,
    backgroundColor: Colors.paper,
  },
})
