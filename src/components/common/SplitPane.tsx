import { useEffect, useRef, useState } from "react";

type SplitPaneProps = {
    top: React.ReactNode;
    bottom: React.ReactNode;
    minTop?: number;
    minBottom?: number;
    initialRatio?: number;
    gap?: number;
    handleHeight?: number;
    topScrollable?: boolean;
    topPaddingRight?: number;
    handleStyle?: React.CSSProperties;
};

export default function SplitPane({
    top,
    bottom,
    minTop = 240,
    minBottom = 240,
    initialRatio = 0.6,
    gap = 16,
    handleHeight = 8,
    topScrollable = true,
    topPaddingRight = 4,
    handleStyle,
}: SplitPaneProps) {
    const [ratio, setRatio] = useState(initialRatio);
    const [isDragging, setIsDragging] = useState(false);
    const [containerHeight, setContainerHeight] = useState(0);
    const [topContentHeight, setTopContentHeight] = useState(0);
    const [hasUserResized, setHasUserResized] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const topContentRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isDragging) return undefined;

        const handleMove = (event: MouseEvent) => {
            const container = containerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const y = event.clientY - rect.top;
            const available = rect.height - handleHeight - gap * 2;
            if (available <= 0) return;
            const maxTop = Math.max(minTop, available - minBottom);
            const clampedTop = Math.min(maxTop, Math.max(minTop, y - gap));
            setRatio(clampedTop / available);
        };

        const handleUp = () => setIsDragging(false);

        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);
        return () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleUp);
        };
    }, [gap, handleHeight, isDragging, minBottom, minTop]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) setContainerHeight(entry.contentRect.height);
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const node = topContentRef.current;
        if (!node) return undefined;
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) setTopContentHeight(entry.contentRect.height);
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    const availableHeight = Math.max(0, containerHeight - handleHeight - gap * 2);
    const topHeight = availableHeight
        ? Math.min(Math.max(minTop, Math.round(ratio * availableHeight)), Math.max(minTop, availableHeight - minBottom))
        : minTop;

    useEffect(() => {
        if (hasUserResized) return;
        if (!availableHeight) return;
        if (!topContentHeight) return;
        const maxTop = Math.max(minTop, availableHeight - minBottom);
        const desired = Math.min(maxTop, Math.max(minTop, topContentHeight));
        setRatio(desired / availableHeight);
    }, [availableHeight, hasUserResized, minBottom, minTop, topContentHeight]);

    return (
        <div
            ref={containerRef}
            style={{
                display: "flex",
                flexDirection: "column",
                gap,
                height: "100%",
            }}
        >
            <div
                style={{
                    flex: `0 0 ${topHeight}px`,
                    maxHeight: `${topHeight}px`,
                    minHeight: minTop,
                    overflow: topScrollable ? "auto" : "hidden",
                    paddingRight: topPaddingRight,
                }}
            >
                <div ref={topContentRef}>{top}</div>
            </div>

            <div
                role="separator"
                aria-orientation="horizontal"
                onMouseDown={(event) => {
                    event.preventDefault();
                    setHasUserResized(true);
                    setIsDragging(true);
                }}
                style={{
                    height: handleHeight,
                    cursor: "row-resize",
                    borderRadius: 6,
                    background: "rgba(0, 0, 0, 0.06)",
                    ...handleStyle,
                }}
            />

            <div style={{ flex: "1 1 0", minHeight: minBottom, overflow: "hidden" }}>{bottom}</div>
        </div>
    );
}
