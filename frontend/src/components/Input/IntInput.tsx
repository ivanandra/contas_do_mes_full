import { IMaskInput } from 'react-imask'
import { forwardRef } from 'react'

interface IntInputProps {
  value: number | undefined
  onChange: (value: number | undefined) => void
  placeholder?: string
  className?: string
  min?: number
  max?: number
  disabled?: boolean
}

/**
 * Input de número inteiro com limites opcionais. Útil pra dia de vencimento, número de parcelas, etc.
 */
export const IntInput = forwardRef<HTMLInputElement, IntInputProps>(
  ({ value, onChange, placeholder, className = 'input-field', min, max, disabled }, ref) => {
    return (
      <IMaskInput
        // @ts-ignore
        inputRef={ref}
        mask={Number}
        scale={0}
        thousandsSeparator=""
        min={min}
        max={max}
        unmask={true}
        value={value === undefined || value === null ? '' : String(value)}
        onAccept={(unmaskedValue: string) => {
          if (!unmaskedValue) return onChange(undefined)
          const num = parseInt(unmaskedValue, 10)
          onChange(Number.isFinite(num) ? num : undefined)
        }}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />
    )
  }
)

IntInput.displayName = 'IntInput'
