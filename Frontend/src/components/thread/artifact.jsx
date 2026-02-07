import {
    createContext,
    useCallback,
    useContext,
    useLayoutEffect,
    useRef,
    useState,
    useId,
    useEffect,
} from "react";
import { createPortal } from "react-dom";

const ArtifactSlotContext = createContext(null);

/**
 * Headless component that will obtain the title and content of the artifact
 * and render them in place of the `ArtifactContent` and `ArtifactTitle` components via
 * React Portals.
 */
const ArtifactSlot = (props) => {
    const context = useContext(ArtifactSlotContext);
    if (!context) return null;

    const [ctxMounted, ctxSetMounted] = context.mounted;
    const [content] = context.content;
    const [title] = context.title;

    const isMounted = ctxMounted === props.id;
    const isEmpty = props.children == null && props.title == null;

    useEffect(() => {
        if (isEmpty) {
            ctxSetMounted((open) => (open === props.id ? null : open));
        }
    }, [isEmpty, ctxSetMounted, props.id]);

    if (!isMounted) return null;

    return (
        <>
            {title != null ? createPortal(<>{props.title}</>, title) : null}
            {content != null ? createPortal(<>{props.children}</>, content) : null}
        </>
    );
};

export function ArtifactContent(props) {
    const context = useContext(ArtifactSlotContext);
    if (!context) return null;

    const [mounted] = context.mounted;
    const ref = useRef(null);
    const [, setStateRef] = context.content;

    useLayoutEffect(
        () => {
            if (setStateRef) setStateRef(mounted ? ref.current : null);
        },
        [setStateRef, mounted],
    );

    if (!mounted) return null;
    return (
        <div
            {...props}
            ref={ref}
        />
    );
}

export function ArtifactTitle(props) {
    const context = useContext(ArtifactSlotContext);
    if (!context) return null;

    const ref = useRef(null);
    const [, setStateRef] = context.title;

    useLayoutEffect(() => {
        if (setStateRef) setStateRef(ref.current);
    }, [setStateRef]);

    return (
        <div
            {...props}
            ref={ref}
        />
    );
}

export function ArtifactProvider({ children }) {
    const content = useState(null);
    const title = useState(null);

    const open = useState(null);
    const mounted = useState(null);
    const context = useState({});

    return (
        <ArtifactSlotContext.Provider
            value={{ open, mounted, title, content, context }}
        >
            {children}
        </ArtifactSlotContext.Provider>
    );
}

/**
 * Provides a value to be passed into `meta.artifact` field
 * of the `LoadExternalComponent` component, to be consumed by the `useArtifact` hook
 * on the generative UI side.
 */
export function useArtifact() {
    const id = useId();
    const context = useContext(ArtifactSlotContext);
    if (!context) return [null, {}];

    const [ctxOpen, ctxSetOpen] = context.open;
    const [ctxContext, ctxSetContext] = context.context;
    const [, ctxSetMounted] = context.mounted;

    const open = ctxOpen === id;
    const setOpen = useCallback(
        (value) => {
            if (typeof value === "boolean") {
                ctxSetOpen(value ? id : null);
            } else {
                ctxSetOpen((open) => (open === id ? null : id));
            }

            ctxSetMounted(id);
        },
        [ctxSetOpen, ctxSetMounted, id],
    );

    const ArtifactContentComp = useCallback(
        (props) => {
            return (
                <ArtifactSlot
                    id={id}
                    title={props.title}
                >
                    {props.children}
                </ArtifactSlot>
            );
        },
        [id],
    );

    return [
        ArtifactContentComp,
        { open, setOpen, context: ctxContext, setContext: ctxSetContext },
    ];
}

/**
 * General hook for detecting if any artifact is open.
 */
export function useArtifactOpen() {
    const context = useContext(ArtifactSlotContext);
    if (!context) return [false, () => { }];

    const [ctxOpen, setCtxOpen] = context.open;

    const open = ctxOpen !== null;
    const onClose = useCallback(() => setCtxOpen(null), [setCtxOpen]);

    return [open, onClose];
}

/**
 * Artifacts may at their discretion provide additional context
 * that will be used when creating a new run.
 */
export function useArtifactContext() {
    const context = useContext(ArtifactSlotContext);
    if (!context) return [{}, () => { }];
    return context.context;
}
