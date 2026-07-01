import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

type SourceItem = {
  title: string
  url: string
}

const components: Components = {
  h1: ({ children }) => <p className="text-sm font-medium">{children}</p>,
  h2: ({ children }) => <p className="text-sm font-medium">{children}</p>,
  h3: ({ children }) => <p className="text-sm font-medium">{children}</p>,

  p: ({ children }) => (
    <p className="text-sm leading-relaxed [&:not(:last-child)]:mb-1.5">{children}</p>
  ),

  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),

  em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,

  ul: ({ children }) => (
    <ul className="my-1.5 ml-3 list-none space-y-0.5 text-sm">{children}</ul>
  ),

  ol: ({ children }) => (
    <ol className="my-1.5 ml-3 list-decimal space-y-0.5 text-sm">{children}</ol>
  ),

  li: ({ children }) => (
    <li className="flex items-start gap-1.5">
      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-current opacity-60" />
      <span>{children}</span>
    </li>
  ),

  hr: () => null,

  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
  ),

  pre: ({ children }) => <div className="text-sm text-muted-foreground">{children}</div>,

  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline underline-offset-2 hover:text-blue-700 hover:underline"
    >
      {children}
    </a>
  ),
}

function truncateUrl(url: string) {
  try {
    const { hostname, pathname } = new URL(url)
    const path = pathname.length > 20 ? `${pathname.slice(0, 20)}...` : pathname
    return `${hostname}${path}`
  } catch {
    return url.length > 40 ? `${url.slice(0, 40)}...` : url
  }
}

function parseSourceSection(content: string): { body: string; sources: SourceItem[] } {
  const lines = content.split('\n')
  const headerIndex = lines.findIndex((line) => line.trim() === '출처')

  if (headerIndex === -1) {
    return { body: content, sources: [] }
  }

  const body = lines.slice(0, headerIndex).join('\n').trimEnd()
  const sourceLines = lines.slice(headerIndex + 1)
  const sources: SourceItem[] = []

  for (let i = 0; i < sourceLines.length; i += 1) {
    const line = sourceLines[i].trim()
    if (!line || !line.startsWith('-')) continue

    const title = line.replace(/^[-*]\s*/, '').trim()
    if (!title) continue

    const nextLine = sourceLines[i + 1]?.trim() ?? ''
    const inlineLink = nextLine.match(/^\[[^\]]+\]\((https?:\/\/[^)]+)\)$/)
    const url = inlineLink?.[1] ?? (nextLine.startsWith('http') ? nextLine : '')

    if (url) {
      sources.push({ title, url })
      if (nextLine) i += 1
      continue
    }

    sources.push({ title, url: '' })
  }

  return {
    body,
    sources,
  }
}

function SourceSection({ sources }: { sources: SourceItem[] }) {
  if (!sources.length) return null

  return (
    <div className="bg-gray-50 rounded-md p-2 mt-2">
      <div className="flex flex-col gap-2">
        {sources.map((source, index) => (
          <div key={`${source.title}-${index}`} className="flex flex-col gap-1">
            <p className="text-xs font-medium text-gray-600">{source.title}</p>
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-blue-600 underline hover:text-blue-700"
              >
                {truncateUrl(source.url)}
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

interface AgentMarkdownProps {
  content: string
}

export function AgentMarkdown({ content }: AgentMarkdownProps) {
  const { body, sources } = parseSourceSection(content)

  return (
    <div>
      {body ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {body}
        </ReactMarkdown>
      ) : null}
      <SourceSection sources={sources} />
    </div>
  )
}
