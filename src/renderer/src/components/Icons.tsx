import type { SVGProps } from 'react'

/** Small inline icon set (24px grid, 2px strokes). No icon font, no network. */

type Props = SVGProps<SVGSVGElement> & { size?: number | string }

function base({ size = '1em', ...rest }: Props, children: React.ReactNode, filled = false): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`icon ${rest.className ?? ''}`}
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconHome = (p: Props): JSX.Element =>
  base(p, <path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z" />)

export const IconGrid = (p: Props): JSX.Element =>
  base(
    p,
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.6" />
      <rect x="14" y="3" width="7" height="7" rx="1.6" />
      <rect x="3" y="14" width="7" height="7" rx="1.6" />
      <rect x="14" y="14" width="7" height="7" rx="1.6" />
    </>
  )

export const IconDice = (p: Props): JSX.Element =>
  base(
    p,
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  )

const STAR = 'M12 2.5l2.94 6.05 6.66.92-4.85 4.66 1.2 6.62L12 17.6l-5.95 3.15 1.2-6.62L2.4 9.47l6.66-.92z'
export const IconStar = (p: Props): JSX.Element => base(p, <path d={STAR} />)
export const IconStarFilled = (p: Props): JSX.Element => base(p, <path d={STAR} />, true)

export const IconGear = (p: Props): JSX.Element =>
  base(
    p,
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  )

export const IconPlus = (p: Props): JSX.Element => base(p, <path d="M12 5v14M5 12h14" />)
export const IconPlay = (p: Props): JSX.Element => base(p, <path d="M7 4.5v15l12-7.5z" />, true)
export const IconSearch = (p: Props): JSX.Element =>
  base(
    p,
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  )
export const IconX = (p: Props): JSX.Element => base(p, <path d="M18 6L6 18M6 6l12 12" />)
export const IconChevronRight = (p: Props): JSX.Element => base(p, <path d="M9 18l6-6-6-6" />)
export const IconArrowLeft = (p: Props): JSX.Element => base(p, <path d="M19 12H5M12 19l-7-7 7-7" />)
export const IconEdit = (p: Props): JSX.Element =>
  base(p, <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />)
export const IconTrash = (p: Props): JSX.Element =>
  base(p, <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />)
export const IconCheck = (p: Props): JSX.Element => base(p, <path d="M20 6L9 17l-5-5" />)
export const IconInfo = (p: Props): JSX.Element =>
  base(
    p,
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  )
export const IconAlert = (p: Props): JSX.Element =>
  base(
    p,
    <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />
  )
export const IconUpload = (p: Props): JSX.Element =>
  base(p, <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />)
export const IconClock = (p: Props): JSX.Element =>
  base(
    p,
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  )
export const IconSliders = (p: Props): JSX.Element =>
  base(p, <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />)
export const IconRefresh = (p: Props): JSX.Element =>
  base(p, <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />)
export const IconFolder = (p: Props): JSX.Element =>
  base(p, <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />)
export const IconShield = (p: Props): JSX.Element =>
  base(p, <path d="M12 2l8 3.5v6c0 5-3.4 8.6-8 10.5-4.6-1.9-8-5.5-8-10.5v-6z" />)
export const IconMore = (p: Props): JSX.Element =>
  base(
    p,
    <>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  )
export const IconExternal = (p: Props): JSX.Element =>
  base(p, <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />)
export const IconHeartbeat = (p: Props): JSX.Element =>
  base(p, <path d="M3 12h4l2-5 4 10 2-5h6" />)
export const IconArchive = (p: Props): JSX.Element =>
  base(p, <path d="M3 4h18v4H3zM5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />)
export const IconTag = (p: Props): JSX.Element =>
  base(
    p,
    <>
      <path d="M3 12V4h8l9 9-8 8z" />
      <circle cx="7.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
    </>
  )

/** The rocket used for the app icon, as the brand mark. */
export const IconRocket = (p: Props): JSX.Element =>
  base(
    { strokeWidth: 1.8, ...p },
    <>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </>
  )
