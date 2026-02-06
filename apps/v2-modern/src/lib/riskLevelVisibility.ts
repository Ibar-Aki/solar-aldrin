import type { ExtractedData } from '@/types/ky'

type NextAction = NonNullable<ExtractedData['nextAction']>

type Params = {
    lastAssistantNextAction?: NextAction
    currentRiskLevel?: ExtractedData['riskLevel']
}

/**
 * 危険度選択UIは、AIが危険度評価を求める段階に入った時だけ表示する。
 */
export function shouldShowRiskLevelSelector({ lastAssistantNextAction, currentRiskLevel }: Params): boolean {
    return lastAssistantNextAction === 'ask_risk_level' && currentRiskLevel == null
}
