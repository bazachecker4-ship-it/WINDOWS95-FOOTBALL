import type {
  BlitzModePreference,
  BlitzPace,
  LiveMatchSummary,
  LobbyChatMessage,
  MultiplayerRoomInfo,
  OnlineUserInfo,
  PitchType,
  Position,
  ServerMatchSnapshot,
  Team,
} from "../types/game";

export interface LobbySnapshotState {
  connected: boolean;
  reconnecting: boolean;
  clientId: string;
  onlineUsers: OnlineUserInfo[];
  rooms: MultiplayerRoomInfo[];
  liveMatches: LiveMatchSummary[];
  queueCount: number;
  inQueue: boolean;
  queuePosition: number;
  chatHistory: LobbyChatMessage[];
  waitingRoom: MultiplayerRoomInfo | null;
  lastError: string | null;
}

type LobbyListener = (state: LobbySnapshotState) => void;
type MatchEventListener = (event: {
  type: "match:started" | "match:state" | "spectate:joined" | "mp:error";
  match?: ServerMatchSnapshot;
  yourTeam?: Team;
  message?: string;
}) => void;

const CLIENT_ID_KEY = "blitz95_mp_client_id";

function getOrCreateClientId(): string {
  if (typeof window === "undefined") return `cli-${Date.now()}`;
  const existing = window.sessionStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const created = `cli-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  window.sessionStorage.setItem(CLIENT_ID_KEY, created);
  return created;
}

class MultiplayerClientService {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private profile = { clubName: "ФК Молния 95", managerName: "Тренер" };
  private lobbyListeners = new Set<LobbyListener>();
  private matchListeners = new Set<MatchEventListener>();
  private state: LobbySnapshotState = {
    connected: false,
    reconnecting: false,
    clientId: getOrCreateClientId(),
    onlineUsers: [],
    rooms: [],
    liveMatches: [],
    queueCount: 0,
    inQueue: false,
    queuePosition: 0,
    chatHistory: [],
    waitingRoom: null,
    lastError: null,
  };

  public getClientId(): string {
    return this.state.clientId;
  }

  public getState(): LobbySnapshotState {
    return this.state;
  }

  private emitLobby() {
    for (const listener of this.lobbyListeners) {
      listener(this.state);
    }
  }

  public subscribeLobby(listener: LobbyListener): () => void {
    this.lobbyListeners.add(listener);
    listener(this.state);
    this.ensureConnected();
    return () => {
      this.lobbyListeners.delete(listener);
    };
  }

  public subscribeMatchEvents(listener: MatchEventListener): () => void {
    this.matchListeners.add(listener);
    this.ensureConnected();
    return () => {
      this.matchListeners.delete(listener);
    };
  }

  public updateProfile(clubName: string, managerName: string) {
    this.profile = { clubName, managerName };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: "profile:update", clubName, managerName });
    }
  }

  public ensureConnected() {
    if (typeof window === "undefined") return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${window.location.host}/ws`;

    try {
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        this.state = { ...this.state, connected: true, reconnecting: false, lastError: null };
        this.send({
          type: "hello",
          clientId: this.state.clientId,
          clubName: this.profile.clubName,
          managerName: this.profile.managerName,
        });
        this.emitLobby();
      };

      socket.onmessage = (ev) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
        } catch {
          return;
        }

        const type = String(msg.type || "");
        if (type === "lobby:state") {
          const rooms = (msg.rooms as MultiplayerRoomInfo[]) ?? [];
          const stillWaiting =
            this.state.waitingRoom && rooms.some((r) => r.id === this.state.waitingRoom!.id)
              ? this.state.waitingRoom
              : null;

          this.state = {
            ...this.state,
            onlineUsers: (msg.onlineUsers as OnlineUserInfo[]) ?? [],
            rooms,
            liveMatches: (msg.liveMatches as LiveMatchSummary[]) ?? [],
            queueCount: Number(msg.queueCount ?? 0),
            chatHistory: (msg.chatHistory as LobbyChatMessage[]) ?? this.state.chatHistory,
            waitingRoom: stillWaiting,
          };
          this.emitLobby();
        } else if (type === "chat:message") {
          const chatMsg = msg.message as LobbyChatMessage | undefined;
          if (!chatMsg) return;
          if (this.state.chatHistory.some((m) => m.id === chatMsg.id)) return;
          this.state = {
            ...this.state,
            chatHistory: [...this.state.chatHistory.slice(-79), chatMsg],
          };
          this.emitLobby();
        } else if (type === "room:created") {
          const room = msg.room as MultiplayerRoomInfo;
          this.state = { ...this.state, waitingRoom: room, lastError: null };
          this.emitLobby();
        } else if (type === "queue:status") {
          this.state = {
            ...this.state,
            inQueue: Boolean(msg.inQueue),
            queuePosition: Number(msg.position ?? 0),
          };
          this.emitLobby();
        } else if (type === "mp:error") {
          const message = String(msg.message || "Ошибка сети");
          this.state = { ...this.state, lastError: message };
          this.emitLobby();
          for (const l of this.matchListeners) {
            l({ type: "mp:error", message });
          }
        } else if (type === "match:started" || type === "match:state" || type === "spectate:joined") {
          const match = msg.match as ServerMatchSnapshot;
          if (type === "match:started") {
            this.state = {
              ...this.state,
              inQueue: false,
              queuePosition: 0,
              waitingRoom: null,
              lastError: null,
            };
            this.emitLobby();
          }
          for (const l of this.matchListeners) {
            l({
              type: type as "match:started" | "match:state" | "spectate:joined",
              match,
              yourTeam: msg.yourTeam as Team | undefined,
            });
          }
        }
      };

      socket.onclose = () => {
        this.ws = null;
        this.state = { ...this.state, connected: false, reconnecting: true };
        this.emitLobby();
        if (this.reconnectTimer !== null) {
          window.clearTimeout(this.reconnectTimer);
        }
        this.reconnectTimer = window.setTimeout(() => {
          this.ensureConnected();
        }, 1800);
      };

      socket.onerror = () => {
        // Socket close handler handles reconnect cleanly
      };
    } catch {
      this.state = { ...this.state, connected: false, reconnecting: true };
      this.emitLobby();
    }
  }

  private send(payload: Record<string, unknown>) {
    this.ensureConnected();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public sendChat(text: string) {
    this.send({ type: "chat:send", text });
  }

  public createRoom(params: {
    roomId?: string;
    roomName: string;
    pitchType: PitchType;
    blitzPace: BlitzPace;
    blitzModePref: BlitzModePreference;
    challengeCode?: string;
  }) {
    this.send({ type: "room:create", ...params });
  }

  public cancelRoom(roomId: string) {
    this.state = { ...this.state, waitingRoom: null };
    this.emitLobby();
    this.send({ type: "room:cancel", roomId });
  }

  public joinRoom(roomId: string, challengeCode?: string) {
    this.send({ type: "room:join", roomId, challengeCode });
  }

  public joinQueue(pitchType: PitchType, blitzPace: BlitzPace, blitzModePref: BlitzModePreference) {
    this.send({ type: "queue:join", pitchType, blitzPace, blitzModePref });
  }

  public leaveQueue() {
    this.state = { ...this.state, inQueue: false, queuePosition: 0 };
    this.emitLobby();
    this.send({ type: "queue:leave" });
  }

  public sendMatchAction(
    matchId: string,
    action: {
      actionType: "move" | "pass" | "shoot";
      playerId: string;
      targetPos?: Position;
      targetPlayerId?: string;
      goalRow?: number;
    }
  ) {
    this.send({ type: "match:action", matchId, action });
  }

  public sendBlitzMark(matchId: string, cellIndex: number) {
    this.send({ type: "match:blitz_mark", matchId, cellIndex });
  }

  public resignMatch(matchId: string) {
    this.send({ type: "match:resign", matchId });
  }

  public publishLiveMatch(snapshot: ServerMatchSnapshot) {
    this.send({ type: "live:publish", snapshot });
  }

  public unpublishLiveMatch(matchId: string) {
    this.send({ type: "live:unpublish", matchId });
  }

  public joinSpectate(matchId: string) {
    this.send({ type: "spectate:join", matchId });
  }

  public leaveSpectate(matchId?: string) {
    this.send({ type: "spectate:leave", matchId });
  }

  public sendSpectateReaction(matchId: string, text: string) {
    this.send({ type: "spectate:reaction", matchId, text });
  }
}

export const mpClient = new MultiplayerClientService();
