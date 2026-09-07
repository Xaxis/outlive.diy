/**
 * The mark.
 *
 * Three nodes and the links between them: two filled and joined by a solid
 * line, one hollow with faint links to it. That is a threshold drawn, which is
 * the one idea this whole program is about. Two keys are enough today; the
 * third is the one that is not being used and is the reason the plan survives
 * losing one of the others.
 *
 * It has to work at sixteen pixels, so there is nothing in it but circles and
 * three straight lines, and the faint edges are the only thing that drops out
 * when it gets small.
 */
export function Logo({
  size = 24,
  className,
  title,
}: {
  size?: number
  className?: string
  title?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* The links that are not carrying the quorum today. */}
      <path
        d="M12 6 18.9 17.8M5.4 17.8h13.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.28"
      />
      {/* The two that are. */}
      <path d="M12 6 5.4 17.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="6" r="2.9" fill="currentColor" />
      <circle cx="5.4" cy="17.8" r="2.9" fill="currentColor" />
      <circle cx="18.9" cy="17.8" r="2.3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/**
 * The mark and the name together, which is the only form the name should ever
 * appear in at the top of the page.
 */
export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <Logo size={size} className="text-accent" />
      {/* The name is the first thing that can go when a phone's top row runs
          out of space. The mark alone still says where you are. */}
      <span className="mono hidden text-[0.95rem] font-bold tracking-[-0.03em] text-strong xs:inline">
        outlive<span className="text-accent">.diy</span>
      </span>
    </span>
  )
}
