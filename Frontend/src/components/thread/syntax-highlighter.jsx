import { PrismAsyncLight as SyntaxHighlighterPrism } from "react-syntax-highlighter";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import { coldarkDark } from "react-syntax-highlighter/dist/esm/styles/prism";

// Register languages
SyntaxHighlighterPrism.registerLanguage("js", tsx);
SyntaxHighlighterPrism.registerLanguage("jsx", tsx);
SyntaxHighlighterPrism.registerLanguage("ts", tsx);
SyntaxHighlighterPrism.registerLanguage("tsx", tsx);
SyntaxHighlighterPrism.registerLanguage("python", python);

export const SyntaxHighlighter = ({
    children,
    language,
    className,
}) => {
    return (
        <SyntaxHighlighterPrism
            language={language}
            style={coldarkDark}
            customStyle={{
                margin: 0,
                width: "100%",
                background: "#09090b",
                padding: "1.5rem 1.25rem",
                fontSize: "13px",
                lineHeight: "1.6",
            }}
            className={className}
        >
            {children}
        </SyntaxHighlighterPrism>
    );
};
