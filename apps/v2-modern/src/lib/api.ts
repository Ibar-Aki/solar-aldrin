import { hc } from 'hono/client'
import type { AppType } from '../../workers/index'

// Viteのプロキシ設定に合わせるため、ベースURLはルート('/')
// Note: tsc -bのプロジェクト参照でworkersの型が正しく解決されない問題への対処
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const client = hc<AppType>('/', {
    headers: {
        'Content-Type': 'application/json',
    }
}) as ReturnType<typeof hc<AppType>>
