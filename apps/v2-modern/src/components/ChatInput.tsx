import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MicButton } from './MicButton'

interface ChatInputProps {
    onSend: (message: string) => void
    disabled?: boolean
    placeholder?: string
}

export function ChatInput({ onSend, disabled = false, placeholder = 'メッセージを入力...' }: ChatInputProps) {
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
        <div className="flex gap-2 p-4 border-t bg-white items-center">
            <MicButton onTranscript={handleTranscript} disabled={disabled} />
            <Input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                className="flex-1"
                maxLength={2000}
            />
            <Button
                onClick={handleSubmit}
                disabled={disabled || !value.trim()}
                className="px-6"
            >
                送信
            </Button>
        </div>
    )
}
