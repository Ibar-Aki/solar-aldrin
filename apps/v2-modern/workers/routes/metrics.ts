import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { logInfo } from '../observability/logger'

export type AnalyticsEngineDataset = {
    writeDataPoint: (data: {
        indexes?: string[]
        doubles?: number[]
        blobs?: string[]
    }) => void
}

type Bindings = {
    ANALYTICS_DATASET?: AnalyticsEngineDataset
}

const metrics = new Hono<{ Bindings: Bindings }>()

const MetricEventSchema = z.object({
    event: z.enum(['session_start', 'session_complete', 'input_length', 'web_vital']),
    timestamp: z.string().optional(),
    sessionId: z.string().uuid().optional(),
    value: z.number().optional(),
    data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
})

metrics.post(
    '/',
    zValidator('json', MetricEventSchema, (result, c) => {
        if (!result.success) {
            return c.json({ error: 'Invalid metrics payload', details: result.error }, 400)
        }
    }),
    async (c) => {
        const payload = c.req.valid('json')
        const eventTime = payload.timestamp ?? new Date().toISOString()

        if (c.env.ANALYTICS_DATASET) {
            c.env.ANALYTICS_DATASET.writeDataPoint({
                indexes: [
                    payload.event,
                    payload.sessionId ?? '',
                ],
                doubles: [
                    payload.value ?? 0,
                ],
                blobs: [
                    JSON.stringify({
                        ...payload.data,
                        timestamp: eventTime,
                    }),
                ],
            })
        } else {
            logInfo('metrics_event', {
                event: payload.event,
                sessionId: payload.sessionId,
                value: payload.value ?? null,
            })
        }

        return c.json({ ok: true })
    }
)

export { metrics }
