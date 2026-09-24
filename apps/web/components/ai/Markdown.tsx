import type { ReactNode } from 'react'

/**
 * The little markdown Claude is asked for, rendered as React elements.
 *
 * Paragraphs, "- " bullets, "#" headings and **bold**. Never HTML: an answer
 * is text from outside this program, and nothing from outside is ever put into
 * the page as markup.
 */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length === 0) return
    blocks.push(
      <ul key={`list-${blocks.length}`} className="my-1.5 list-disc space-y-1 pl-5">
        {list.map((item, index) => (
          <li key={index}>{inline(item)}</li>
        ))}
      </ul>
    )
    list = []
  }
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const bullet = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(line)
    if (bullet) {
      list.push(bullet[1])
      continue
    }
    flush()
    if (line.trim() === '') continue
    const heading = /^#{1,4}\s+(.*)$/.exec(line)
    blocks.push(
      heading ? (
        <p key={blocks.length} className="mt-2 font-semibold text-strong">
          {inline(heading[1])}
        </p>
      ) : (
        <p key={blocks.length} className="my-1.5">
          {inline(line)}
        </p>
      )
    )
  }
  flush()
  return <div className="text-[0.875rem] leading-relaxed text-body">{blocks}</div>
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={index} className="font-semibold text-strong">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  )
}
