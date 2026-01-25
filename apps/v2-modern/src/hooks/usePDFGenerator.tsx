/**
 * PDF生成フック
 */
import { useCallback, useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { KYSheetPDF } from '@/components/pdf/KYSheetPDF'
import type { SoloKYSession } from '@/types/ky'

export function usePDFGenerator() {
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    /**
     * PDFを生成してダウンロード
     */
    const generateAndDownload = useCallback(async (session: SoloKYSession) => {
        if (!session) {
            setError('セッションデータがありません')
            return
        }

        setIsGenerating(true)
        setError(null)

        try {
            // PDFドキュメントを生成
            const doc = <KYSheetPDF session={session} />
            const blob = await pdf(doc).toBlob()

            // ファイル名を生成
            const date = new Date(session.createdAt)
            const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
            // ファイル名サニタイズ（/ \ : * ? " < > | を置換）
            const safeSiteName = session.siteName.replace(/[\\/:*?"<>|]/g, '_')
            const fileName = `KY活動記録_${safeSiteName}_${dateStr}.pdf`

            // ダウンロード
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = fileName
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)

        } catch (e) {
            console.error('PDF generation error:', e)
            setError('PDF生成に失敗しました')
        } finally {
            setIsGenerating(false)
        }
    }, [])

    /**
     * PDFをBlobとして取得
     */
    const generateBlob = useCallback(async (session: SoloKYSession): Promise<Blob | null> => {
        if (!session) {
            setError('セッションデータがありません')
            return null
        }

        setIsGenerating(true)
        setError(null)

        try {
            const doc = <KYSheetPDF session={session} />
            const blob = await pdf(doc).toBlob()
            return blob
        } catch (e) {
            console.error('PDF generation error:', e)
            setError('PDF生成に失敗しました')
            return null
        } finally {
            setIsGenerating(false)
        }
    }, [])

    return {
        generateAndDownload,
        generateBlob,
        isGenerating,
        error,
    }
}
