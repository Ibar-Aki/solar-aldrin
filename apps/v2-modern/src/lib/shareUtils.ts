export type ShareResult = 'shared' | 'copied'
export type FileShareResult = 'shared' | 'downloaded'

type NavigatorWithShare = Navigator & {
    share?: (data: ShareData) => Promise<void>
    canShare?: (data: ShareData) => boolean
}

export async function shareUrl(options: {
    title: string
    text: string
    url?: string
}): Promise<ShareResult> {
    const url = options.url ?? (typeof window !== 'undefined' ? window.location.href : '')
    const nav = typeof navigator !== 'undefined' ? navigator as NavigatorWithShare : null
    const shareData: ShareData = {
        title: options.title,
        text: options.text,
        url,
    }

    if (nav?.share) {
        await nav.share(shareData)
        return 'shared'
    }

    await navigator.clipboard.writeText(url)
    return 'copied'
}

export async function shareFileOrDownload(options: {
    blob: Blob
    fileName: string
    title: string
    text: string
    fallbackDownload: () => void
}): Promise<FileShareResult> {
    const nav = typeof navigator !== 'undefined' ? navigator as NavigatorWithShare : null
    const file = typeof File !== 'undefined'
        ? new File([options.blob], options.fileName, { type: options.blob.type || 'application/pdf' })
        : null
    const shareData: ShareData | null = file
        ? {
            title: options.title,
            text: options.text,
            files: [file],
        }
        : null

    if (nav?.share && shareData && (!nav.canShare || nav.canShare(shareData))) {
        await nav.share(shareData)
        return 'shared'
    }

    options.fallbackDownload()
    return 'downloaded'
}
