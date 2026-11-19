import React, { useEffect, useRef, useState } from "react";
import {
  BlitzModePreference,
  BlitzPace,
  LiveMatchSummary,
  PITCH_META,
  PitchType,
} from "../types/game";
import { LobbySnapshotState, mpClient } from "../services/multiplayerClient";
import {
  Bot,
  Eye,
  Globe,
  Loader2,
  MessageSquare,
  Play,
  PlusCircle,
  Radio,
  Search,
  Send,
  Share2,
  Swords,
  Tv,
  Users,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { Win95Window } from "./Win95Window";

export type LiveMatch = LiveMatchSummary;

interface MultiplayerLobbyModalProps {
  clubName: string;
  managerName: string;
  zIndex: number;
  isActive: boolean;
  isMinimized?: boolean;
  cascadeIndex?: number;
  topBoundary?: number;
  onFocus: () => void;
  onMinimize?: () => void;
  onStartVsAiMatch?: (pitchType: PitchType, pace: BlitzPace) => void;
  onSpectateMatch: (match: LiveMatchSummary) => void;
  onStartLocalAiDerby?: (pitchType: PitchType, pace: BlitzPace) => void;
  onOpenChallenge?: () => void;
  onClose: () => void;
}

const STREAM_KIND_LABEL: Record<LiveMatchSummary["kind"], { text: string; badgeClass: string }> = {
  pvp: { text: "PvP ОНЛАЙН", badgeClass: "bg-red-700 text-white" },
  human_ai: { text: "ИГРОК vs ИИ", badgeClass: "bg-[#000080] text-amber-300" },
  ai_league: { text: "ИИ-ЛИГА PRO", badgeClass: "bg-emerald-800 text-emerald-200" },
};

export const MultiplayerLobbyModal: React.FC<MultiplayerLobbyModalProps> = ({
  clubName,
  managerName,
  zIndex,
  isActive,
  isMinimized,
  cascadeIndex = 1,
  topBoundary = 40,
  onFocus,
  onMinimize,
  onStartVsAiMatch,
  onSpectateMatch,
  onStartLocalAiDerby,
  onOpenChallenge,
  onClose,
}) => {
  const [tab, setTab] = useState<"rooms" | "matchmaking" | "spectate" | "chat">("spectate");
  const [streamFilter, setStreamFilter] = useState<"all" | "pvp" | "human_ai" | "ai_league">("all");
  const [roomNameInput, setRoomNameInput] = useState(`${clubName} — Матч 95`);
  const [selectedPitch, setSelectedPitch] = useState<PitchType>("turf");
  const [selectedPace, setSelectedPace] = useState<BlitzPace>("blitz");
  const [selectedBlitzPref, setSelectedBlitzPref] = useState<BlitzModePreference>("dynamic");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [chatInput, setChatInput] = useState("");
  const [lobbyState, setLobbyState] = useState<LobbySnapshotState>(() => mpClient.getState());

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mpClient.updateProfile(clubName, managerName);
    return mpClient.subscribeLobby((next) => {
      setLobbyState(next);
    });
  }, [clubName, managerName]);

  useEffect(() => {
    if (tab === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [tab, lobbyState.chatHistory.length]);

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    mpClient.sendChat(trimmed);
    setChatInput("");
  };

  const handleCreateRoom = () => {
    mpClient.createRoom({
      roomName: roomNameInput.trim() || `${clubName} — Матч 95`,
      pitchType: selectedPitch,
      blitzPace: selectedPace,
      blitzModePref: selectedBlitzPref,
    });
  };

  const filteredLiveMatches = lobbyState.liveMatches.filter(
    (m) => streamFilter === "all" || m.kind === streamFilter
  );

  return (
    <Win95Window
      title="NET_LOBBY_95.EXE — Сеть, Поиск Игры и Эфир"
      icon={<Globe className="w-3.5 h-3.5 text-sky-200 shrink-0" />}
      ariaLabel="Сетевое лобби и наблюдение"
      zIndex={zIndex}
      isActive={isActive}
      isMinimized={isMinimized}
      cascadeIndex={cascadeIndex}
      topBoundary={topBoundary}
      defaultWidth={720}
      defaultHeight={590}
      minWidth={320}
      minHeight={380}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      statusBarPanes={[
        {
          text: lobbyState.connected
            ? `Сервер: ONLINE (WS) · В сети: ${lobbyState.onlineUsers.length}`
            : lobbyState.reconnecting
            ? "Переподключение к серверу..."
            : "Подключение к серверу...",
          flex: true,
        },
        { text: `Клуб: ${clubName}` },
        { text: `Матчей LIVE: ${lobbyState.liveMatches.length}` },
      ]}
    >
      {/* Classic Win95 Property Sheet Tabs */}
      <div className="px-2.5 pt-2 bg-[#c0c0c0] flex items-end gap-0.5 border-b border-white shrink-0 overflow-x-auto">
        <button
          type="button"
          onClick={() => setTab("spectate")}
          className={`px-3 py-1.5 text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            tab === "spectate" ? "win95-tab-active" : "win95-tab"
          }`}
        >
          <Eye className="w-3.5 h-3.5 text-red-700" />
          <span>Прямой эфир ({lobbyState.liveMatches.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab("rooms")}
          className={`px-3 py-1.5 text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            tab === "rooms" ? "win95-tab-active" : "win95-tab"
          }`}
        >
          <Users className="w-3.5 h-3.5 text-[#000080]" />
          <span>Комнаты PvP ({lobbyState.rooms.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab("matchmaking")}
          className={`px-3 py-1.5 text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            tab === "matchmaking" ? "win95-tab-active" : "win95-tab"
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-emerald-700" />
          <span>
            Поиск игры{lobbyState.inQueue ? " ●" : ""}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("chat")}
          className={`px-3 py-1.5 text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            tab === "chat" ? "win95-tab-active" : "win95-tab"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-purple-800" />
          <span>Чат ({lobbyState.chatHistory.length})</span>
        </button>
      </div>

      {/* Property Sheet Body */}
      <div className="p-3 overflow-y-auto space-y-3 flex-1 bg-[#c0c0c0] text-black text-xs">
        {/* Connection / Error Banner */}
        {lobbyState.lastError && (
          <div className="pc-inset-dark px-3 py-1.5 text-xs text-amber-300 flex items-center justify-between gap-2">
            <span>! {lobbyState.lastError}</span>
          </div>
        )}

        {/* TAB 1: LIVE SPECTATOR TV */}
        {tab === "spectate" && (
          <div className="space-y-3">
            <fieldset className="win95-groupbox space-y-2.5">
              <legend>Прямые трансляции на 2.5D поле (Spectator TV)</legend>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 flex-wrap">
                  {(
                    [
                      { id: "all", label: `Все (${lobbyState.liveMatches.length})` },
                      {
                        id: "pvp",
                        label: `PvP (${lobbyState.liveMatches.filter((m) => m.kind === "pvp").length})`,
                      },
                      {
                        id: "human_ai",
                        label: `Игрок vs ИИ (${lobbyState.liveMatches.filter((m) => m.kind === "human_ai").length})`,
                      },
                      {
                        id: "ai_league",
                        label: `ИИ-Лига (${lobbyState.liveMatches.filter((m) => m.kind === "ai_league").length})`,
                      },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setStreamFilter(f.id)}
                      className={`px-2 py-1 text-[11px] font-bold cursor-pointer ${
                        streamFilter === f.id ? "pc-btn-active" : "pc-btn"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {onStartLocalAiDerby && (
                  <button
                    type="button"
                    onClick={() => onStartLocalAiDerby(selectedPitch, selectedPace)}
                    className="pc-btn px-2.5 py-1 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Tv className="w-3.5 h-3.5 text-[#000080]" />
                    <span>Свое ИИ-Дерби</span>
                  </button>
                )}
              </div>

              <div className="pc-field p-1.5 space-y-1.5">
                {filteredLiveMatches.length === 0 ? (
                  <div className="py-6 text-center text-slate-600 text-xs">
                    {lobbyState.connected
                      ? "В этой категории пока нет активных трансляций."
                      : "Загружаем список прямых эфиров с сервера..."}
                  </div>
                ) : (
                  filteredLiveMatches.map((m) => {
                    const kindMeta = STREAM_KIND_LABEL[m.kind];
                    return (
                      <div
                        key={m.id}
                        className="pc-inset p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-1.5 py-0.5 font-mono text-[10px] font-bold ${kindMeta.badgeClass}`}
                            >
                              {kindMeta.text}
                            </span>
                            {m.status === "blitz" && (
                              <span className="px-1.5 py-0.5 bg-amber-400 text-black border border-black font-mono text-[10px] font-bold">
                                БЛИЦ-ДУЭЛЬ!
                              </span>
                            )}
                            <span className="font-bold text-[#000080] truncate">
                              {m.roomName}
                            </span>
                          </div>

                          <div className="font-bold text-xs text-black flex items-center gap-1.5 flex-wrap">
                            <span className="text-blue-900">{m.hostName}</span>
                            <span className="pc-inset-dark px-2 py-0.5 font-mono text-emerald-300">
                              {m.scoreBlue}:{m.scoreRed}
                            </span>
                            <span className="text-red-900">{m.guestName}</span>
                          </div>

                          <div className="text-[11px] text-slate-700 flex flex-wrap items-center gap-x-2">
                            <span>
                              Ход {m.turn}/{m.maxTurns}
                            </span>
                            <span>·</span>
                            <span>{PITCH_META[m.pitchType].name}</span>
                            <span>·</span>
                            <span>
                              Владение: {m.possessionBluePct}% / {100 - m.possessionBluePct}%
                            </span>
                            <span>·</span>
                            <span className="font-bold text-[#000080]">
                              Зрителей: {m.viewers}
                            </span>
                          </div>

                          {m.latestEvent && (
                            <div className="text-[10px] text-slate-600 truncate italic">
                              &gt; {m.latestEvent}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => onSpectateMatch(m)}
                          className="pc-btn-primary px-3.5 py-1.5 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Смотреть LIVE</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </fieldset>
          </div>
        )}

        {/* TAB 2: MULTIPLAYER ROOMS (Real WebSocket Rooms) */}
        {tab === "rooms" && (
          <div className="space-y-3">
            {lobbyState.waitingRoom ? (
              <fieldset className="win95-groupbox space-y-2.5">
                <legend>Ваша активная комната ожидания</legend>
                <div className="pc-inset-dark p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 text-emerald-300 min-w-0">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span className="truncate">{lobbyState.waitingRoom.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Поле: {PITCH_META[lobbyState.waitingRoom.pitchType].name} · Ждём подключения второго игрока...
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {onOpenChallenge && (
                      <button
                        type="button"
                        onClick={onOpenChallenge}
                        className="pc-btn px-3 py-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5 text-[#000080]" />
                        <span>Ссылка / QR</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => mpClient.cancelRoom(lobbyState.waitingRoom!.id)}
                      className="pc-btn px-3 py-1.5 text-xs font-bold text-red-800 flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Отмена</span>
                    </button>
                  </div>
                </div>
              </fieldset>
            ) : (
              <fieldset className="win95-groupbox space-y-2.5">
                <legend>Создать новую PvP комнату на сервере</legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block font-bold mb-1 text-[11px]">Название комнаты:</label>
                    <input
                      type="text"
                      value={roomNameInput}
                      onChange={(e) => setRoomNameInput(e.target.value)}
                      className="pc-field w-full px-2 py-1.5 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1 text-[11px]">Покрытие поля:</label>
                    <select
                      value={selectedPitch}
                      onChange={(e) => setSelectedPitch(e.target.value as PitchType)}
                      className="pc-field w-full px-2 py-1.5 text-xs focus:outline-none"
                    >
                      <option value="turf">Газон 32×32</option>
                      <option value="ice">Скользкий лёд</option>
                      <option value="sand">Песчаный пляж</option>
                      <option value="obstacles">Полигон с барьерами</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-1 flex-wrap">
                    {(["turbo", "blitz", "relaxed"] as BlitzPace[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSelectedPace(p)}
                        className={`px-2 py-1 text-[11px] font-bold cursor-pointer ${
                          selectedPace === p ? "pc-btn-active" : "pc-btn"
                        }`}
                      >
                        {p === "turbo" ? "Турбо 2.2с" : p === "blitz" ? "Блиц 3.5с" : "Без таймера"}
                      </button>
                    ))}
                    <select
                      value={selectedBlitzPref}
                      onChange={(e) => setSelectedBlitzPref(e.target.value as BlitzModePreference)}
                      className="pc-field px-2 py-1 text-[11px] font-bold focus:outline-none"
                    >
                      <option value="dynamic">Блиц: по ситуации</option>
                      <option value="classic">3×3 Классика</option>
                      <option value="decay">3×3 След</option>
                      <option value="blocked">4×4 Блоки</option>
                      <option value="grand">5×5 Штрафная</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onOpenChallenge && (
                      <button
                        type="button"
                        onClick={onOpenChallenge}
                        className="pc-btn px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5 text-[#000080]" />
                        <span>Вызов / QR</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!lobbyState.connected}
                      onClick={handleCreateRoom}
                      className={`px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 ${
                        lobbyState.connected
                          ? "pc-btn-primary cursor-pointer"
                          : "pc-btn opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Создать комнату</span>
                    </button>
                  </div>
                </div>
              </fieldset>
            )}

            <fieldset className="win95-groupbox space-y-2">
              <legend>Открытые серверные комнаты ({lobbyState.rooms.length})</legend>
              <div className="pc-field p-1 space-y-0.5 min-h-[120px]">
                {lobbyState.rooms.length === 0 ? (
                  <div className="py-6 text-center text-slate-600 text-xs">
                    Нет открытых комнат ожидания — создайте свою комнату или пригласите друга по QR/ссылке!
                  </div>
                ) : (
                  lobbyState.rooms.map((room) => {
                    const isOwn = room.hostClientId === lobbyState.clientId;
                    const isSel = selectedRoomId === room.id;
                    return (
                      <div
                        key={room.id}
                        onClick={() => setSelectedRoomId(room.id)}
                        className={`px-2.5 py-2 flex items-center justify-between gap-2 cursor-pointer ${
                          isSel ? "bg-[#000080] text-white" : "hover:bg-slate-200 text-black"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate">
                            {room.name} {isOwn ? "(Ваша комната)" : ""}
                          </div>
                          <div
                            className={`text-[11px] truncate ${
                              isSel ? "text-sky-200" : "text-slate-600"
                            }`}
                          >
                            Хост: {room.hostClub} ({room.hostName}) · Поле:{" "}
                            {PITCH_META[room.pitchType].name} · 1/2
                          </div>
                        </div>

                        {isOwn ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              mpClient.cancelRoom(room.id);
                            }}
                            className="pc-btn px-3 py-1 text-xs font-bold text-red-800 cursor-pointer shrink-0"
                          >
                            Закрыть
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              mpClient.joinRoom(room.id);
                            }}
                            className="pc-btn-primary px-3 py-1 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Play className="w-3 h-3" />
                            <span>Войти</span>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </fieldset>
          </div>
        )}

        {/* TAB 3: REAL SERVER MATCHMAKING QUEUE */}
        {tab === "matchmaking" && (
          <fieldset className="win95-groupbox py-5 px-4 text-center space-y-4">
            <legend>Серверный подбор соперника (Ranked PvP 11×11)</legend>

            <div className="w-14 h-14 mx-auto pc-inset flex items-center justify-center">
              <Radio
                className={`w-7 h-7 text-[#000080] ${lobbyState.inQueue ? "animate-spin" : ""}`}
              />
            </div>

            <div className="space-y-1 max-w-md mx-auto">
              <div className="font-display text-lg font-bold text-[#000080]">
                {lobbyState.inQueue
                  ? "Поиск живого соперника на сервере..."
                  : `Клуб «${clubName}» готов к Ranked PvP`}
              </div>
              <p className="text-[11px] text-slate-800">
                {lobbyState.inQueue
                  ? `В очереди сейчас: ${lobbyState.queueCount} игрок(ов). Как только подключится второй игрок, матч 11×11 начнётся мгновенно!`
                  : `Игроков онлайн: ${lobbyState.onlineUsers.length} · В очереди: ${lobbyState.queueCount}. Нажмите «Встать в очередь» или пригласите друга по QR.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {!lobbyState.inQueue ? (
                <button
                  type="button"
                  disabled={!lobbyState.connected}
                  onClick={() => mpClient.joinQueue(selectedPitch, selectedPace, selectedBlitzPref)}
                  className={`px-5 py-2 text-xs font-bold flex items-center gap-1.5 ${
                    lobbyState.connected
                      ? "pc-btn-primary cursor-pointer"
                      : "pc-btn opacity-50 cursor-not-allowed"
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span>Встать в очередь PvP</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => mpClient.leaveQueue()}
                  className="pc-btn px-5 py-2 text-xs font-bold text-red-800 cursor-pointer"
                >
                  Покинуть очередь
                </button>
              )}

              {onOpenChallenge && (
                <button
                  type="button"
                  onClick={onOpenChallenge}
                  className="pc-btn px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Swords className="w-3.5 h-3.5 text-[#000080]" />
                  <span>Позвать друга (QR)</span>
                </button>
              )}

              {onStartVsAiMatch && (
                <button
                  type="button"
                  onClick={() => onStartVsAiMatch(selectedPitch, selectedPace)}
                  className="pc-btn px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Сыграть против ИИ-Агента</span>
                </button>
              )}
            </div>
          </fieldset>
        )}

        {/* TAB 4: REAL WEBSOCKET MIRC LOBBY CHAT + ONLINE CLUBS */}
        {tab === "chat" && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 h-[335px]">
            <div className="md:col-span-3 flex flex-col space-y-2 h-full min-h-0">
              <div className="pc-field flex-1 p-2 overflow-y-auto space-y-1.5 font-mono text-[11px]">
                {lobbyState.chatHistory.map((msg) => (
                  <div key={msg.id} className="leading-snug">
                    <span className="text-slate-500">[{msg.time}] </span>
                    {msg.isSystem ? (
                      <span className="font-bold text-emerald-800">* {msg.text}</span>
                    ) : (
                      <>
                        <span
                          className={`font-bold ${
                            msg.sender === managerName && msg.clubName === clubName
                              ? "text-[#000080]"
                              : "text-red-800"
                          }`}
                        >
                          &lt;{msg.sender}
                          {msg.clubName ? ` (${msg.clubName})` : ""}&gt;
                        </span>{" "}
                        <span className="text-black">{msg.text}</span>
                      </>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 shrink-0">
                {["GL HF!", "Кто в комнату на 11×11?", "Жду в PvP!", "Красивый гол!"].map(
                  (phrase) => (
                    <button
                      key={phrase}
                      type="button"
                      onClick={() => setChatInput(phrase)}
                      className="pc-btn px-2 py-0.5 text-[10px] font-bold whitespace-nowrap cursor-pointer"
                    >
                      {phrase}
                    </button>
                  )
                )}
              </div>

              <form onSubmit={handleSendChat} className="flex items-center gap-1.5 shrink-0">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Написать сообщение игрокам онлайн..."
                  className="pc-field flex-1 px-2.5 py-1.5 text-xs focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!lobbyState.connected}
                  className="pc-btn-primary px-4 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Отправить</span>
                </button>
              </form>
            </div>

            {/* Online Clubs Roster */}
            <div className="hidden md:flex flex-col pc-inset p-1.5 space-y-1 min-h-0">
              <div className="px-1 py-0.5 bg-[#000080] text-white text-[10px] font-bold flex items-center justify-between">
                <span>ОНЛАЙН ({lobbyState.onlineUsers.length})</span>
                {lobbyState.connected ? (
                  <Wifi className="w-3 h-3 text-emerald-300" />
                ) : (
                  <WifiOff className="w-3 h-3 text-red-300" />
                )}
              </div>
              <div className="pc-field flex-1 p-1 overflow-y-auto space-y-1 text-[11px]">
                {lobbyState.onlineUsers.map((u) => (
                  <div key={u.clientId} className="truncate leading-tight px-1 py-0.5">
                    <span className="text-emerald-700 font-bold">● </span>
                    <span className="font-bold text-black">{u.clubName}</span>
                    <div className="text-[10px] text-slate-600 pl-3 truncate">{u.managerName}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="pc-btn px-5 py-1.5 text-xs font-bold cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </Win95Window>
  );
};
