import type { SourceType } from '../../api/citations'
import type { Mood } from '../../api/journal'

export interface IconProps {
  size?: number
  strokeWidth?: number
  className?: string
  style?: React.CSSProperties
}

interface SvgProps extends IconProps {
  children: React.ReactNode
  fill?: string
  stroke?: string
}

function Svg({ size = 17, strokeWidth = 1.6, fill = 'none', stroke = 'currentColor', children, className, style }: SvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {children}
    </svg>
  )
}

export function IconDashboard(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9.5h12V10" />
    </Svg>
  )
}

export function IconProjects(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="5" width="15" height="15" rx="1.5" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="13" y2="14" />
    </Svg>
  )
}

export function IconJournal(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 4.5h11.5A2.5 2.5 0 0 1 19 7v13H7.5A2.5 2.5 0 0 1 5 17.5z" />
      <line x1="8.5" y1="9" x2="15" y2="9" />
      <line x1="8.5" y1="12.5" x2="15" y2="12.5" />
    </Svg>
  )
}

export function IconFinances(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <path d="M9.5 14c0 1.1 1.1 2 2.5 2s2.5-.7 2.5-1.8-1.1-1.6-2.5-1.9-2.5-.8-2.5-1.9S10.6 8.7 12 8.7s2.2.6 2.4 1.5" />
    </Svg>
  )
}

export function IconRoutines(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <polyline points="8.5,12.3 11,14.8 15.7,9.5" />
    </Svg>
  )
}

export function IconReading(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 6.5c-1.6-1-4-1.4-6-1V17c2 0 4.3.4 6 1.4" />
      <path d="M12 6.5c1.6-1 4-1.4 6-1V17c-2 0-4.3.4-6 1.4" />
      <line x1="12" y1="6.5" x2="12" y2="18.4" />
    </Svg>
  )
}

export function IconCitations(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="7" width="6" height="6" rx="1.5" />
      <rect x="13" y="7" width="6" height="6" rx="1.5" />
      <path d="M7 13v1.2c0 1.1-.7 2-1.8 2.3" />
      <path d="M16 13v1.2c0 1.1-.7 2-1.8 2.3" />
    </Svg>
  )
}

export function IconArt(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4 16l4.5-4.5 3 3L16 9l4 4.5" />
    </Svg>
  )
}

export function IconFile(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 4.5h7l4 4V19a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1z" />
      <path d="M14 4.5V9h4.5" />
    </Svg>
  )
}

export function IconVideo(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="6" width="13" height="12" rx="1.5" />
      <path d="M16.5 10.5l4-2.5v8l-4-2.5z" />
    </Svg>
  )
}

export function IconAudio(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10v4h3.5l4 3.5v-11l-4 3.5z" />
      <path d="M15 9.5a4 4 0 0 1 0 5" />
      <path d="M17.5 7.5a7.5 7.5 0 0 1 0 9" />
    </Svg>
  )
}

export function IconSettings(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="12" cy="12" r="7.8" strokeDasharray="2.4 2.6" />
    </Svg>
  )
}

export function IconLogout(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 8V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
      <line x1="21" y1="12" x2="10.5" y2="12" />
      <polyline points="17.5,8.5 21,12 17.5,15.5" />
    </Svg>
  )
}

export function IconSun(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1.5" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22.5" />
      <line x1="4.2" y1="4.2" x2="6" y2="6" />
      <line x1="18" y1="18" x2="19.8" y2="19.8" />
      <line x1="1.5" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22.5" y2="12" />
      <line x1="4.2" y1="19.8" x2="6" y2="18" />
      <line x1="18" y1="6" x2="19.8" y2="4.2" />
    </Svg>
  )
}

export function IconMoon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </Svg>
  )
}

export function IconHamburger(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </Svg>
  )
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </Svg>
  )
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.3" y1="15.3" x2="21" y2="21" />
    </Svg>
  )
}

export function IconSort(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="12" y1="4" x2="12" y2="20" />
      <polyline points="6,14 12,20 18,14" />
      <polyline points="6,10 12,4 18,10" />
    </Svg>
  )
}

export function IconGrid(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </Svg>
  )
}

export function IconList(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </Svg>
  )
}

export function IconStar(props: IconProps & { filled?: boolean }) {
  const { filled, ...rest } = props
  return (
    <Svg {...rest} fill={filled ? 'currentColor' : 'none'}>
      <polygon points="12,3 14.7,9.3 21.5,9.9 16.3,14.4 17.9,21 12,17.4 6.1,21 7.7,14.4 2.5,9.9 9.3,9.3" />
    </Svg>
  )
}

export function IconChevronLeft(props: IconProps) {
  return (
    <Svg {...props} strokeWidth={props.strokeWidth ?? 1.8}>
      <polyline points="15,5 8,12 15,19" />
    </Svg>
  )
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <polyline points="9,5 16,12 9,19" />
    </Svg>
  )
}

export function IconEdit(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15.5 5.5 18.5 8.5 8 19H5v-3z" />
    </Svg>
  )
}

export function IconRedo(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12a8 8 0 0 1 13.6-5.7L20 8" />
      <polyline points="20,3 20,8 15,8" />
      <path d="M20 12a8 8 0 0 1-13.6 5.7L4 16" />
      <polyline points="4,21 4,16 9,16" />
    </Svg>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="5" y1="7" x2="19" y2="7" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M7 7l1 12.5A1.5 1.5 0 0 0 9.5 21h5a1.5 1.5 0 0 0 1.5-1.5L17 7" />
    </Svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props} strokeWidth={props.strokeWidth ?? 2.4}>
      <polyline points="4,12.5 9.5,18 20,6" />
    </Svg>
  )
}

export function IconDownload(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v11" />
      <polyline points="7.5,11 12,15.5 16.5,11" />
      <line x1="5" y1="19.5" x2="19" y2="19.5" />
    </Svg>
  )
}

export function IconUpload(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 15V4" />
      <polyline points="7.5,8.5 12,4 16.5,8.5" />
      <line x1="5" y1="19.5" x2="19" y2="19.5" />
    </Svg>
  )
}

export function IconMore(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <circle cx="6" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="18" cy="12" r="1.3" />
    </Svg>
  )
}

export function IconLink(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 15 15 9" />
      <path d="M10.5 6.5 12 5a4 4 0 0 1 5.7 5.6l-1.6 1.6" />
      <path d="M13.5 17.5 12 19a4 4 0 0 1-5.7-5.6l1.6-1.6" />
    </Svg>
  )
}

export function IconArticle(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="1.5" />
      <rect x="7" y="7" width="4" height="4" rx="0.5" />
      <line x1="13" y1="8" x2="17" y2="8" />
      <line x1="13" y1="10.5" x2="17" y2="10.5" />
      <line x1="7" y1="14" x2="17" y2="14" />
      <line x1="7" y1="16.5" x2="17" y2="16.5" />
    </Svg>
  )
}

export function IconGlobe(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <path d="M12 4c2.5 2.2 4 5 4 8s-1.5 5.8-4 8c-2.5-2.2-4-5-4-8s1.5-5.8 4-8z" />
    </Svg>
  )
}

export function IconMic(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9.5" y="3.5" width="5" height="10" rx="2.5" />
      <path d="M6 11a6 6 0 0 0 12 0" />
      <line x1="12" y1="17" x2="12" y2="20.5" />
      <line x1="8.5" y1="20.5" x2="15.5" y2="20.5" />
    </Svg>
  )
}

export function IconFilm(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="9" width="16" height="11" rx="1.5" />
      <path d="M4 9l2-4h3l-2 4z" />
      <path d="M9.5 9l2-4h3l-2 4z" />
      <path d="M15 9l2-4h3l-2 4z" />
    </Svg>
  )
}

export function IconTv(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="6" width="17" height="12" rx="1.5" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="18" x2="12" y2="21" />
    </Svg>
  )
}

export function IconPerson(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5" />
    </Svg>
  )
}

export function IconChat(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5V13a2.5 2.5 0 0 1-2.5 2.5H9.5L5 19v-3.6A2.5 2.5 0 0 1 4.5 13z" />
    </Svg>
  )
}

export function IconPin(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s7-7.5 7-12.5A7 7 0 0 0 5 8.5C5 13.5 12 21 12 21z" />
      <circle cx="12" cy="8.5" r="2.3" />
    </Svg>
  )
}

export function IconBarChart(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="5" y1="20" x2="19" y2="20" />
      <rect x="6" y="14" width="3" height="6" rx="0.5" />
      <rect x="10.5" y="9" width="3" height="11" rx="0.5" />
      <rect x="15" y="5" width="3" height="15" rx="0.5" />
    </Svg>
  )
}

export function IconFlame(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21a5.5 5.5 0 0 1-5.5-5.5c0-3 2-4.5 2.8-6.8.4-1.1.2-2.2-.3-3.2 2 .3 3.5 1.8 4 3.5.3-1 .2-2 0-3 2.5 1.5 4 4.5 4 7.5A5.5 5.5 0 0 1 12 21z" />
    </Svg>
  )
}

export function IconExpand(props: IconProps) {
  return (
    <Svg {...props}>
      <polyline points="4,9 4,4 9,4" />
      <polyline points="15,4 20,4 20,9" />
      <polyline points="20,15 20,20 15,20" />
      <polyline points="9,20 4,20 4,15" />
    </Svg>
  )
}

export function IconMoodExcellent(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <path d="M8 14.3c1.2 2 2.5 3 4 3s2.8-1 4-3" />
    </Svg>
  )
}

export function IconMoodGood(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <path d="M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8" />
    </Svg>
  )
}

export function IconMoodNeutral(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <line x1="8.5" y1="15" x2="15.5" y2="15" />
    </Svg>
  )
}

export function IconMoodBad(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="9" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      <path d="M8.5 16.3c1-1.2 2.2-1.8 3.5-1.8s2.5.6 3.5 1.8" />
    </Svg>
  )
}

export function IconMoodVeryBad(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="9" cy="11" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11" r="0.9" fill="currentColor" stroke="none" />
      <line x1="7.3" y1="8.7" x2="9.8" y2="9.6" />
      <line x1="16.7" y1="8.7" x2="14.2" y2="9.6" />
      <path d="M8 17c1.2-2 2.5-3 4-3s2.8 1 4 3" />
    </Svg>
  )
}

/** Icon mapping keyed by the backend module `slug` (see /api/modules). */
export const MODULE_ICONS: Record<string, (props: IconProps) => JSX.Element> = {
  dashboard: IconDashboard,
  projects: IconProjects,
  journal: IconJournal,
  finances: IconFinances,
  routines: IconRoutines,
  reading: IconReading,
  citations: IconCitations,
  art: IconArt,
}

/** Icon mapping keyed by citation `SourceType` (see api/citations.ts). */
export const SOURCE_TYPE_ICONS: Record<SourceType, (props: IconProps) => JSX.Element> = {
  BOOK: IconReading,
  ARTWORK: IconArt,
  ARTICLE: IconArticle,
  INTERNET: IconGlobe,
  PODCAST: IconMic,
  FILM: IconFilm,
  SERIES: IconTv,
  VIDEO: IconVideo,
  PERSON: IconPerson,
  OTHER: IconChat,
}

/** Icon mapping keyed by journal entry `Mood` (see api/journal.ts). */
export const MOOD_ICONS: Record<Mood, (props: IconProps) => JSX.Element> = {
  EXCELLENT: IconMoodExcellent,
  GOOD: IconMoodGood,
  NEUTRAL: IconMoodNeutral,
  BAD: IconMoodBad,
  VERY_BAD: IconMoodVeryBad,
}
