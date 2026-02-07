import React from "react";
import { MultimodalPreview } from "./MultimodalPreview";
import { cn } from "@/lib/utils";

export const ContentBlocksPreview = ({
    blocks,
    onRemove,
    size = "md",
    className,
}) => {
    if (!blocks.length) return null;
    return (
        <div className={cn("flex flex-wrap gap-3 px-6 pt-4", className)}>
            {blocks.map((block, idx) => (
                <MultimodalPreview
                    key={idx}
                    block={block}
                    removable
                    onRemove={() => onRemove(idx)}
                    size={size}
                    className="animate-in zoom-in-90 duration-300"
                />
            ))}
        </div>
    );
};
