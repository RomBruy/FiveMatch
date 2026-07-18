import { useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'

interface CodeInputProps {
  value: string
  onChangeText: (value: string) => void
  length?: number
  accessibilityLabel?: string
  autoFocus?: boolean
}

// Invite-code register: --type-stat Bebas widened to 0.34em (0.34 × 22).
const CODE_LETTER_SPACING = 7.48

/**
 * Verification code boxes. One hidden TextInput carries the whole value so the
 * caller's single-string state machine stays untouched; the cells are display only.
 */
export function CodeInput({ value, onChangeText, length = 6, accessibilityLabel, autoFocus = true }: CodeInputProps) {
  const inputRef = useRef<TextInput>(null)
  const [focused, setFocused] = useState(false)
  const activeIndex = Math.min(value.length, length - 1)

  return (
    <Pressable onPress={() => inputRef.current?.focus()} accessible={false}>
      <View style={styles.row} pointerEvents="none">
        {Array.from({ length }, (_, i) => {
          const active = focused && i === activeIndex && value.length < length
          return (
            <View key={i} style={[styles.halo, active && styles.haloActive]}>
              <View style={[styles.cell, active && styles.cellActive]}>
                <Text style={[styles.digit, active && styles.digitActive]}>{value[i] ?? ''}</Text>
              </View>
            </View>
          )
        })}
      </View>
      <TextInput
        ref={inputRef}
        style={styles.hidden}
        value={value}
        onChangeText={onChangeText}
        maxLength={length}
        keyboardType="number-pad"
        autoCapitalize="none"
        autoFocus={autoFocus}
        caretHidden
        accessibilityLabel={accessibilityLabel}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  halo: {
    borderRadius: Radius.md + 3,
    padding: 3,
    backgroundColor: 'transparent',
  },
  haloActive: {
    backgroundColor: Colors.primarySubtle,
  },
  cell: {
    width: 44,
    height: 60,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: {
    borderColor: Colors.primary,
  },
  digit: {
    fontFamily: Fonts.bebas,
    fontSize: 22,
    letterSpacing: CODE_LETTER_SPACING,
    // letterSpacing trails the glyph — offset so the digit stays optically centered.
    marginRight: -CODE_LETTER_SPACING,
    color: Colors.ink,
  },
  digitActive: {
    color: Colors.primary,
  },
  hidden: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
})
