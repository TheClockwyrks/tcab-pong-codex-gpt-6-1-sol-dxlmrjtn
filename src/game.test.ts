import { createCanvas } from "@napi-rs/canvas";
import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import { describe, it, expect } from "vitest";
import { game, BACKGROUND } from "./game";
import * as C from "./constants";
async function setup(step = 8) {
  const target = new EventTarget();
  const canvas = createCanvas(
    C.FIELD_W,
    C.FIELD_H,
  ) as unknown as HTMLCanvasElement;
  const engine = createEngine({
    canvas,
    width: C.FIELD_W,
    height: C.FIELD_H,
    game,
    background: BACKGROUND,
    clock: new ConstantClock(step),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => target,
    },
  });
  await engine.initialize();
  const key = (code: string) => {
    const e = new Event("keydown");
    Object.assign(e, { code, repeat: false });
    target.dispatchEvent(e);
    const u = new Event("keyup");
    Object.assign(u, { code });
    target.dispatchEvent(u);
  };
  return { engine, key, target };
}
describe("Carom through the engine", () => {
  it("starts, serves on the expiry frame, and freezes a paused ball", async () => {
    const { engine: e, key } = await setup(10);
    key("Enter");
    await e.advance(1);
    expect(e.state.screen).toBe("countdown");
    await e.advance(99);
    expect(e.state.screen).toBe("playing");
    expect(e.state.ball?.x).toBe(C.FIELD_CX);
    key("Escape");
    await e.advance(1);
    const ball = e.state.ball;
    await e.advance(10);
    expect(e.state.ball).toEqual(ball);
    key("Escape");
    await e.advance(1);
    expect(e.state.screen).toBe("playing");
    e.destroy();
  });
  it("adds paddle spin, accelerates a hit, and preserves old state", async () => {
    const { engine: e } = await setup();
    const d = e.debug;
    e.apply((s) => d.clearWorld(s));
    e.apply((s) => d.spawnBall(s));
    e.apply((s) => d.setScreen(s, "playing"));
    e.apply((s) => d.setBallHeld(s, false));
    e.apply((s) => d.setBallPosition(s, C.P1_X1 + C.BALL_R + 2, C.FIELD_CY));
    e.apply((s) => d.setBallVelocity(s, -500, 0));
    e.apply((s) => d.setPaddleDriven(s, "left", true));
    e.apply((s) => d.setPaddleVy(s, "left", 200));
    const old = e.state;
    await e.advance(1);
    expect(e.state.ball!.vx).toBeGreaterThan(0);
    expect(e.state.ball!.spin).toBeGreaterThan(160);
    expect(d.snapshot(e.state).ball!.speed).toBeCloseTo(520);
    expect(old.ball!.vx).toBe(-500);
    e.destroy();
  });
  it("scores, requires a two-point lead, and parks toward the receiver", async () => {
    const { engine: e } = await setup();
    const d = e.debug;
    const point = async () => {
      e.apply((s) => d.setScreen(s, "playing"));
      e.apply((s) => d.setBallHeld(s, false));
      e.apply((s) => d.setBallPosition(s, C.FIELD_W + C.BALL_R + 1, 100));
      e.apply((s) => d.setBallVelocity(s, 100, 0));
      await e.advance(1);
    };
    e.apply((s) => d.setScore(s, 10, 10));
    await point();
    expect(e.state.screen).toBe("countdown");
    expect(e.state.receiver).toBe("right");
    await point();
    expect(e.state.screen).toBe("matchover");
    expect(e.state.winner).toBe("left");
    e.destroy();
  });
  it("clears entities, rejects missing poses, and resets all diagnostics", async () => {
    const { engine: e } = await setup();
    const d = e.debug;
    e.apply((s) => d.clearWorld(s));
    expect(() => d.setBallSpin(e.state, 4)).toThrow();
    expect(() => d.spawnObstacle(e.state, 3)).toThrow();
    e.apply((s) => d.setScreen(s, "playing"));
    await e.advance(2);
    expect(e.state.ball).toBeNull();
    e.apply((s) => d.reset(s));
    expect(e.state.simTime).toBe(0);
    expect(e.state.obstacles).toHaveLength(2);
    expect(e.diagnostics().every((r) => r.error === undefined)).toBe(true);
    expect(d.reconcile(e.state)).toEqual(e.state);
    expect(d.menuItemRect(e.state, 0)).not.toBeNull();
    e.destroy();
  });
  it("decays spin identically across step sizes and keeps speed", async () => {
    for (const step of [2, 16]) {
      const { engine: e } = await setup(step);
      const d = e.debug;
      e.apply((s) => d.clearWorld(s));
      e.apply((s) => d.spawnBall(s));
      e.apply((s) => d.setScreen(s, "playing"));
      e.apply((s) => d.setBallHeld(s, false));
      e.apply((s) => d.setBallVelocity(s, 200, 0));
      e.apply((s) => d.setBallSpin(s, 100));
      await e.advance(800 / step);
      expect(e.state.ball!.spin).toBeCloseTo(50, 7);
      expect(d.snapshot(e.state).ball!.speed).toBeCloseTo(200, 7);
      e.destroy();
    }
  });
  it("confirms mouse and touch only when both edges share an item", async () => {
    const { engine: e, target } = await setup();
    const send = (type: string, x: number, y: number, device = "mouse") => {
      const event = new Event(type);
      Object.assign(event, {
        clientX: x,
        clientY: y,
        pointerId: 7,
        isPrimary: true,
        pointerType: device,
        button: 0,
        buttons: type === "pointerup" ? 0 : 1,
      });
      target.dispatchEvent(event);
    };
    send("pointerdown", 500, 370);
    await e.advance(1);
    send("pointerup", 500, 450);
    await e.advance(1);
    expect(e.state.screen).toBe("title");
    send("pointerdown", 500, 450, "touch");
    await e.advance(1);
    send("pointerup", 500, 450, "touch");
    await e.advance(1);
    expect(e.state.screen).toBe("countdown");
    expect(e.state.mode).toBe("versus");
    e.destroy();
  });
  it("reflects walls and obstacles without altering speed or spin", async () => {
    const { engine: e } = await setup();
    const d = e.debug;
    e.apply((s) => d.setScreen(s, "playing"));
    e.apply((s) => d.setBallHeld(s, false));
    e.apply((s) => d.setBallPosition(s, 300, C.BALL_R + 1));
    e.apply((s) => d.setBallVelocity(s, 0, -500));
    await e.advance(1);
    expect(e.state.ball!.vy).toBe(500);
    const o = C.OBSTACLE_CENTERS[0];
    e.apply((s) =>
      d.setBallPosition(s, o.x - C.OBSTACLE_HW - C.BALL_R - 1, o.y),
    );
    e.apply((s) => d.setBallVelocity(s, 500, 0));
    await e.advance(1);
    expect(e.state.ball!.vx).toBe(-500);
    expect(e.state.ball!.spin).toBe(0);
    e.destroy();
  });
});
