import '@testing-library/jest-dom'
import { vi } from 'vitest'

// jsdom does not implement this browser layout API.
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: vi.fn(),
})
