import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// next/navigation's useRouter requires an app-router context that isn't
// present under plain React Testing Library rendering. Client components
// (EventForm, FilterBar, RegistrationPanel, ...) call useRouter() at the
// top level, so every component test needs this stub in place.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '',
  useSearchParams: () => new URLSearchParams(),
}))
