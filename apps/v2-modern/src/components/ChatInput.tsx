import { useState, useRef, useEffect, useLayoutEffect, useCallback, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MicButton } from './MicButton'
import { cn } from '@/lib/utils'
import { SendHorizontal } from 'lucide-react'

import { USER_CONTENT_MAX_LENGTH } from '@/lib/schema'

interface ChatInputProps {
    onSend: (message: string) => void
    disabled?: boolean
    placeholder?: string
    variant?: 'default' | 'bare'
    containerClassName?: string
    inputClassName?: string
    buttonClassName?: string
}

export function ChatInput({
    onSend,
    disabled = false,
    placeholder = 'メッセージを入力...',
    variant = 'default',
    containerClassName,
    inputClassName,
    buttonClassName,
}: ChatInputProps) {
    const [value, setValue] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const maxRows = 3

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
        setValue((prev) => (prev ? `${prev} ${text}` : text))
    }

    return (
        <div
            className={cn(
                'flex gap-2 items-end',
                variant === 'default' && 'p-4 border-t bg-white',
                containerClassName
            )}
        >
            <MicButton onTranscript={handleTranscript} disabled={disabled} />
            <Textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                rows={1}
                className={cn(
                    'flex-1 min-h-11 max-h-[5.5rem] resize-none rounded-2xl px-4 py-2 text-base leading-6 placeholder:text-muted-foreground/70',
                    inputClassName
                )}
                maxLength={USER_CONTENT_MAX_LENGTH}
                data-testid="input-chat-message"
            />
            <Button
                onClick={handleSubmit}
                disabled={disabled || !value.trim()}
                className={cn('h-11 w-11 rounded-full p-0 bg-blue-500 text-white hover:bg-blue-600', buttonClassName)}
                aria-label="送信"
                data-testid="button-send-message"
            >
                <SendHorizontal className="h-5 w-5" />
            </Button>
        </div>
    )
}
