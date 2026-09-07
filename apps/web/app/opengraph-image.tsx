import { ImageResponse } from 'next/og'

export const alt = 'outlive.diy: design a Bitcoin custody plan, then find out where it breaks.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const dynamic = 'force-static'

/**
 * The share card, rendered once at build time into a static PNG.
 *
 * Nothing about it is fetched: no remote font, no remote image. It is the same
 * mark and the same sentence the page opens with, because a share card that
 * promises something the page does not say is a share card that has started
 * marketing.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#08090b',
        padding: '72px 80px',
        fontFamily: 'sans-serif',
        color: '#d5d9e0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none">
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
        <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
          <span style={{ color: '#f2f4f8' }}>outlive</span>
          <span style={{ color: '#22d3ee' }}>.diy</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div
          style={{
            display: 'flex',
            fontSize: 62,
            lineHeight: 1.1,
            fontWeight: 600,
            letterSpacing: -2,
            color: '#f2f4f8',
            maxWidth: 900,
          }}
        >
          Design a Bitcoin custody plan, then find out where it breaks.
        </div>
        <div style={{ display: 'flex', fontSize: 27, color: '#8e96a3', maxWidth: 880 }}>
          Local only. No network calls. It will not accept a seed word, a key or an address.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 40, height: 3, background: '#22d3ee' }} />
        <div style={{ display: 'flex', fontSize: 22, color: '#626a77' }}>
          A custody plan has to work when the person who made it is not available.
        </div>
      </div>
    </div>,
    size
  )
}
