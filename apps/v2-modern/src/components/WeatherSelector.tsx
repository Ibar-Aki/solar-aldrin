type WeatherSelectorProps = {
    value: string
    onChange: (value: string) => void
    options: readonly string[]
    disabled?: boolean
}

export function WeatherSelector({ value, onChange, options, disabled }: WeatherSelectorProps) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-[color:var(--surface-border)] bg-[var(--surface-card)] px-3 text-sm text-slate-800 shadow-xs transition-colors outline-none focus-visible:border-[color:var(--focus-ring)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--focus-ring)_25%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="select-weather"
            disabled={disabled}
        >
            {options.map(option => (
                <option key={option} value={option}>{option}</option>
            ))}
        </select>
    )
}
