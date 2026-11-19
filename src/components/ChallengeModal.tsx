import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Loader2, QrCode, Share2, Swords, Wifi, WifiOff, XCircle } from "lucide-react";
import { Win95Window } from "./Win95Window";
import { LobbySnapshotState, mpClient } from "../services/multiplayerClient";
import { BlitzPace, PitchType } from "../types/game";

interface ChallengeModalProps {
  clubName: string;
  pitchType?: PitchType;
  blitzPace?: BlitzPace;
  zIndex: number;
  isActive: boolean;
  isMinimized?: boolean;
  cascadeIndex?: number;
  topBoundary?: number;
  onFocus: () => void;
  onMinimize?: () => void;
  onAcceptChallenge?: (opponentClubOrRoom: string, challengeCode?: string) => void;
  onClose: () => void;
}

export const ChallengeModal: React.FC<ChallengeModalProps> = ({
  clubName,
  pitchType = "turf",
  blitzPace = "blitz",
  zIndex,
  isActive,
  isMinimized,
  cascadeIndex = 3,
  topBoundary = 40,
  onFocus,
  onMinimize,
  onAcceptChallenge,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [lobbyState, setLobbyState] = useState<LobbySnapshotState>(() => mpClient.getState());
  const [roomCode] = useState(() => Math.random().toString(36).slice(2, 8).toUpperCase());
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    return mpClient.subscribeLobby((next) => setLobbyState(next));
  }, []);

  const activeWaitingRoom = lobbyState.waitingRoom;
  const activeRoomId = activeWaitingRoom?.id ?? `chal-${roomCode}`;
  const activeChallengeCode = activeWaitingRoom?.challengeCode ?? roomCode;

  const challengeUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(
          activeRoomId
        )}&challenge=${encodeURIComponent(activeChallengeCode)}&club=${encodeURIComponent(clubName)}`
      : `?room=${encodeURIComponent(activeRoomId)}&challenge=${encodeURIComponent(activeChallengeCode)}`;

  useEffect(() => {
    if (!qrCanvasRef.current) return;
    QRCode.toCanvas(
      qrCanvasRef.current,
      challengeUrl,
      {
        width: 148,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
        errorCorrectionLevel: "M",
      },
      () => {}
    );
  }, [challengeUrl]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(challengeUrl).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  const handleCreateChallengeRoom = () => {
    mpClient.createRoom({
      roomId: `chal-${roomCode}`,
      roomName: `Дуэль: ${clubName}`,
      pitchType,
      blitzPace,
      blitzModePref: "dynamic",
      challengeCode: roomCode,
    });
  };

  const handleJoinByInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = inviteInput.trim();
    if (!raw) return;

    let roomId = "";
    let code = "";
    let clubOrToken = raw;

    try {
      const url = new URL(raw);
      roomId = url.searchParams.get("room") || "";
      code = url.searchParams.get("challenge") || "";
      clubOrToken = url.searchParams.get("club") || code || roomId || raw;
    } catch {
      const roomMatch = raw.match(/room=([^&]+)/i);
      const chalMatch = raw.match(/challenge=([^&]+)/i);
      if (roomMatch) roomId = decodeURIComponent(roomMatch[1]);
      if (chalMatch) code = decodeURIComponent(chalMatch[1]);
      if (!roomId && !code && /^[A-Z0-9-]{4,16}$/i.test(raw)) {
        code = raw.toUpperCase();
        roomId = raw.startsWith("chal-") || raw.startsWith("room-") ? raw : `chal-${raw.toUpperCase()}`;
      }
    }

    if (roomId || code) {
      mpClient.joinRoom(roomId || `chal-${code}`, code || undefined);
      if (onAcceptChallenge) {
        onAcceptChallenge(clubOrToken, code || roomId);
      }
      return;
    }

    if (onAcceptChallenge) {
      onAcceptChallenge(raw);
    }
  };

  return (
    <Win95Window
      title="CHALLENGE_95.EXE — Вызов на PvP матч"
      icon={<Share2 className="w-3.5 h-3.5 text-sky-200 shrink-0" />}
      ariaLabel="Пригласить соперника по ссылке или QR"
      zIndex={zIndex}
      isActive={isActive}
      isMinimized={isMinimized}
      cascadeIndex={cascadeIndex}
      topBoundary={topBoundary}
      defaultWidth={500}
      defaultHeight={580}
      minWidth={310}
      minHeight={380}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      statusBarPanes={[
        { text: `Клуб: ${clubName}`, flex: true },
        { text: lobbyState.connected ? "WS: ONLINE" : "WS: ОФЛАЙН" },
        { text: copied ? "Скопировано" : `Код: ${activeChallengeCode}` },
      ]}
    >
      <div className="p-3 space-y-3 text-xs text-black overflow-y-auto flex-1">
        <fieldset className="win95-groupbox space-y-2.5 text-center">
          <legend>Приглашение друга по QR-коду, ссылке или коду</legend>
          <p className="text-[11px] text-slate-900 leading-snug">
            Откройте реальную комнату ожидания для клуба{" "}
            <strong className="text-[#000080]">«{clubName}»</strong> и отправьте ссылку или QR-код сопернику — матч 11×11 запустится автоматически при входе друга!
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {!activeWaitingRoom ? (
              <button
                type="button"
                onClick={handleCreateChallengeRoom}
                disabled={!lobbyState.connected}
                className={`px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 ${
                  lobbyState.connected
                    ? "pc-btn-primary cursor-pointer"
                    : "pc-btn opacity-50 cursor-not-allowed"
                }`}
              >
                {lobbyState.connected ? (
                  <Wifi className="w-3.5 h-3.5" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5" />
                )}
                <span>Открыть комнату вызова ({roomCode})</span>
              </button>
            ) : (
              <div className="w-full pc-inset-dark px-3 py-2 flex items-center justify-between gap-2 text-left">
                <div className="flex items-center gap-2 text-emerald-300 min-w-0">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <div className="truncate">
                    <div className="font-bold text-xs truncate">
                      Комната «{activeWaitingRoom.name}» активна!
                    </div>
                    <div className="text-[10px] text-slate-300">
                      Ожидание соперника по коду: {activeChallengeCode}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => mpClient.cancelRoom(activeWaitingRoom.id)}
                  className="pc-btn px-2.5 py-1 text-[11px] font-bold text-red-800 flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Отменить</span>
                </button>
              </div>
            )}
          </div>

          {/* Real Scannable QR Code inside sunken Win95 Frame */}
          <div className="inline-flex flex-col items-center p-2 pc-field mx-auto">
            <canvas
              ref={qrCanvasRef}
              width={148}
              height={148}
              style={{ imageRendering: "pixelated" }}
              className="block w-36 h-36"
            />
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#000080]">
              <QrCode className="w-3 h-3" />
              <span>КОД ВЫЗОВА: {activeChallengeCode}</span>
            </span>
          </div>

          {/* Shareable URL Field */}
          <div className="text-left space-y-1">
            <label className="block text-[11px] font-bold text-black">
              Прямая ссылка для друга:
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                readOnly
                value={challengeUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="pc-field flex-1 px-2 py-1.5 text-[11px] font-mono focus:outline-none truncate"
              />
              <button
                type="button"
                onClick={handleCopy}
                className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  copied ? "pc-btn-primary" : "pc-btn"
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Скопировано" : "Копировать"}</span>
              </button>
            </div>
          </div>
        </fieldset>

        <fieldset className="win95-groupbox">
          <legend>Принять вызов по ссылке или коду</legend>
          <form onSubmit={handleJoinByInvite} className="flex items-center gap-1.5">
            <input
              type="text"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              placeholder="Вставьте ссылку ?room=... или 6-значный код..."
              className="pc-field flex-1 px-2 py-1.5 text-xs focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inviteInput.trim()}
              className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1 shrink-0 ${
                inviteInput.trim()
                  ? "pc-btn-primary cursor-pointer"
                  : "pc-btn opacity-50 cursor-not-allowed"
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>В бой!</span>
            </button>
          </form>
        </fieldset>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="pc-btn px-6 py-1.5 text-xs font-bold cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </Win95Window>
  );
};
