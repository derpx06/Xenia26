export function getContentString(content) {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    const texts = content
        .filter((c) => c.type === "text")
        .map((c) => c.text);
    return texts.join(" ");
}
