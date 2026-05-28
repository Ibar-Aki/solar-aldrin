/**
 * PDF生成フック
 */
import { createElement, useCallback, useState } from 'react'
import type { SoloKYSession, FeedbackSummary, SupplementItem } from '@/types/ky'
import type { RecentRiskMatch } from '@/lib/historyUtils'
import { shareFileOrDownload, type FileShareResult } from '@/lib/shareUtils'

type PDFOptions = {
    feedback?: FeedbackSummary | null
    supplements?: SupplementItem[]
    actionGoalOverride?: string | null
    recentRisks?: RecentRiskMatch[]
}

let pdfDepsPromise:
    | Promise<{
        renderPdf: (document: ReturnType<typeof createElement>) => { toBlob: () => Promise<Blob> }
        KYSheetPDF: (props: {
            session: SoloKYSession
            feedback?: FeedbackSummary | null
            supplements?: SupplementItem[]
            actionGoalOverride?: string | null
            recentRisks?: RecentRiskMatch[]
        }) => ReturnType<typeof createElement>
    }>
    | null = null

async function loadPdfDependencies() {
    if (!pdfDepsPromise) {
        pdfDepsPromise = Promise.all([
            import('@react-pdf/renderer'),
            import('@/components/pdf/KYSheetPDF'),
        ]).then(([renderer, pdfTemplate]) => ({
            renderPdf: renderer.pdf,
            KYSheetPDF: pdfTemplate.KYSheetPDF,
        }))
    }
    return pdfDepsPromise
}

async function buildPdfBlob(session: SoloKYSession, options?: PDFOptions): Promise<Blob> {
    const { renderPdf, KYSheetPDF } = await loadPdfDependencies()
    const doc = createElement(KYSheetPDF, {
        session,
        feedback: options?.feedback ?? null,
        supplements: options?.supplements ?? [],
        actionGoalOverride: options?.actionGoalOverride ?? null,
        recentRisks: options?.recentRisks ?? [],
    })
    return renderPdf(doc).toBlob()
}

function buildPdfFilename(session: SoloKYSession): string {
    const date = new Date(session.createdAt)
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
    const safeSiteName = session.siteName.replace(/[\\/:*?"<>|]/g, '_')
    return `KY活動記録_${safeSiteName}_${dateStr}.pdf`
}

function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

export function usePDFGenerator() {
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    /**
     * PDFを生成してダウンロード
     */
    const generateAndDownload = useCallback(async (session: SoloKYSession, options?: PDFOptions) => {
        if (!session) {
            setError('セッションデータがありません')
            return
        }

        setIsGenerating(true)
        setError(null)

        try {
            const blob = await buildPdfBlob(session, options)
            downloadBlob(blob, buildPdfFilename(session))

        } catch (e) {
            console.error('PDF generation error:', e)
            setError('PDF生成に失敗しました')
        } finally {
            setIsGenerating(false)
        }
    }, [])

    const generateAndShare = useCallback(async (session: SoloKYSession, options?: PDFOptions): Promise<FileShareResult | null> => {
        if (!session) {
            setError('セッションデータがありません')
            return null
        }

        setIsGenerating(true)
        setError(null)

        try {
            const blob = await buildPdfBlob(session, options)
            const fileName = buildPdfFilename(session)
            return await shareFileOrDownload({
                blob,
                fileName,
                title: 'KY活動記録',
                text: `${session.siteName}のKY活動記録です。`,
                fallbackDownload: () => downloadBlob(blob, fileName),
            })
        } catch (e) {
            console.error('PDF share error:', e)
            setError('PDF共有に失敗しました')
            return null
        } finally {
            setIsGenerating(false)
        }
    }, [])

    /**
     * PDFをBlobとして取得
     */
    const generateBlob = useCallback(async (session: SoloKYSession, options?: PDFOptions): Promise<Blob | null> => {
        if (!session) {
            setError('セッションデータがありません')
            return null
        }

        setIsGenerating(true)
        setError(null)

        try {
            const blob = await buildPdfBlob(session, options)
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
        generateAndShare,
        generateBlob,
        isGenerating,
        error,
    }
}
