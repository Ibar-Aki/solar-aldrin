
import { hc } from 'hono/client'
import type { AppType } from '../../workers/index'

// Viteのプロキシ設定に合わせるため、ベースURLはルート('/')
export const client: ReturnType<typeof hc<AppType>> = hc<AppType>('/', {
    headers: {
        'Content-Type': 'application/json',
    }
})
