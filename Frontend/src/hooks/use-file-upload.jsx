import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { fileToContentBlock } from "@/lib/multimodal-utils";

export const SUPPORTED_FILE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
];

export function useFileUpload({
    initialBlocks = [],
} = {}) {
    const [contentBlocks, setContentBlocks] = useState(initialBlocks);
    const dropRef = useRef(null);
    const [dragOver, setDragOver] = useState(false);
    const dragCounter = useRef(0);

    const isDuplicate = (file, blocks) => {
        if (file.type === "application/pdf") {
            return blocks.some(
                (b) =>
                    b.type === "file" &&
                    b.mimeType === "application/pdf" &&
                    b.metadata?.filename === file.name,
            );
        }
        if (SUPPORTED_FILE_TYPES.includes(file.type)) {
            return blocks.some(
                (b) =>
                    b.type === "image" &&
                    b.metadata?.name === file.name &&
                    b.mimeType === file.type,
            );
        }
        return false;
    };

    const handleFileUpload = async (e) => {
        const files = e.target.files;
        if (!files) return;
        const fileArray = Array.from(files);
        const validFiles = fileArray.filter((file) =>
            SUPPORTED_FILE_TYPES.includes(file.type),
        );
        const invalidFiles = fileArray.filter(
            (file) => !SUPPORTED_FILE_TYPES.includes(file.type),
        );
        const duplicateFiles = validFiles.filter((file) =>
            isDuplicate(file, contentBlocks),
        );
        const uniqueFiles = validFiles.filter(
            (file) => !isDuplicate(file, contentBlocks),
        );

        if (invalidFiles.length > 0) {
            toast.error(
                "You have uploaded invalid file type. Please upload a JPEG, PNG, GIF, WEBP image or a PDF.",
            );
        }
        if (duplicateFiles.length > 0) {
            toast.error(
                `Duplicate file(s) detected: ${duplicateFiles.map((f) => f.name).join(", ")}. Each file can only be uploaded once per message.`,
            );
        }

        const newBlocks = uniqueFiles.length
            ? await Promise.all(uniqueFiles.map(fileToContentBlock))
            : [];
        setContentBlocks((prev) => [...prev, ...newBlocks]);
        e.target.value = "";
    };

    // Drag and drop handlers
    useEffect(() => {
        if (!dropRef.current) return;

        const handleWindowDragEnter = (e) => {
            if (e.dataTransfer?.types?.includes("Files")) {
                dragCounter.current += 1;
                setDragOver(true);
            }
        };
        const handleWindowDragLeave = (e) => {
            if (e.dataTransfer?.types?.includes("Files")) {
                dragCounter.current -= 1;
                if (dragCounter.current <= 0) {
                    setDragOver(false);
                    dragCounter.current = 0;
                }
            }
        };
        const handleWindowDrop = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter.current = 0;
            setDragOver(false);

            if (!e.dataTransfer) return;

            const files = Array.from(e.dataTransfer.files);
            const validFiles = files.filter((file) =>
                SUPPORTED_FILE_TYPES.includes(file.type),
            );
            const invalidFiles = files.filter(
                (file) => !SUPPORTED_FILE_TYPES.includes(file.type),
            );
            const duplicateFiles = validFiles.filter((file) =>
                isDuplicate(file, contentBlocks),
            );
            const uniqueFiles = validFiles.filter(
                (file) => !isDuplicate(file, contentBlocks),
            );

            if (invalidFiles.length > 0) {
                toast.error(
                    "You have uploaded invalid file type. Please upload a JPEG, PNG, GIF, WEBP image or a PDF.",
                );
            }
            if (duplicateFiles.length > 0) {
                toast.error(
                    `Duplicate file(s) detected: ${duplicateFiles.map((f) => f.name).join(", ")}. Each file can only be uploaded once per message.`,
                );
            }

            const newBlocks = uniqueFiles.length
                ? await Promise.all(uniqueFiles.map(fileToContentBlock))
                : [];
            setContentBlocks((prev) => [...prev, ...newBlocks]);
        };
        const handleWindowDragEnd = (e) => {
            dragCounter.current = 0;
            setDragOver(false);
        };

        window.addEventListener("dragenter", handleWindowDragEnter);
        window.addEventListener("dragleave", handleWindowDragLeave);
        window.addEventListener("drop", handleWindowDrop);
        window.addEventListener("dragend", handleWindowDragEnd);

        const handleWindowDragOver = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
        window.addEventListener("dragover", handleWindowDragOver);

        const handleDragOver = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
        };
        const handleDragEnter = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
        };
        const handleDragLeave = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
        };

        const element = dropRef.current;
        element.addEventListener("dragover", handleDragOver);
        element.addEventListener("dragenter", handleDragEnter);
        element.addEventListener("dragleave", handleDragLeave);

        return () => {
            element.removeEventListener("dragover", handleDragOver);
            element.removeEventListener("dragenter", handleDragEnter);
            element.removeEventListener("dragleave", handleDragLeave);
            window.removeEventListener("dragenter", handleWindowDragEnter);
            window.removeEventListener("dragleave", handleWindowDragLeave);
            window.removeEventListener("drop", handleWindowDrop);
            window.removeEventListener("dragend", handleWindowDragEnd);
            window.removeEventListener("dragover", handleWindowDragOver);
            dragCounter.current = 0;
        };
    }, [contentBlocks]);

    const removeBlock = (idx) => {
        setContentBlocks((prev) => prev.filter((_, i) => i !== idx));
    };

    const resetBlocks = () => setContentBlocks([]);

    const handlePaste = async (e) => {
        const items = e.clipboardData.items;
        if (!items) return;
        const files = [];
        for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            if (item.kind === "file") {
                const file = item.getAsFile();
                if (file) files.push(file);
            }
        }
        if (files.length === 0) return;

        e.preventDefault();
        const validFiles = files.filter((file) =>
            SUPPORTED_FILE_TYPES.includes(file.type),
        );
        const invalidFiles = files.filter(
            (file) => !SUPPORTED_FILE_TYPES.includes(file.type),
        );

        const duplicateFiles = validFiles.filter((file) => isDuplicate(file, contentBlocks));
        const uniqueFiles = validFiles.filter((file) => !isDuplicate(file, contentBlocks));

        if (invalidFiles.length > 0) {
            toast.error(
                "You have pasted an invalid file type. Please paste a JPEG, PNG, GIF, WEBP image or a PDF.",
            );
        }
        if (duplicateFiles.length > 0) {
            toast.error(
                `Duplicate file(s) detected: ${duplicateFiles.map((f) => f.name).join(", ")}. Each file can only be uploaded once per message.`,
            );
        }
        if (uniqueFiles.length > 0) {
            const newBlocks = await Promise.all(uniqueFiles.map(fileToContentBlock));
            setContentBlocks((prev) => [...prev, ...newBlocks]);
        }
    };

    return {
        contentBlocks,
        setContentBlocks,
        handleFileUpload,
        dropRef,
        removeBlock,
        resetBlocks,
        dragOver,
        handlePaste,
    };
}
