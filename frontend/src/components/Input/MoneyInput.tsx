import { IMaskInput } from 'react-imask'
import { forwardRef } from 'react'

interface MoneyInputProps {
  value: number | undefined
  onChange: (value: number | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * Input de valor em R$ com máscara PT-BR (milhares com . e decimais com ,).
 * Exemplo: digita "150000" → mostra "1.500,00" → onChange recebe 1500.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, placeholder = 'R$ 0,00', className = 'input-field', disabled }, ref) => {
    return (
      <IMaskInput
        // @ts-ignore — react-imask aceita ref mas o tipo é complicado
        inputRef={ref}
        mask="R$ num"
        blocks={{
          num: {
            mask: Number,
            scale: 2,
            thousandsSeparator: '.',
            radix: ',',
            mapToRadix: ['.'],
            normalizeZeros: true,
            padFractionalZeros: true,
            min: 0,
          },
        }}
        unmask={true}
        value={value === undefined || value === null ? '' : String(value)}
        onAccept={(unmaskedValue: string) => {
          if (!unmaskedValue || unmaskedValue === '0') return onChange(undefined)
          const num = parseFloat(unmaskedValue)
          onChange(Number.isFinite(num) ? num : undefined)
        }}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />
    )
  }
)

MoneyInput.displayName = 'MoneyInput'
