import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'
export const dynamic = 'force-static'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#08090b',
      }}
    >
      <svg width="126" height="126" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 6 18.9 17.8M5.4 17.8h13.5"
          stroke="#22d3ee"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.3"
        />
        <path d="M12 6 5.4 17.8" stroke="#22d3ee" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="12" cy="6" r="2.9" fill="#22d3ee" />
        <circle cx="5.4" cy="17.8" r="2.9" fill="#22d3ee" />
        <circle cx="18.9" cy="17.8" r="2.3" stroke="#22d3ee" strokeWidth="1.5" />
      </svg>
    </div>,
    size
  )
}
