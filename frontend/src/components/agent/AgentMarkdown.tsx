import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

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
      className="underline underline-offset-2 text-primary hover:opacity-80"
    >
      {children}
    </a>
  ),
}

interface AgentMarkdownProps {
  content: string
}

export function AgentMarkdown({ content }: AgentMarkdownProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  )
}
