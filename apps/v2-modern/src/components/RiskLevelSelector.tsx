interface RiskLevelSelectorProps {
    value: number | undefined
    onChange: (level: 1 | 2 | 3 | 4 | 5) => void
    disabled?: boolean
}

const LEVELS = [
    { value: 1 as const, label: '1', desc: '軽微', color: 'bg-green-100 border-green-400 text-green-700' },
    { value: 2 as const, label: '2', desc: '低', color: 'bg-lime-100 border-lime-400 text-lime-700' },
    { value: 3 as const, label: '3', desc: '中', color: 'bg-yellow-100 border-yellow-400 text-yellow-700' },
    { value: 4 as const, label: '4', desc: '高', color: 'bg-orange-100 border-orange-400 text-orange-700' },
    { value: 5 as const, label: '5', desc: '重大', color: 'bg-red-100 border-red-400 text-red-700' },
]

export function RiskLevelSelector({ value, onChange, disabled = false }: RiskLevelSelectorProps) {
    return (
        <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">危険度を選択</p>
            <div className="flex gap-2">
                {LEVELS.map((level) => (
                    <button
                        key={level.value}
                        type="button"
                        onClick={() => onChange(level.value)}
                        disabled={disabled}
                        className={`
              flex-1 py-3 px-2 rounded-lg border-2 transition-all
              ${value === level.value
                                ? `${level.color} border-current ring-2 ring-offset-1`
                                : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                            }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
                    >
                        <div className="text-lg font-bold">{level.label}</div>
                        <div className="text-xs">{level.desc}</div>
                    </button>
                ))}
            </div>
        </div>
    )
}
