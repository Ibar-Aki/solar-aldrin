import { useState, useRef, useEffect, useLayoutEffect, useCallback, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MicButton } from './MicButton'
import { cn } from '@/lib/utils'
import { SendHorizontal } from 'lucide-react'

import { USER_CONTENT_MAX_LENGTH } from '@/lib/schema'
import type { VoiceConversationMode } from '@/stores/useVoiceConversationModeStore'

interface ChatInputProps {
    onSend: (message: string) => void
    disabled?: boolean
    placeholder?: string
    variant?: 'default' | 'bare'
    voiceMode?: VoiceConversationMode
    micAutoStartEnabled?: boolean
    containerClassName?: string
    inputClassName?: string
    buttonClassName?: string
}

export function ChatInput({
    onSend,
    disabled = false,
    placeholder = 'メッセージを入力...',
    variant = 'default',
    voiceMode = 'normal',
    micAutoStartEnabled = true,
    containerClassName,
    inputClassName,
    buttonClassName,
}: ChatInputProps) {
    const [value, setValue] = useState('')
    const [micError, setMicError] = useState<string | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const lastAutoSubmitRef = useRef<{ text: string; timestamp: number } | null>(null)
    const maxRows = 3
    const AUTO_SUBMIT_DEDUP_MS = 1500

    useEffect(() => {
        if (!disabled) {
            textareaRef.current?.focus()
        }
    }, [disabled])

    const resizeTextarea = useCallback(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = 'auto'
        const style = window.getComputedStyle(el)
        const lineHeight = Number.parseFloat(style.lineHeight) || 24
        const paddingTop = Number.parseFloat(style.paddingTop) || 0
        const paddingBottom = Number.parseFloat(style.paddingBottom) || 0
        const padding = paddingTop + paddingBottom
        const maxHeight = lineHeight * maxRows + padding
        const nextHeight = Math.min(el.scrollHeight, maxHeight)
        el.style.height = `${nextHeight}px`
        el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
    }, [maxRows])

    useLayoutEffect(() => {
        resizeTextarea()
    }, [value, resizeTextarea])

    const handleSubmit = () => {
        const trimmed = value.trim()
        if (trimmed && !disabled) {
            onSend(trimmed)
            setValue('')
        }
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            handleSubmit()
        }
    }

    const handleTranscript = (text: string) => {
        if (voiceMode === 'full_voice') {
            setValue(text)
            return
        }
        setValue((prev) => (prev ? `${prev} ${text}` : text))
    }

    const handleFinalTranscript = (text: string) => {
        if (voiceMode !== 'full_voice') return
        if (disabled) return
        const trimmed = text.trim()
        if (!trimmed) return

        const now = Date.now()
        const last = lastAutoSubmitRef.current
        if (last && last.text === trimmed && now - last.timestamp < AUTO_SUBMIT_DEDUP_MS) {
            return
        }

        lastAutoSubmitRef.current = { text: trimmed, timestamp: now }
        onSend(trimmed)
        setValue('')
    }

    return (
        <div
            className={cn(
                'flex flex-col gap-1',
                variant === 'default' && 'p-4 border-t bg-white',
                containerClassName
            )}
        >
            {micError && (
                <div
                    className="w-fit max-w-[80%] rounded-sm border border-amber-400 bg-amber-50 px-3 py-1 text-xs leading-5 text-slate-700"
                    role="status"
                    aria-live="polite"
                    data-testid="mic-error-message"
                >
                    {micError}
                </div>
            )}

            <div className="flex gap-2 items-center">
                <MicButton
                    onTranscript={handleTranscript}
                    onFinalTranscript={handleFinalTranscript}
                    disabled={disabled}
                    inputValue={value}
                    onErrorChange={setMicError}
                    voiceMode={voiceMode}
                    autoStart={voiceMode === 'full_voice'}
                    autoStartEnabled={micAutoStartEnabled}
                />
                <Textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    rows={1}
                    className={cn(
                        'flex-1 min-h-10 sm:min-h-11 max-h-[5.5rem] resize-none rounded-2xl px-4 py-2 text-base leading-6 placeholder:text-muted-foreground/70',
                        inputClassName
                    )}
                    maxLength={USER_CONTENT_MAX_LENGTH}
                    data-testid="input-chat-message"
                />
                <Button
                    onClick={handleSubmit}
                    disabled={disabled || !value.trim()}
                    className={cn(
                        'h-10 w-10 sm:h-11 sm:w-11 rounded-full p-0 bg-blue-400 text-white hover:bg-blue-500',
                        buttonClassName
                    )}
                    aria-label="送信"
                    data-testid="button-send-message"
                >
                    <SendHorizontal className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
            </div>
        </div>
    )
}
