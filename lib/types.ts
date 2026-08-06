export type EventStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'ended'
export type EventSource = 'user' | 'crawler'

export interface Category { id: string; name: string; slug: string; icon: string | null }

export interface EventSummary {
  id: string
  title: string
  coverImage: string | null
  city: string
  district: string
  startAt: string
  isFree: boolean
  capacity: number | null
  categories: Category[]
  registeredCount: number
}

export interface MyRegistration {
  status: 'registered' | 'waitlist'
  waitlistPosition: number | null
}

export interface EventDetail extends EventSummary {
  description: string | null
  organizerName: string | null
  contactInfo: string | null
  feeNote: string | null
  address: string | null
  endAt: string
  registrationDeadline: string | null
  registrationOpen: boolean
  status: EventStatus
  myRegistration: MyRegistration | null
}

export interface DashboardEvent {
  id: string
  title: string
  status: EventStatus
  startAt: string
  capacity: number | null
  registeredCount: number
  waitlistCount: number
}

export interface RegistrationRow {
  userId: string
  displayName: string | null
  email: string | null
  status: 'registered' | 'waitlist'
  partySize: number
  formAnswers: Record<string, string>
  createdAt: string
}

export interface EventFilters {
  city?: string
  district?: string
  categorySlugs?: string[]
  keyword?: string
}

export type NotificationType =
  | 'registered' | 'waitlisted' | 'promoted' | 'moderation_approved' | 'moderation_rejected' | 'starting_soon'

export interface NotificationPayload {
  eventId: string
  eventTitle: string
  reason?: string
}

export interface NotificationItem {
  id: string
  type: NotificationType
  payload: NotificationPayload
  readAt: string | null
  createdAt: string
}

export interface BannerItem {
  eventId: string
  title: string
  city: string
  district: string
  startAt: string
  coverImage?: string | null
  coverPosition?: number
}

export interface HeroSettings {
  title: string
  subtitle: string
  image: string | null
}
