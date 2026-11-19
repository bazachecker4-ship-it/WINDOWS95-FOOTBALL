import React, { useCallback, useEffect, useRef, useState } from "react";
import { Win95CaptionButtons, Win95StatusBar } from "./Win95Chrome";

export type DesktopWindowId =
  | "setup"
  | "profile"
  | "squad"
  | "lobby"
  | "challenge"
  | "coach"
  | "tournaments"
  | "tactics"
  | "stats"
  | "settings"
  | "rules";

export const WINDOW_TASKBAR_LABELS: Record<DesktopWindowId, string> = {
  setup: "WINDOWS 95 FOOTBALL",
  profile: "Профиль клуба",
  squad: "Состав команды",
  lobby: "Онлайн и Эфир",
  challenge: "Вызов QR",
  coach: "Советы тренера",
  tournaments: "Турниры",
  tactics: "Тактика команды",
  stats: "Статистика матча",
  settings: "Настройки",
  rules: "Помощь (HELP.HLP)",
};

export interface StatusPane {
  text: React.ReactNode;
  flex?: boolean;
  className?: string;
}

interface Win95WindowProps {
  title: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
  zIndex: number;
  isActive: boolean;
  isMinimized?: boolean;
  defaultWidth: number;
  defaultHeight: number;
  minWidth?: number;
  minHeight?: number;
  cascadeIndex?: number;
  topBoundary?: number;
  bottomBoundary?: number;
  defaultMaximized?: boolean;
  statusBarPanes?: StatusPane[];
  onFocus: () => void;
  onMinimize?: () => void;
  onClose: () => void;
  children: React.ReactNode;
}

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface WindowRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function computeInitialRect(
  defaultWidth: number,
  defaultHeight: number,
  minWidth: number,
  minHeight: number,
  cascadeIndex: number,
  topBoundary: number,
  bottomBoundary: number
): WindowRect {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const availW = Math.max(260, vw - 16);
  const availH = Math.max(220, vh - topBoundary - bottomBoundary - 12);

  const w = Math.min(defaultWidth, availW);
  const h = Math.min(defaultHeight, availH);

  // Cascade multiple open windows nicely, keeping centered base
  const cascadeX = ((cascadeIndex % 5) - 1) * 24;
  const cascadeY = ((cascadeIndex % 5) - 1) * 22;

  const baseX = Math.max(8, Math.round((vw - w) / 2 + cascadeX));
  const baseY = Math.max(topBoundary + 4, Math.round(topBoundary + (availH - h) / 2 + cascadeY));

  return {
    x: Math.min(Math.max(4, baseX), Math.max(4, vw - Math.min(w, minWidth) - 4)),
    y: Math.min(Math.max(topBoundary, baseY), Math.max(topBoundary, vh - bottomBoundary - 44)),
    w: Math.max(Math.min(minWidth, availW), w),
    h: Math.max(Math.min(minHeight, availH), h),
  };
}

export const Win95Window: React.FC<Win95WindowProps> = ({
  title,
  icon,
  ariaLabel,
  zIndex,
  isActive,
  isMinimized = false,
  defaultWidth,
  defaultHeight,
  minWidth = 300,
  minHeight = 220,
  cascadeIndex = 0,
  topBoundary = 42,
  bottomBoundary = 38,
  defaultMaximized = true,
  statusBarPanes,
  onFocus,
  onMinimize,
  onClose,
  children,
}) => {
  const [isMaximized, setIsMaximized] = useState(defaultMaximized);
  const [rect, setRect] = useState<WindowRect>(() =>
    computeInitialRect(
      defaultWidth,
      defaultHeight,
      minWidth,
      minHeight,
      cascadeIndex,
      topBoundary,
      bottomBoundary
    )
  );

  const dragRef = useRef<{
    type: "move" | ResizeDir;
    startX: number;
    startY: number;
    startRect: WindowRect;
  } | null>(null);

  // Keep window within viewport on device rotation / window resize
  useEffect(() => {
    const clampToViewport = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setRect((prev) => {
        const maxW = Math.max(260, vw - 10);
        const maxH = Math.max(200, vh - topBoundary - bottomBoundary - 6);
        const w = Math.min(prev.w, maxW);
        const h = Math.min(prev.h, maxH);
        const x = Math.min(Math.max(4, prev.x), Math.max(4, vw - w - 4));
        const y = Math.min(Math.max(topBoundary, prev.y), Math.max(topBoundary, vh - bottomBoundary - 40));
        if (w === prev.w && h === prev.h && x === prev.x && y === prev.y) return prev;
        return { x, y, w, h };
      });
    };

    window.addEventListener("resize", clampToViewport);
    window.addEventListener("orientationchange", clampToViewport);
    return () => {
      window.removeEventListener("resize", clampToViewport);
      window.removeEventListener("orientationchange", clampToViewport);
    };
  }, [topBoundary, bottomBoundary]);

  // Global pointer tracking for drag & resize
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const op = dragRef.current;
      if (!op) return;

      const dx = e.clientX - op.startX;
      const dy = e.clientY - op.startY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const effMinW = Math.min(minWidth, vw - 16);
      const effMinH = Math.min(minHeight, vh - topBoundary - bottomBoundary - 16);

      if (op.type === "move") {
        const nextX = Math.min(Math.max(-op.startRect.w + 80, op.startRect.x + dx), vw - 80);
        const nextY = Math.min(
          Math.max(topBoundary, op.startRect.y + dy),
          vh - bottomBoundary - 32
        );
        setRect({ ...op.startRect, x: nextX, y: nextY });
        return;
      }

      let { x, y, w, h } = op.startRect;
      const dir = op.type;

      if (dir.includes("e")) {
        w = Math.min(vw - x - 4, Math.max(effMinW, op.startRect.w + dx));
      }
      if (dir.includes("s")) {
        h = Math.min(vh - bottomBoundary - y - 4, Math.max(effMinH, op.startRect.h + dy));
      }
      if (dir.includes("w")) {
        const maxRight = op.startRect.x + op.startRect.w;
        const proposedX = Math.max(4, Math.min(maxRight - effMinW, op.startRect.x + dx));
        w = maxRight - proposedX;
        x = proposedX;
      }
      if (dir.includes("n")) {
        const maxBottom = op.startRect.y + op.startRect.h;
        const proposedY = Math.max(
          topBoundary,
          Math.min(maxBottom - effMinH, op.startRect.y + dy)
        );
        h = maxBottom - proposedY;
        y = proposedY;
      }

      setRect({ x, y, w, h });
    };

    const handlePointerUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [minWidth, minHeight, topBoundary, bottomBoundary]);

  const startMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-win-btn='true']")) return;
      onFocus();
      if (isMaximized) return;
      e.preventDefault();
      dragRef.current = {
        type: "move",
        startX: e.clientX,
        startY: e.clientY,
        startRect: rect,
      };
    },
    [onFocus, isMaximized, rect]
  );

  const startResize = useCallback(
    (dir: ResizeDir) => (e: React.PointerEvent) => {
      if (isMaximized) return;
      e.stopPropagation();
      e.preventDefault();
      onFocus();
      dragRef.current = {
        type: dir,
        startX: e.clientX,
        startY: e.clientY,
        startRect: rect,
      };
    },
    [isMaximized, onFocus, rect]
  );

  const frameStyle: React.CSSProperties = isMaximized
    ? {
        position: "fixed",
        left: 0,
        top: topBoundary,
        width: "100vw",
        height: `calc(100dvh - ${topBoundary + bottomBoundary}px)`,
        zIndex,
        display: isMinimized ? "none" : "flex",
      }
    : {
        position: "fixed",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        zIndex,
        display: isMinimized ? "none" : "flex",
      };

  return (
    <section
      role="dialog"
      aria-label={ariaLabel || title}
      style={frameStyle}
      onPointerDownCapture={onFocus}
      className="pc-window flex-col p-[3px] select-none overflow-hidden"
    >
      {/* Win95 Title Bar (Drag to move, double-click to maximize/restore) */}
      <div
        onPointerDown={startMove}
        onDoubleClick={() => setIsMaximized((v) => !v)}
        className={`px-2 py-1 flex items-center justify-between gap-2 shrink-0 touch-none ${
          isActive ? "pc-titlebar" : "pc-titlebar-inactive"
        } ${isMaximized ? "cursor-default" : "cursor-move"}`}
      >
        <div className="flex items-center gap-1.5 min-w-0 pointer-events-none">
          {icon}
          <span className="font-display text-xs sm:text-sm font-bold tracking-wide truncate">
            {title}
          </span>
        </div>

        <Win95CaptionButtons
          onMinimize={onMinimize}
          onMaximize={() => setIsMaximized((v) => !v)}
          isMaximized={isMaximized}
          onClose={onClose}
        />
      </div>

      {/* Window Content Body */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#c0c0c0]">
        {children}
      </div>

      {/* Optional Win95 Status Bar with functional bottom-right resize grip */}
      {statusBarPanes && (
        <Win95StatusBar
          panes={statusBarPanes}
          onResizePointerDown={!isMaximized ? startResize("se") : undefined}
          showGrip={!isMaximized}
        />
      )}

      {/* Interactive Edge & Corner Resize Handles (when not maximized) */}
      {!isMaximized && (
        <>
          <div
            onPointerDown={startResize("n")}
            className="absolute top-0 left-2 right-2 h-1.5 cursor-ns-resize touch-none z-20"
            aria-hidden="true"
          />
          <div
            onPointerDown={startResize("s")}
            className="absolute bottom-0 left-2 right-4 h-1.5 cursor-ns-resize touch-none z-20"
            aria-hidden="true"
          />
          <div
            onPointerDown={startResize("w")}
            className="absolute top-2 bottom-2 left-0 w-1.5 cursor-ew-resize touch-none z-20"
            aria-hidden="true"
          />
          <div
            onPointerDown={startResize("e")}
            className="absolute top-2 bottom-4 right-0 w-1.5 cursor-ew-resize touch-none z-20"
            aria-hidden="true"
          />
          <div
            onPointerDown={startResize("nw")}
            className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize touch-none z-30"
            aria-hidden="true"
          />
          <div
            onPointerDown={startResize("ne")}
            className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize touch-none z-30"
            aria-hidden="true"
          />
          <div
            onPointerDown={startResize("sw")}
            className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize touch-none z-30"
            aria-hidden="true"
          />
          <div
            onPointerDown={startResize("se")}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize touch-none z-30"
            aria-hidden="true"
          />
        </>
      )}
    </section>
  );
};
