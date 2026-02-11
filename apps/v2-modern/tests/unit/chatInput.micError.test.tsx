import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { ChatInput } from '@/components/ChatInput'

vi.mock('@/components/MicButton', () => ({
    MicButton: ({ onErrorChange }: { onErrorChange?: (error: string | null) => void }) => {
        useEffect(() => {
            onErrorChange?.('マイクのエラーここに表示')
        }, [onErrorChange])

        return <button type="button">Mic</button>
    },
}))

describe('ChatInput mic error', () => {
    it('マイクエラーを入力欄の上段メッセージ領域に表示する', async () => {
        render(<ChatInput onSend={() => { }} variant="bare" />)

        expect(await screen.findByText('マイクのエラーここに表示')).toBeInTheDocument()
        expect(screen.getByTestId('mic-error-message')).toHaveTextContent('マイクのエラーここに表示')
    })
})

