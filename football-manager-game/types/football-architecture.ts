export type EventType =
  | "GOAL_SCORED"
  | "PLAYER_INJURED"
  | "MATCH_STARTED"
  | "MATCH_ENDED"
  | "TRANSFER_COMPLETED"
  | "PLAYER_MORALE_CHANGED"
  | "TRAINING_COMPLETED"
  | "BOARD_OBJECTIVE_UPDATED";

export interface GameEvent<TPayload = Record<string, unknown>> {
  id: string;
  type: EventType | string;
  payload: TPayload;
  createdAt: string;
}

export interface MatchState {
  status: "idle" | "live" | "finished" | string;
  matchId: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  week: number;
  minute: number;
  score: [number, number];
  events: GameEvent[];
}

export interface UIState {
  route: string;
  selectedRivalId: string | null;
  tableSort: string;
  tableFilter: string;
  calendarFilter: string;
  reducedMotion: boolean;
  modalStack: string[];
}

export interface AudioState {
  masterVolume: number;
  crowdVolume: number;
  sfxVolume: number;
  musicVolume: number;
  context: "menu" | "match" | string;
  lastCue: string | null;
}

export interface ReplayState {
  enabled: boolean;
  mode: "idle" | "recording" | "playing" | string;
  lastReplayId: string | null;
  highlightQueue: string[];
  maxFrames: number;
}

export interface CareerState {
  status: string;
  reputation: number;
  objectives: unknown[];
  narrativeLog: unknown[];
  relations: { fans: number; players: number; press: number };
}

export interface SimulationState {
  week: number;
  seasonNumber: number;
  pendingJobs: unknown[];
  completedJobs: unknown[];
  lastRunAt: string | null;
}

export interface SeparatedRootState {
  gameState: Record<string, unknown>;
  matchState: MatchState;
  uiState: UIState;
  audioState: AudioState;
  replayState: ReplayState;
  careerState: CareerState;
  simulationState: SimulationState;
}

export type ComponentName =
  | "Position"
  | "Velocity"
  | "Team"
  | "Stamina"
  | "Input"
  | "AIState"
  | "AnimationState"
  | "PhysicsState"
  | "TacticalRole"
  | "Morale"
  | "Fatigue";

export interface System {
  name: string;
  components: ComponentName[];
  update(world: unknown, dt: number, context: Record<string, unknown>): void;
}
