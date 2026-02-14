import { createElement, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { SoloKYSession } from '@/types/ky'
import { mockPDFSession, mockLongPDFSession } from './mockSession'

const viewerStyle: CSSProperties = {
    width: '860px',
}

type RenderStatus = 'idle' | 'loading' | 'ready' | 'error'

type PdfJsModule = typeof import('pdfjs-dist')
type PdfJsWorkerModule = { default?: string } | string

let pdfjsReady: Promise<{ pdfjs: PdfJsModule; workerSrc: string }> | null = null
let pdfRendererReady: Promise<{
    renderPdf: (document: ReturnType<typeof createElement>) => { toBlob: () => Promise<Blob> }
    KYSheetPDF: (props: { session: SoloKYSession }) => ReturnType<typeof createElement>
}> | null = null

// react-pdf は内部でグローバルな FontStore / renderer を共有するため、
// ブラウザ上で複数PDFを同時レンダリングするとレイアウトが不安定になり得る（E2Eがflaky化）。
// Debugページではレンダリングを直列化して安定性を優先する。
let pdfRenderQueue: Promise<unknown> = Promise.resolve()

function enqueuePdfRender<T>(task: () => Promise<T>): Promise<T> {
    const next = pdfRenderQueue.then(task, task)
    pdfRenderQueue = next.then(() => undefined, () => undefined)
    return next
}

let pdfFontsReady: Promise<void> | null = null
async function preloadPdfFonts() {
    if (!pdfFontsReady) {
        const urls = [
            '/fonts/Noto_Sans_JP/static/NotoSansJP-Regular.ttf',
            '/fonts/Noto_Sans_JP/static/NotoSansJP-Bold.ttf',
        ]
        pdfFontsReady = Promise.all(
            urls.map(async (url) => {
                try {
                    const res = await fetch(url)
                    if (!res.ok) throw new Error(`HTTP ${res.status}`)
                    // Warm cache and surface potential fetch issues early.
                    await res.arrayBuffer()
                } catch (error) {
                    // Best-effort: if fonts fail to preload, rendering may fallback but the page should still work.
                    console.warn('PDF font preload failed:', url, error)
                }
            })
        ).then(() => undefined)
    }
    return pdfFontsReady
}

async function loadPdfJs() {
    if (!pdfjsReady) {
        pdfjsReady = Promise.all([
            import('pdfjs-dist'),
            import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        ]).then(([pdfjsLib, worker]) => {
            const workerModule = worker as PdfJsWorkerModule
            const workerSrc = typeof workerModule === 'string' ? workerModule : (workerModule.default ?? '')
            pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc
            return { pdfjs: pdfjsLib, workerSrc }
        })
    }
    return pdfjsReady
}

async function loadPdfRenderer() {
    if (!pdfRendererReady) {
        pdfRendererReady = Promise.all([
            import('@react-pdf/renderer'),
            import('@/components/pdf/KYSheetPDF'),
        ]).then(([renderer, template]) => ({
            renderPdf: renderer.pdf,
            KYSheetPDF: template.KYSheetPDF,
        }))
    }
    return pdfRendererReady
}

async function renderPdfPagesInternal(container: HTMLDivElement, session: SoloKYSession) {
    await preloadPdfFonts()
    const { renderPdf, KYSheetPDF } = await loadPdfRenderer()
    const doc = createElement(KYSheetPDF, { session })
    const blob = await renderPdf(doc).toBlob()
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const { pdfjs } = await loadPdfJs()
    const pdfDoc = await pdfjs.getDocument({ data: bytes }).promise

    container.innerHTML = ''
    for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
        const page = await pdfDoc.getPage(pageNumber)
        const viewport = page.getViewport({ scale: 1.1 })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) {
            throw new Error('Canvas context could not be acquired')
        }

        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        canvas.style.display = 'block'
        canvas.style.backgroundColor = '#ffffff'
        canvas.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)'
        canvas.style.marginBottom = '16px'
        await page.render({ canvasContext: context, viewport, canvas }).promise
        container.appendChild(canvas)
    }
}

async function renderPdfPages(container: HTMLDivElement, session: SoloKYSession) {
    return enqueuePdfRender(() => renderPdfPagesInternal(container, session))
}

function PDFPreviewSection({
    title,
    session,
    testId,
}: {
    title: string
    session: SoloKYSession
    testId: string
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [status, setStatus] = useState<RenderStatus>('idle')
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let canceled = false
        const render = async () => {
            if (!containerRef.current) return
            setStatus('loading')
            setError(null)
            try {
                await renderPdfPages(containerRef.current, session)
                if (canceled) return
                setStatus('ready')
            } catch (err) {
                console.error('PDF debug render error:', err)
                if (canceled) return
                setStatus('error')
                setError('PDFのレンダリングに失敗しました')
            }
        }
        render()
        return () => {
            canceled = true
        }
    }, [session])

    return (
        <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-700">{title}</h2>
            <div
                data-testid={testId}
                data-ready={status === 'ready' ? 'true' : 'false'}
                className="border bg-white shadow-sm p-4"
                style={viewerStyle}
            >
                {status !== 'ready' && (
                    <p className="text-sm text-gray-500">
                        {status === 'error' ? error : 'PDFを読み込み中...'}
                    </p>
                )}
                <div ref={containerRef} />
            </div>
        </section>
    )
}

export function PDFDebugPage() {
    if (!import.meta.env.DEV) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">
                <p>Not Found</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto space-y-10">
                <header className="space-y-2">
                    <h1 className="text-2xl font-bold text-gray-800">PDF Debug Preview</h1>
                    <p className="text-sm text-gray-600">
                        レイアウト確認用の固定データを表示しています（開発環境限定）。
                    </p>
                </header>

                <PDFPreviewSection
                    title="標準データ"
                    session={mockPDFSession}
                    testId="pdf-viewer-standard"
                />

                <PDFPreviewSection
                    title="長文・複数項目データ"
                    session={mockLongPDFSession}
                    testId="pdf-viewer-long"
                />
            </div>
        </div>
    )
}
