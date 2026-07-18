import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'

interface PaperCalendarProps {
  /** Selected date as YYYY-MM-DD, or '' for no selection. */
  value: string
  onChange: (date: string) => void
}

const DOT_SIZE = 26
// 48px touch floor (UX spec) — each 26px dot sits inside a taller pressable cell.
const CELL_HEIGHT = 44

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
export function PaperCalendar({ value, onChange }: PaperCalendarProps) {
  const { i18n } = useTranslation()
  const selected = parseDateString(value)

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
        <View>
          <Text style={styles.numeral}>{dayNumeral}</Text>
          <View style={styles.monthRow}>
            <Text style={styles.monthText}>{monthName}</Text>
            {weekdayName.length > 0 && <Text style={styles.weekdayText}>{weekdayName}</Text>}
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
  },
  numeral: {
    fontFamily: Fonts.bebas,
    fontSize: 64,
    lineHeight: 58, // 0.9 line-height per the bone board
    color: Colors.paperInk,
    fontVariant: ['tabular-nums'],
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 2,
  },
  monthText: {
    fontFamily: Fonts.interBold,
    fontSize: 15,
    letterSpacing: 0.75, // 0.05em @ 15
    color: Colors.paperInk,
  },
  weekdayText: {
    fontFamily: Fonts.interMedium,
    fontSize: 13,
    color: Colors.paperInk2,
    textTransform: 'capitalize',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
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
  // Mockup halo: 3px paper gap + 1.5px paperRed outer ring around the selected dot.
  halo: {
    padding: 3,
    borderRadius: (DOT_SIZE + 9) / 2,
    borderWidth: 1.5,
    borderColor: Colors.paperRed,
    backgroundColor: Colors.paper,
  },
})
