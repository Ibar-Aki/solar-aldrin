import { captureException as sentryCaptureException, withScope } from '@sentry/cloudflare'

export function captureException(error: unknown, context?: Record<string, string>) {
    withScope((scope) => {
        if (context) {
            for (const [key, value] of Object.entries(context)) {
                scope.setTag(key, value)
            }
        }
        sentryCaptureException(error)
    })
}
