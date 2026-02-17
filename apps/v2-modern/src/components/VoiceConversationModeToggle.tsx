import { Button } from '@/components/ui/button'
import type { VoiceConversationMode } from '@/stores/useVoiceConversationModeStore'

interface VoiceConversationModeToggleProps {
    mode: VoiceConversationMode
    onChange: (mode: VoiceConversationMode) => void
    className?: string
}

export function VoiceConversationModeToggle({
    mode,
    onChange,
    className,
}: VoiceConversationModeToggleProps) {
    return (
        <div className={className}>
            <div className="text-sm font-medium text-gray-700">会話モード</div>
            <div className="mt-2 flex gap-2">
                <Button
                    type="button"
                    variant={mode === 'normal' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => onChange('normal')}
                    aria-pressed={mode === 'normal'}
                    data-testid="mode-normal"
                >
                    通常モード
                </Button>
                <Button
                    type="button"
                    variant={mode === 'full_voice' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => onChange('full_voice')}
                    aria-pressed={mode === 'full_voice'}
                    data-testid="mode-full-voice"
                >
                    完全音声会話
                </Button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
                初期状態は通常モードです。
            </p>
        </div>
    )
}

