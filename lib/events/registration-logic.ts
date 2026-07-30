export type FieldSetting = 'off' | 'optional' | 'required'
export interface RegistrationFieldConfig {
  party_size?: FieldSetting
  phone?: FieldSetting
  note?: FieldSetting
}
export interface RegistrationField {
  key: 'party_size' | 'phone' | 'note'
  label: string
  required: boolean
}

const LABELS: Record<RegistrationField['key'], string> = {
  party_size: '同行人數',
  phone: '聯絡電話',
  note: '備註',
}
const ORDER: RegistrationField['key'][] = ['party_size', 'phone', 'note']

export function parseRegistrationFields(config: RegistrationFieldConfig): RegistrationField[] {
  return ORDER.flatMap((key) => {
    const setting = config[key]
    if (setting !== 'optional' && setting !== 'required') return []
    return [{ key, label: LABELS[key], required: setting === 'required' }]
  })
}
