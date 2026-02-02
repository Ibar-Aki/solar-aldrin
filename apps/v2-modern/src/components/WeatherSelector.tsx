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
            className="mt-1 w-full border rounded-md p-2"
            data-testid="select-weather"
            disabled={disabled}
        >
            {options.map(option => (
                <option key={option} value={option}>{option}</option>
            ))}
        </select>
    )
}

