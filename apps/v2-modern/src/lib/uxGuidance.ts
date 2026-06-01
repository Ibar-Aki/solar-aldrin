export type HomeStartReadinessReason =
    | 'missing_both'
    | 'missing_user'
    | 'missing_site'
    | 'ready'
    | 'starting'

export type HomeStartReadiness = {
    canStart: boolean
    reason: HomeStartReadinessReason
    message: string
}

export function getHomeStartReadiness(params: {
    userName: string
    siteName: string
    isStarting?: boolean
}): HomeStartReadiness {
    if (params.isStarting) {
        return {
            canStart: false,
            reason: 'starting',
            message: '開始準備中です。画面が切り替わるまでお待ちください。',
        }
    }

    const hasUserName = params.userName.trim().length > 0
    const hasSiteName = params.siteName.trim().length > 0

    if (!hasUserName && !hasSiteName) {
        return {
            canStart: false,
            reason: 'missing_both',
            message: '作業者名と現場名を入力すると開始できます。',
        }
    }

    if (!hasUserName) {
        return {
            canStart: false,
            reason: 'missing_user',
            message: '作業者名を入力すると開始できます。',
        }
    }

    if (!hasSiteName) {
        return {
            canStart: false,
            reason: 'missing_site',
            message: '現場名を入力すると開始できます。',
        }
    }

    return {
        canStart: true,
        reason: 'ready',
        message: '入力OKです。KY活動を開始できます。完了後は履歴に自動保存されます。',
    }
}

export type AiWaitStage = 'sending' | 'thinking' | 'slow'

export type AiWaitStatus = {
    stage: AiWaitStage
    label: string
    detail: string
}

export function getAiWaitStatus(elapsedMs: number, slowAfterMs = 15_000): AiWaitStatus {
    const safeElapsedMs = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0)
    const safeSlowAfterMs = Math.max(1_000, Number.isFinite(slowAfterMs) ? slowAfterMs : 15_000)

    if (safeElapsedMs < 1_200) {
        return {
            stage: 'sending',
            label: '送信中...',
            detail: '入力内容をAIに送っています。',
        }
    }

    if (safeElapsedMs < safeSlowAfterMs) {
        return {
            stage: 'thinking',
            label: 'AIが内容を確認中...',
            detail: '危険と対策の流れを整理しています。',
        }
    }

    return {
        stage: 'slow',
        label: '応答が遅れています',
        detail: `${Math.ceil(safeSlowAfterMs / 1000)}秒以上かかっています。混雑している可能性があります。このままお待ちください。`,
    }
}
