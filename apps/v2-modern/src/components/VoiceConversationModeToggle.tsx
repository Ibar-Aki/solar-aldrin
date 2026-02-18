import { Button } from '@/components/ui/button'
import type { VoiceConversationMode } from '@/stores/useVoiceConversationModeStore'
import { cn } from '@/lib/utils'

interface VoiceConversationModeToggleProps {
    mode: VoiceConversationMode
    onChange: (mode: VoiceConversationMode) => void
    className?: string
    density?: 'default' | 'compact'
}

export function VoiceConversationModeToggle({
    mode,
    onChange,
    className,
    density = 'default',
}: VoiceConversationModeToggleProps) {
    const isCompact = density === 'compact'

    return (
        <div className={cn(isCompact && 'flex items-center gap-2', className)}>
            <div className={cn(
                'text-sm font-medium text-gray-700',
                isCompact && 'shrink-0 text-xs text-gray-600'
            )}
            >
                会話モード
            </div>
            <div className={cn('mt-2 flex gap-2', isCompact && 'mt-0 flex-1 gap-1')}>
                <Button
                    type="button"
                    variant={mode === 'normal' ? 'default' : 'outline'}
                    className={cn('flex-1', isCompact && 'h-8 px-2 text-xs')}
                    onClick={() => onChange('normal')}
                    aria-pressed={mode === 'normal'}
                    data-testid="mode-normal"
                >
                    通常モード
                </Button>
                <Button
                    type="button"
                    variant={mode === 'full_voice' ? 'default' : 'outline'}
                    className={cn('flex-1', isCompact && 'h-8 px-2 text-xs')}
                    onClick={() => onChange('full_voice')}
                    aria-pressed={mode === 'full_voice'}
                    data-testid="mode-full-voice"
                >
                    完全音声会話
                </Button>
            </div>
            {!isCompact && (
                <p className="mt-2 text-xs text-gray-500">
                    初期状態は通常モードです。
                </p>
            )}
        </div>
    )
}
