import type { Game, UpdateApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import { render } from "./presentation";
export const BACKGROUND = "#090f19";
export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";

export type Mode = "solo" | "versus";

export type Side = "left" | "right";

export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}

export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}

export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}

export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
}

export interface CaromState {
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";

  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;

  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;

  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];

  readonly simTime: number;
  readonly muted: boolean;
  /** Pending menu press regions; discarded when a contact lifts. */
  readonly menuContacts: Readonly<Record<number, number>>;
}

type State = DeepReadonly<CaromState>;
export interface MenuRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Snapshot = Omit<CaromState, "ball" | "menuContacts"> & {
  version: number;
  ball: (BallState & { speed: number }) | null;
};
export interface CaromDebugApi {
  readonly version: number;
  snapshot(s: State): Snapshot;
  menuItemRect(s: State, index: number): MenuRect | null;
  clearWorld(s: State): CaromState;
  spawnBall(s: State): CaromState;
  spawnObstacle(s: State, index: number): CaromState;
  reset(s: State): CaromState;
  reconcile(s: State): CaromState;
  setScreen(s: State, screen: Screen): CaromState;
  setMode(s: State, mode: Mode): CaromState;
  setMenuIndex(s: State, index: number): CaromState;
  setTitleIndex(s: State, index: number): CaromState;
  setResumeScreen(s: State, screen: "countdown" | "playing"): CaromState;
  setScore(s: State, p1: number, p2: number): CaromState;
  setWinner(s: State, side: Side | null): CaromState;
  setReceiver(s: State, side: Side): CaromState;
  setPaddleCy(s: State, side: Side, cy: number): CaromState;
  setPaddleVy(s: State, side: Side, vy: number): CaromState;
  setPaddleDriven(s: State, side: Side, driven: boolean): CaromState;
  setBallPosition(s: State, x: number, y: number): CaromState;
  setBallVelocity(s: State, vx: number, vy: number): CaromState;
  setBallSpin(s: State, spin: number): CaromState;
  setBallHeld(s: State, held: boolean): CaromState;
  setBallHoldTimer(s: State, seconds: number): CaromState;
  setBallServeSign(s: State, sign: 1 | -1): CaromState;
  drawBallServeSign(s: State): CaromState;
  setAiTracking(s: State, enabled: boolean): CaromState;
  setAiMovement(s: State, enabled: boolean): CaromState;
  setMuted(s: State, muted: boolean): CaromState;
}
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
const sign = (): 1 | -1 => (Math.random() < 0.5 ? -1 : 1);
const parked = (): BallState => ({
  x: C.FIELD_CX,
  y: C.FIELD_CY,
  vx: 0,
  vy: 0,
  spin: 0,
  held: true,
  holdTimer: C.HOLD_TIME,
  serveSign: sign(),
  trail: [],
});
const paddle = (): PaddleState => ({
  cy: C.FIELD_CY,
  vy: 0,
  driven: false,
  drivenVy: 0,
});
const obstacle = (index: number): ObstacleState => {
  const c = C.OBSTACLE_CENTERS[index];
  if (!c) throw new RangeError("Unknown obstacle");
  return { index, cx: c.x, cy: c.y };
};
export const initial = (muted = false): CaromState => ({
  screen: "title",
  mode: "solo",
  menuIndex: 0,
  titleIndex: 0,
  resumeScreen: "playing",
  score: { p1: 0, p2: 0 },
  winner: null,
  paddles: { left: paddle(), right: paddle() },
  ai: { tracking: true, movement: true },
  receiver: "left",
  ball: parked(),
  obstacles: C.OBSTACLE_CENTERS.map((_, i) => obstacle(i)),
  simTime: 0,
  muted,
  menuContacts: {},
});
export function items(s: State): readonly string[] {
  switch (s.screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "matchover":
      return C.MATCHOVER_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    default:
      return [];
  }
}
export function menuItemRect(s: State, index: number): MenuRect | null {
  if (!items(s)[index]) return null;
  return {
    x: 440,
    y: (s.screen === "howto" ? 574 : 350) + index * 68,
    w: 400,
    h: 54,
  };
}
function ballPose(s: State, patch: Partial<BallState>): CaromState {
  if (!s.ball) throw new Error("No ball on the field");
  return { ...s, ball: { ...s.ball, ...patch } };
}
function paddlePose(
  s: State,
  side: Side,
  patch: Partial<PaddleState>,
): CaromState {
  return {
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], ...patch } },
  };
}
function declaredState(s: State): Omit<CaromState, "menuContacts"> {
  const { menuContacts, ...state } = structuredClone(s);
  void menuContacts;
  return state;
}
function debugSurface(): CaromDebugApi {
  return {
    version: C.CAROM_DEBUG_VERSION,
    snapshot: (s) => ({
      ...declaredState(s),
      version: C.CAROM_DEBUG_VERSION,
      ball: s.ball
        ? {
            ...structuredClone(s.ball),
            speed: Math.hypot(s.ball.vx, s.ball.vy),
          }
        : null,
    }),
    menuItemRect,
    clearWorld: (s) => ({ ...s, ball: null, obstacles: [] }),
    spawnBall: (s) => ({ ...s, ball: parked() }),
    spawnObstacle: (s, index) => ({
      ...s,
      obstacles: [
        ...s.obstacles.filter((o) => o.index !== index),
        obstacle(index),
      ].sort((a, b) => a.index - b.index),
    }),
    reset: (s) => initial(s.muted),
    reconcile: (s) => ({ ...s }),
    setScreen: (s, screen) => ({ ...s, screen }),
    setMode: (s, mode) => ({ ...s, mode }),
    setMenuIndex: (s, menuIndex) => ({ ...s, menuIndex }),
    setTitleIndex: (s, titleIndex) => ({ ...s, titleIndex }),
    setResumeScreen: (s, resumeScreen) => ({ ...s, resumeScreen }),
    setScore: (s, p1, p2) => ({ ...s, score: { p1, p2 } }),
    setWinner: (s, winner) => ({ ...s, winner }),
    setReceiver: (s, receiver) => ({ ...s, receiver }),
    setPaddleCy: (s, side, cy) => paddlePose(s, side, { cy }),
    setPaddleVy: (s, side, drivenVy) => paddlePose(s, side, { drivenVy }),
    setPaddleDriven: (s, side, driven) => paddlePose(s, side, { driven }),
    setBallPosition: (s, x, y) => ballPose(s, { x, y }),
    setBallVelocity: (s, vx, vy) => ballPose(s, { vx, vy }),
    setBallSpin: (s, spin) => ballPose(s, { spin }),
    setBallHeld: (s, held) => ballPose(s, { held }),
    setBallHoldTimer: (s, holdTimer) => ballPose(s, { holdTimer }),
    setBallServeSign: (s, serveSign) => ballPose(s, { serveSign }),
    drawBallServeSign: (s) => ballPose(s, { serveSign: sign() }),
    setAiTracking: (s, tracking) => ({ ...s, ai: { ...s.ai, tracking } }),
    setAiMovement: (s, movement) => ({ ...s, ai: { ...s.ai, movement } }),
    setMuted: (s, muted) => {
      return { ...s, muted };
    },
  };
}
function start(s: State, mode: Mode): CaromState {
  return {
    ...s,
    mode,
    screen: "countdown",
    resumeScreen: "playing",
    menuIndex: 0,
    score: { p1: 0, p2: 0 },
    winner: null,
    receiver: "left",
    ball: parked(),
    paddles: {
      left: { ...s.paddles.left, cy: C.FIELD_CY, vy: 0 },
      right: { ...s.paddles.right, cy: C.FIELD_CY, vy: 0 },
    },
  };
}
function title(s: State): CaromState {
  return {
    ...initial(s.muted),
    titleIndex: s.titleIndex,
    menuIndex: s.titleIndex,
    simTime: s.simTime,
  };
}
function confirm(s: State): CaromState {
  if (s.screen === "title") {
    const next = { ...s, titleIndex: s.menuIndex };
    return s.menuIndex === 2
      ? { ...next, screen: "howto", menuIndex: 0 }
      : start(next, s.menuIndex === 1 ? "versus" : "solo");
  }
  if (s.screen === "howto") return title(s);
  if (s.screen === "paused")
    return s.menuIndex === 0
      ? { ...s, screen: s.resumeScreen }
      : s.menuIndex === 1
        ? start(s, s.mode)
        : title(s);
  return s.menuIndex === 0 ? start(s, s.mode) : title(s);
}
function input(s: State, api: UpdateApi): CaromState {
  const edges = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  );
  if (edges.mute) api.audio.setMuted(!api.audio.muted());
  let next: CaromState = { ...s, muted: api.audio.muted() };
  const samples = api.input.pointerSamples();
  const contacts: Record<number, number> = { ...s.menuContacts };
  api.input.pointer();
  api.input.pointerContacts();
  if (s.screen === "playing" || s.screen === "countdown")
    return edges.pause
      ? { ...next, resumeScreen: s.screen, screen: "paused", menuIndex: 0 }
      : next;
  if (s.screen === "paused" && (edges.pause || edges.back))
    return { ...next, screen: s.resumeScreen };
  if ((s.screen === "howto" || s.screen === "matchover") && edges.back)
    return title(next);
  const list = items(s);
  const up = edges["p1-up"] || edges["p2-up"],
    down = edges["p1-down"] || edges["p2-down"];
  const movement = up || down;
  if (movement)
    next = {
      ...next,
      menuIndex: (s.menuIndex + (up ? -1 : 1) + list.length) % list.length,
    };
  const keyboardConfirm = edges.confirm && !movement;
  if (keyboardConfirm) return confirm(next);
  // Contacts carry their landing positions in the engine's ordered sample stream.
  const hit = (x: number, y: number) =>
    list.findIndex((_, i) => {
      const r = menuItemRect(s, i)!;
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    });
  for (const sample of samples) {
    const index = hit(sample.x, sample.y);
    if (sample.button !== "primary" && sample.type !== "move") continue;
    if (sample.type === "down") contacts[sample.id] = index;
    if (index >= 0) next = { ...next, menuIndex: index };
    if (sample.type === "up") {
      const landing = contacts[sample.id];
      delete contacts[sample.id];
      if (index >= 0 && landing === index)
        return confirm({ ...next, menuContacts: {} });
    }
  }
  return { ...next, menuContacts: contacts };
}
function move(p: PaddleState, vy: number, dt: number): PaddleState {
  const raw = p.cy + vy * dt,
    cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return { ...p, cy, vy: raw !== cy && dt > 0 ? (cy - p.cy) / dt : vy };
}
export function simulate(s: State, api: UpdateApi, dt: number): CaromState {
  let next: CaromState = { ...s, simTime: s.simTime + dt };
  if (s.screen !== "playing" && s.screen !== "countdown") return next;
  const axis = (up: string, down: string) =>
    Number(api.input.value(down) > 0) - Number(api.input.value(up) > 0);
  const humanLeft =
    s.mode === "solo"
      ? Number(
          api.input.value("p1-down") > 0 || api.input.value("p2-down") > 0,
        ) - Number(api.input.value("p1-up") > 0 || api.input.value("p2-up") > 0)
      : axis("p1-up", "p1-down");
  let aiVy = 0;
  if (s.ai.movement) {
    const defending =
      s.ai.tracking &&
      s.screen === "playing" &&
      s.ball !== null &&
      s.ball.vx > 0;
    const target = defending
      ? s.ball!.y - s.ball!.vy * C.AI_REACT
      : C.AI_HOME_Y;
    const diff = target - s.paddles.right.cy;
    if (
      Math.abs(diff) > (defending ? C.AI_DEADZONE : C.AI_HOME_DEADZONE) &&
      dt > 0
    )
      aiVy = Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt);
  }
  const left = s.paddles.left,
    right = s.paddles.right;
  next = {
    ...next,
    paddles: {
      left: move(
        left,
        left.driven ? left.drivenVy : humanLeft * C.PADDLE_SPEED,
        dt,
      ),
      right: move(
        right,
        right.driven
          ? right.drivenVy
          : s.mode === "solo"
            ? aiVy
            : axis("p2-up", "p2-down") * C.PADDLE_SPEED,
        dt,
      ),
    },
  };
  if (!s.ball) return next;
  let b = { ...s.ball, trail: [...s.ball.trail] };
  const cues = new Set<C.CueName>();
  if (s.screen === "countdown") {
    b.holdTimer -= dt;
    if (b.holdTimer <= 0) {
      b = {
        ...b,
        holdTimer: 0,
        held: false,
        trail: [],
        vx:
          (s.receiver === "left" ? -1 : 1) *
          C.SERVE_SPEED *
          Math.cos(C.SERVE_ANGLE),
        vy: b.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
      };
      next = { ...next, screen: "playing" };
    }
  } else if (!b.held) {
    const n = Math.max(
        1,
        Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
      ),
      h = dt / n;
    const rect = (
      x0: number,
      x1: number,
      y0: number,
      y1: number,
      side?: Side,
    ) => {
      if (!(
        b.x > x0 - C.BALL_R &&
        b.x < x1 + C.BALL_R &&
        b.y > y0 - C.BALL_R &&
        b.y < y1 + C.BALL_R
      ))
        return;
      const depths = [
        b.x - x0 + C.BALL_R,
        x1 + C.BALL_R - b.x,
        b.y - y0 + C.BALL_R,
        y1 + C.BALL_R - b.y,
      ];
      const face = depths.indexOf(Math.min(...depths));
      let bounced = false;
      if (face === 0) {
        b.x = x0 - C.BALL_R;
        if (b.vx > 0) {
          b.vx = -b.vx;
          bounced = true;
        }
      }
      if (face === 1) {
        b.x = x1 + C.BALL_R;
        if (b.vx < 0) {
          b.vx = -b.vx;
          bounced = true;
        }
      }
      if (face === 2) {
        b.y = y0 - C.BALL_R;
        if (b.vy > 0) {
          b.vy = -b.vy;
          bounced = true;
        }
      }
      if (face === 3) {
        b.y = y1 + C.BALL_R;
        if (b.vy < 0) {
          b.vy = -b.vy;
          bounced = true;
        }
      }
      if (side && face < 2) {
        const p = next.paddles[side],
          theta =
            clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE,
          speed = Math.min(Math.hypot(b.vx, b.vy) * C.SPEED_MULT, C.SPEED_CAP);
        b.vx = (side === "left" ? 1 : -1) * speed * Math.cos(theta);
        b.vy = speed * Math.sin(theta);
        b.spin = clamp(
          b.spin + p.vy * C.SPIN_FROM_PADDLE,
          -C.SPIN_CLAMP,
          C.SPIN_CLAMP,
        );
        b.x = side === "left" ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R;
        cues.add(C.CUES.paddleHit);
      } else if (bounced)
        cues.add(side ? C.CUES.wallBounce : C.CUES.obstacleBounce);
    };
    for (let i = 0; i < n; i++) {
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > 0) {
        const angle = (b.spin / speed) * h,
          cos = Math.cos(angle),
          sin = Math.sin(angle),
          vx = b.vx;
        b.vx = vx * cos - b.vy * sin;
        b.vy = vx * sin + b.vy * cos;
      }
      b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
      b.x += b.vx * h;
      b.y += b.vy * h;
      if (b.y - C.BALL_R < 0 && b.vy < 0) {
        b.y = C.BALL_R;
        b.vy = -b.vy;
        cues.add(C.CUES.wallBounce);
      } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
        b.y = C.FIELD_H - C.BALL_R;
        b.vy = -b.vy;
        cues.add(C.CUES.wallBounce);
      }
      rect(
        C.P1_X0,
        C.P1_X1,
        next.paddles.left.cy - C.PADDLE_HALF,
        next.paddles.left.cy + C.PADDLE_HALF,
        "left",
      );
      rect(
        C.P2_X0,
        C.P2_X1,
        next.paddles.right.cy - C.PADDLE_HALF,
        next.paddles.right.cy + C.PADDLE_HALF,
        "right",
      );
      for (const o of s.obstacles) {
        const r = C.OBSTACLES[o.index];
        rect(r.x0, r.x1, r.y0, r.y1);
      }
    }
  }
  b.trail = [...b.trail, { x: b.x, y: b.y, t: next.simTime }].filter(
    (p) => next.simTime - p.t <= C.TRAIL_TIME,
  );
  next = { ...next, ball: b };
  if (
    s.screen === "playing" &&
    !b.held &&
    (b.x - C.BALL_R > C.FIELD_W || b.x + C.BALL_R < 0)
  ) {
    const scorer: Side = b.x > C.FIELD_W ? "left" : "right",
      score = {
        p1: s.score.p1 + Number(scorer === "left"),
        p2: s.score.p2 + Number(scorer === "right"),
      };
    const win =
      (score.p1 >= C.WIN_SCORE && score.p1 - score.p2 >= C.WIN_LEAD) ||
      (score.p2 >= C.WIN_SCORE && score.p2 - score.p1 >= C.WIN_LEAD);
    next = {
      ...next,
      score,
      ...(win
        ? { winner: scorer, screen: "matchover" as const, menuIndex: 0 }
        : {
            receiver:
              scorer === "left" ? ("right" as const) : ("left" as const),
            ball: parked(),
            screen: "countdown" as const,
          }),
    };
    cues.add(C.CUES.score);
  }
  for (const cue of cues) api.audio.play(cue);
  return next;
}
export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api) {
    for (const action of C.ACTIONS)
      api.input.register(action, { keys: [...C.BINDINGS[action]] });
    const tones = [
      { freq: 540, freqTo: 860, durationMs: 65 },
      { freq: 290, freqTo: 180, durationMs: 45 },
      { freq: 760, freqTo: 380, durationMs: 90 },
      { freq: 320, freqTo: 960, durationMs: 240 },
    ];
    Object.values(C.CUES).forEach((cue, i) =>
      api.audio.define(cue, {
        ...tones[i],
        wave: i === 2 ? "triangle" : "sine",
        gain: 0.15,
      }),
    );
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    for (const key of ["p1", "p2"] as const)
      api.diagnostics.register(key, (s) => s.score[key]);
    for (const key of ["x", "y", "vx", "vy", "spin"] as const)
      api.diagnostics.register(`ball.${key}`, (s) => s.ball?.[key] ?? "absent");
    api.diagnostics.register("ball.speed", (s) =>
      s.ball ? Math.hypot(s.ball.vx, s.ball.vy) : "absent",
    );
    for (const side of ["left", "right"] as const)
      for (const key of ["cy", "vy"] as const)
        api.diagnostics.register(`${side}.${key}`, (s) => s.paddles[side][key]);
    // Runtime audio is synchronized from the readable state on every update.
    return [initial(), debugSurface()];
  },
  update(s, api, dt) {
    api.audio.setMuted(s.muted);
    return simulate(input(s, api), api, dt);
  },
  render,
};
