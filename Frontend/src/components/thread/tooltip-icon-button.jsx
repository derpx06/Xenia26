import { forwardRef } from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const TooltipIconButton = forwardRef(({ children, tooltip, side = "bottom", className, ...rest }, ref) => {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        {...rest}
                        className={cn("size-8 p-1.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all", className)}
                        ref={ref}
                    >
                        {children}
                        <span className="sr-only">{tooltip}</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent side={side} className="bg-zinc-900 text-white border-zinc-800 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-xl">
                    {tooltip}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
});

TooltipIconButton.displayName = "TooltipIconButton";
