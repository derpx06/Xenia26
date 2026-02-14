import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function MarkdownRenderer({ children, className = "" }) {
    if (!children) return null;

    return (
        <div className={`markdown-content ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                skipHtml={true}
                components={{
                    // Code blocks
                    code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                            <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                className="rounded-lg my-2 text-sm"
                                customStyle={{
                                    margin: '0.5rem 0',
                                    padding: '1rem',
                                    background: '#1e1e1e',
                                    overflowX: 'auto'
                                }}
                                {...props}
                            >
                                {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                        ) : (
                            <code
                                className="bg-blue-600/20 px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs"
                                {...props}
                            >
                                {children}
                            </code>
                        );
                    },
                    // Headings
                    h1: ({ children }) => (
                        <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2 mb-4 leading-tight">{children}</h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-xl sm:text-2xl font-semibold text-white mt-6 mb-3 leading-snug">{children}</h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-lg font-semibold text-neutral-100 mt-5 mb-2 leading-snug">{children}</h3>
                    ),
                    // Lists
                    ul: ({ children }) => (
                        <ul className="list-disc list-inside space-y-1 my-3 text-neutral-200">{children}</ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-inside space-y-1 my-3 text-neutral-200">{children}</ol>
                    ),
                    li: ({ children }) => (
                        <li className="text-neutral-200 text-sm leading-relaxed mb-1">{children}</li>
                    ),
                    // Links
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-300 hover:text-amber-200 underline underline-offset-2 break-words"
                        >
                            {children}
                        </a>
                    ),
                    // Paragraphs
                    p: ({ children }) => (
                        <p className="text-neutral-100/95 text-[15px] leading-7 my-3">{children}</p>
                    ),
                    // Blockquotes
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-amber-400 pl-3 italic text-neutral-300 my-3 text-sm">
                            {children}
                        </blockquote>
                    ),
                    img: ({ src, alt }) => (
                        <figure className="my-5">
                            <img
                                src={src}
                                alt={alt || "Article visual"}
                                loading="lazy"
                                className="w-full rounded-xl border border-white/10 bg-black/30 object-contain max-h-[420px]"
                            />
                            {alt ? <figcaption className="mt-2 text-xs text-neutral-400">{alt}</figcaption> : null}
                        </figure>
                    ),
                    // Tables
                    table: ({ children }) => (
                        <div className="overflow-x-auto my-3">
                            <table className="min-w-full text-sm border border-white/10">
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-white/5">{children}</thead>
                    ),
                    tbody: ({ children }) => (
                        <tbody className="divide-y divide-white/5">{children}</tbody>
                    ),
                    tr: ({ children }) => <tr>{children}</tr>,
                    th: ({ children }) => (
                        <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-400 uppercase">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="px-3 py-2 text-xs text-neutral-200">{children}</td>
                    ),
                    // Horizontal rule
                    hr: () => <hr className="my-3 border-white/10" />,
                    // Strong/Bold
                    strong: ({ children }) => (
                        <strong className="font-bold text-white">{children}</strong>
                    ),
                    // Emphasis/Italic
                    em: ({ children }) => (
                        <em className="italic text-neutral-200">{children}</em>
                    ),
                }}
            >
                {children}
            </ReactMarkdown>
        </div>
    );
}
