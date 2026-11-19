import React from "react";

/** Crisp 16x16 Pixel Windows-95 style 4-pane flag icon for the Start button */
export const Win95FlagIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    shapeRendering="crispEdges"
    className={className}
    aria-hidden="true"
  >
    {/* Tail trail pixels */}
    <rect x="1" y="4" width="1" height="2" fill="#000000" />
    <rect x="2" y="3" width="1" height="2" fill="#dc2626" />
    <rect x="1" y="8" width="1" height="2" fill="#000000" />
    <rect x="2" y="9" width="1" height="2" fill="#2563eb" />
    {/* Top-Left Red Pane */}
    <rect x="4" y="2" width="5" height="5" fill="#ef4444" />
    <rect x="4" y="2" width="5" height="1" fill="#000000" />
    <rect x="3" y="3" width="1" height="4" fill="#000000" />
    {/* Top-Right Green Pane */}
    <rect x="10" y="3" width="5" height="5" fill="#22c55e" />
    <rect x="10" y="2" width="5" height="1" fill="#000000" />
    <rect x="15" y="3" width="1" height="5" fill="#000000" />
    {/* Bottom-Left Blue Pane */}
    <rect x="4" y="8" width="5" height="5" fill="#3b82f6" />
    <rect x="3" y="8" width="1" height="5" fill="#000000" />
    <rect x="4" y="13" width="5" height="1" fill="#000000" />
    {/* Bottom-Right Yellow Pane */}
    <rect x="10" y="9" width="5" height="5" fill="#facc15" />
    <rect x="15" y="9" width="1" height="5" fill="#000000" />
    <rect x="10" y="14" width="5" height="1" fill="#000000" />
    {/* Center Cross */}
    <rect x="9" y="2" width="1" height="12" fill="#000000" />
    <rect x="4" y="7" width="11" height="1" fill="#000000" />
  </svg>
);

interface Win95CaptionButtonsProps {
  onMinimize?: () => void;
  onMaximize?: () => void;
  isMaximized?: boolean;
  onClose?: () => void;
  closeLabel?: string;
}

/** Authentic Win95 18x16 titlebar caption buttons: [_] [□] [×] */
export const Win95CaptionButtons: React.FC<Win95CaptionButtonsProps> = ({
  onMinimize,
  onMaximize,
  isMaximized = false,
  onClose,
  closeLabel = "Закрыть окно",
}) => (
  <div className="flex items-center gap-[2px] shrink-0" data-win-btn="true">
    {onMinimize && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMinimize();
        }}
        title="Свернуть"
        aria-label="Свернуть"
        className="pc-btn w-[18px] h-[16px] flex items-end justify-center pb-[2px] cursor-pointer"
      >
        <span className="block w-[7px] h-[2px] bg-black" />
      </button>
    )}
    {onMaximize && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMaximize();
        }}
        title={isMaximized ? "Восстановить размер" : "Развернуть на весь экран"}
        aria-label={isMaximized ? "Восстановить размер" : "Развернуть на весь экран"}
        className="pc-btn w-[18px] h-[16px] flex items-center justify-center cursor-pointer"
      >
        {isMaximized ? (
          <svg viewBox="0 0 10 10" className="w-[10px] h-[10px]" shapeRendering="crispEdges">
            <rect x="3" y="1" width="6" height="5" fill="none" stroke="#000" strokeWidth="1" />
            <line x1="3" y1="2" x2="9" y2="2" stroke="#000" strokeWidth="1" />
            <rect x="1" y="4" width="6" height="5" fill="#c0c0c0" stroke="#000" strokeWidth="1" />
            <line x1="1" y1="5" x2="7" y2="5" stroke="#000" strokeWidth="1" />
          </svg>
        ) : (
          <span className="block w-[9px] h-[8px] border border-black border-t-[2px]" />
        )}
      </button>
    )}
    {onClose && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        title={closeLabel}
        aria-label={closeLabel}
        className="pc-btn w-[18px] h-[16px] flex items-center justify-center cursor-pointer ml-[2px]"
      >
        <svg viewBox="0 0 10 10" className="w-[9px] h-[9px]" shapeRendering="crispEdges">
          <path d="M1 1 L9 9 M9 1 L1 9" stroke="#000000" strokeWidth="1.8" />
        </svg>
      </button>
    )}
  </div>
);

interface Win95StatusBarProps {
  panes: Array<{ text: React.ReactNode; flex?: boolean; className?: string }>;
  onResizePointerDown?: (e: React.PointerEvent) => void;
  showGrip?: boolean;
}

/** Authentic Win95 sunken multi-pane window status bar + interactive diagonal corner grip */
export const Win95StatusBar: React.FC<Win95StatusBarProps> = ({
  panes,
  onResizePointerDown,
  showGrip = true,
}) => (
  <div className="bg-[#c0c0c0] border-t border-[#808080] shadow-[inset_0_1px_0_#ffffff] px-1.5 py-1 flex items-center gap-1 text-[11px] text-black shrink-0 select-none">
    {panes.map((pane, idx) => (
      <div
        key={idx}
        className={`px-2 py-0.5 border-t border-l border-[#808080] border-r border-b border-r-white border-b-white truncate ${
          pane.flex ? "flex-1 min-w-0" : "shrink-0"
        } ${pane.className ?? ""}`}
      >
        {pane.text}
      </div>
    ))}
    {showGrip && (
      <div
        onPointerDown={onResizePointerDown}
        title="Потяните, чтобы изменить размер окна"
        className={`w-4 h-4 shrink-0 ml-0.5 flex items-end justify-end ${
          onResizePointerDown ? "cursor-nwse-resize touch-none" : ""
        }`}
      >
        <svg
          viewBox="0 0 12 12"
          className="w-3 h-3 opacity-85 pointer-events-none"
          shapeRendering="crispEdges"
          aria-hidden="true"
        >
          <path d="M11 2 L2 11 M11 6 L6 11 M11 10 L10 11" stroke="#808080" strokeWidth="1" />
          <path d="M11 3 L3 11 M11 7 L7 11" stroke="#ffffff" strokeWidth="1" />
        </svg>
      </div>
    )}
  </div>
);
