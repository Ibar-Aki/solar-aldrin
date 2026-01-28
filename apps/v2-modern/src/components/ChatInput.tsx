import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MicButton } from './MicButton'
import { cn } from '@/lib/utils'

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
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!disabled) {
            inputRef.current?.focus()
        }
    }, [disabled])

    const handleSubmit = () => {
        const trimmed = value.trim()
        if (trimmed && !disabled) {
            onSend(trimmed)
            setValue('')
        }
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
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
                'flex gap-2 items-center',
                variant === 'default' && 'p-4 border-t bg-white',
                containerClassName
            )}
        >
            <MicButton onTranscript={handleTranscript} disabled={disabled} />
            <Input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                className={cn('flex-1 h-11 rounded-full px-4 py-2', inputClassName)}
                maxLength={2000}
            />
            <Button
                onClick={handleSubmit}
                disabled={disabled || !value.trim()}
                className={cn('px-6 h-11 rounded-full', buttonClassName)}
            >
                送信
            </Button>
        </div>
    )
}
