import { forwardRef, useState } from 'react'
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'

export const Input = forwardRef<TextInput, TextInputProps>(function Input(
  { style, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false)

  return (
    <View style={[styles.halo, focused && styles.haloFocused]}>
      <TextInput
        ref={ref}
        placeholderTextColor={Colors.inkDisabled}
        {...props}
        style={[styles.input, focused && styles.inputFocused, style]}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  halo: {
    borderRadius: Radius.md + 3,
    padding: 3,
    backgroundColor: 'transparent',
  },
  haloFocused: {
    backgroundColor: Colors.primarySubtle,
  },
  input: {
    height: 54,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.hairline,
    paddingHorizontal: 16,
    color: Colors.ink,
    fontSize: 15,
    fontFamily: Fonts.inter,
  },
  inputFocused: {
    borderColor: Colors.primary,
  },
})
