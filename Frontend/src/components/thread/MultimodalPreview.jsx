import React from "react";
import { File, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const MultimodalPreview = ({
    block,
    removable = false,
    onRemove,
    className,
    size = "md",
}) => {
    // Image block
    if (
        block.type === "image" &&
        typeof block.mimeType === "string" &&
        block.mimeType.startsWith("image/")
    ) {
        const url = `data:${block.mimeType};base64,${block.data}`;
        let imgClass = "rounded-xl object-cover h-16 w-16 shadow-lg border border-white/20";
        if (size === "sm") imgClass = "rounded-lg object-cover h-10 w-10 shadow-md";
        if (size === "lg") imgClass = "rounded-2xl object-cover h-32 w-32 shadow-2xl";

        return (
            <div className={cn("relative group", className)}>
                <img
                    src={url}
                    alt={String(block.metadata?.name || "uploaded image")}
                    className={imgClass}
                />
                {removable && (
                    <button
                        type="button"
                        className="absolute -top-2 -right-2 z-10 size-6 rounded-full bg-zinc-900 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        onClick={onRemove}
                        aria-label="Remove image"
                    >
                        <XIcon className="h-3 w-3" />
                    </button>
                )}
            </div>
        );
    }

    // PDF block
    if (block.type === "file" && block.mimeType === "application/pdf") {
        const filename =
            block.metadata?.filename || block.metadata?.name || "PDF file";
        return (
            <div
                className={cn(
                    "relative flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 shadow-sm group transition-all hover:bg-white hover:shadow-md",
                    className,
                )}
            >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <File className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
                </div>
                <div className="flex-1 min-w-0">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">PDF Document</span>
                    <span className="block truncate text-xs font-bold text-zinc-900 leading-none">
                        {String(filename)}
                    </span>
                </div>
                {removable && (
                    <button
                        type="button"
                        className="size-7 rounded-xl bg-zinc-100 text-zinc-400 flex items-center justify-center hover:bg-zinc-200 hover:text-zinc-900 transition-colors opacity-0 group-hover:opacity-100"
                        onClick={onRemove}
                        aria-label="Remove PDF"
                    >
                        <XIcon className="h-4 w-4" />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div
            className={cn(
                "flex items-center gap-2 rounded-xl border bg-zinc-50 px-3 py-2 text-zinc-400",
                className,
            )}
        >
            <File className="h-4 w-4 flex-shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Unsupported</span>
            {removable && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="ml-2"
                >
                    <XIcon className="h-3 w-3" />
                </button>
            )}
        </div>
    );
};
