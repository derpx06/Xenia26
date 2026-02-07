import { useSearchParams } from "react-router-dom";
import { useCallback, useMemo } from "react";

export function useQueryState(key, options = {}) {
    const [searchParams, setSearchParams] = useSearchParams();

    const value = useMemo(() => {
        const val = searchParams.get(key);
        if (val === null) return options.defaultValue ?? "";
        return val;
    }, [searchParams, key, options.defaultValue]);

    const setValue = useCallback(
        (newValue) => {
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    if (typeof newValue === "function") {
                        const currentVal = next.get(key) ?? options.defaultValue ?? "";
                        const resolvedValue = newValue(currentVal);
                        if (resolvedValue === null || resolvedValue === undefined) {
                            next.delete(key);
                        } else {
                            next.set(key, String(resolvedValue));
                        }
                    } else if (newValue === null || newValue === undefined) {
                        next.delete(key);
                    } else {
                        next.set(key, String(newValue));
                    }
                    return next;
                },
                { replace: true },
            );
        },
        [key, setSearchParams, options.defaultValue],
    );

    return [value, setValue];
}

// Simple parsers for compatibility
export const parseAsBoolean = {
    withDefault: (defaultValue) => ({
        defaultValue,
        parse: (v) => v === "true",
    }),
};
