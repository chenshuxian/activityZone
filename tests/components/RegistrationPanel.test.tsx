import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { RegistrationPanel } from '@/components/RegistrationPanel'

const base = {
  eventId: 'e1', capacity: 10, registeredCount: 3,
  fields: [], startAt: new Date(Date.now()+86400000).toISOString(),
  registrationDeadline: null as string | null,
}

test('未登入顯示登入提示', () => {
  render(<RegistrationPanel {...base} isLoggedIn={false} myRegistration={null} />)
  expect(screen.getByText(/登入後報名/)).toBeInTheDocument()
})
test('已報名顯示取消', () => {
  render(<RegistrationPanel {...base} isLoggedIn={true} myRegistration={{ status:'registered', waitlistPosition:null }} />)
  expect(screen.getByText(/已報名/)).toBeInTheDocument()
  expect(screen.getByText(/取消報名/)).toBeInTheDocument()
})
test('額滿且未報名顯示加入候補', () => {
  render(<RegistrationPanel {...base} registeredCount={10} isLoggedIn={true} myRegistration={null} />)
  expect(screen.getByText(/已額滿/)).toBeInTheDocument()
})
test('候補中顯示序位', () => {
  render(<RegistrationPanel {...base} registeredCount={10} isLoggedIn={true} myRegistration={{ status:'waitlist', waitlistPosition:2 }} />)
  expect(screen.getByText(/第 2 位/)).toBeInTheDocument()
})
