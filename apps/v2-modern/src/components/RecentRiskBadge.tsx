type RecentRiskBadgeProps = {
    label?: string
}

export function RecentRiskBadge({ label = '昨日も指摘されました' }: RecentRiskBadgeProps) {
    return (
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">
            ⚠️ {label}
        </span>
    )
}

