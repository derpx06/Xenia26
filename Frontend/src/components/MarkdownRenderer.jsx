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
                                className="rounded-lg my-4 text-sm shadow-lg border border-white/5"
                                customStyle={{
                                    margin: '1.5rem 0',
                                    padding: '1.25rem',
                                    background: '#1a1a1a',
                                    overflowX: 'auto',
                                    borderRadius: '0.75rem'
                                }}
                                {...props}
                            >
                                {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                        ) : (
                            <code
                                className="bg-white/10 px-1.5 py-0.5 rounded text-amber-200 font-mono text-sm"
                                {...props}
                            >
                                {children}
                            </code>
                        );
                    },
                    // Headings
                    h1: ({ children }) => (
                        <h1 className="text-3xl sm:text-4xl font-bold text-white mt-8 mb-6 leading-tight tracking-tight border-b border-white/10 pb-4">{children}</h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-2xl sm:text-3xl font-semibold text-white mt-10 mb-5 leading-snug tracking-tight">{children}</h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-xl sm:text-2xl font-semibold text-neutral-100 mt-8 mb-4 leading-snug">{children}</h3>
                    ),
                    h4: ({ children }) => (
                        <h4 className="text-lg font-semibold text-neutral-200 mt-6 mb-3 leading-snug">{children}</h4>
                    ),
                    // Lists
                    ul: ({ children }) => (
                        <ul className="list-disc list-outside ml-6 space-y-2 my-4 text-neutral-300 marker:text-amber-400/70">{children}</ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-outside ml-6 space-y-2 my-4 text-neutral-300 marker:text-amber-400/70">{children}</ol>
                    ),
                    li: ({ children }) => (
                        <li className="pl-2 text-neutral-200 text-[15px] sm:text-base leading-relaxed">{children}</li>
                    ),
                    // Links
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-400 hover:text-amber-300 underline underline-offset-4 decoration-white/20 hover:decoration-amber-300 transition-all font-medium break-words"
                        >
                            {children}
                        </a>
                    ),
                    // Paragraphs
                    p: ({ children }) => (
                        <p className="text-neutral-200 text-[15px] sm:text-base leading-8 my-4 font-normal">{children}</p>
                    ),
                    // Blockquotes
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-amber-500/50 pl-6 py-2 my-8 italic text-neutral-300 bg-white/5 rounded-r-lg">
                            {children}
                        </blockquote>
                    ),
                    img: ({ src, alt }) => (
                        <figure className="my-8 group">
                            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                                <img
                                    src={src}
                                    alt={alt || "Article visual"}
                                    loading="lazy"
                                    className="w-full h-auto object-cover max-h-[500px] transition-transform duration-700 group-hover:scale-[1.02]"
                                />
                            </div>
                            {alt ? <figcaption className="mt-3 text-center text-sm text-neutral-500 italic">{alt}</figcaption> : null}
                        </figure>
                    ),
                    // Tables
                    table: ({ children }) => (
                        <div className="overflow-x-auto my-8 rounded-lg border border-white/10 shadow-sm">
                            <table className="min-w-full text-sm divide-y divide-white/10">
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-white/10">{children}</thead>
                    ),
                    tbody: ({ children }) => (
                        <tbody className="divide-y divide-white/5 bg-white/5">{children}</tbody>
                    ),
                    tr: ({ children }) => <tr className="hover:bg-white/5 transition-colors">{children}</tr>,
                    th: ({ children }) => (
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="px-4 py-3 text-sm text-neutral-300 whitespace-nowrap">{children}</td>
                    ),
                    // Horizontal rule
                    hr: () => <hr className="my-8 border-white/10" />,
                    // Strong/Bold
                    strong: ({ children }) => (
                        <strong className="font-semibold text-white">{children}</strong>
                    ),
                    // Emphasis/Italic
                    em: ({ children }) => (
                        <em className="italic text-neutral-300">{children}</em>
                    ),
                }}
            >
                {children}
            </ReactMarkdown>
        </div>
    );
}
