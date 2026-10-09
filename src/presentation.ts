import type { RenderApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import type { CaromState } from "./game";
import { items, menuItemRect, BACKGROUND } from "./game";
import * as C from "./constants";
const colors = {
  left: "#66e5dc",
  right: "#fa8b81",
  obstacle: "#efc56b",
  ink: "#ecf2f8",
  dim: "#78899f",
};
export function render(s: DeepReadonly<CaromState>, { ctx }: RenderApi): void {
  const text = (
    copy: string,
    x: number,
    y: number,
    size = 16,
    color = colors.dim,
    align: CanvasTextAlign = "center",
  ) => {
    ctx.fillStyle = color;
    ctx.font = `${size >= 32 ? 700 : 500} ${size}px ${size >= 32 ? '"Arial", sans-serif' : '"Courier New", monospace'}`;
    ctx.textAlign = align;
    ctx.fillText(copy, x, y);
  };
  const bar = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    glow = 0,
  ) => {
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(w / 2, 8));
    ctx.fill();
    ctx.shadowBlur = 0;
  };
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  // Quiet court markings keep the bright collision bodies easy to read.
  ctx.strokeStyle = "#172435";
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 24, C.FIELD_W - 48, C.FIELD_H - 48);
  ctx.setLineDash([5, 14]);
  ctx.beginPath();
  ctx.moveTo(C.NET_X, 100);
  ctx.lineTo(C.NET_X, 650);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "#152234";
  ctx.beginPath();
  ctx.arc(C.FIELD_CX, C.FIELD_CY, 92, 0, Math.PI * 2);
  ctx.stroke();
  const menu = items(s).length > 0;
  ctx.globalAlpha = menu ? 0.25 : 1;
  bar(
    C.P1_X0,
    s.paddles.left.cy - C.PADDLE_HALF,
    C.PADDLE_W,
    C.PADDLE_H,
    colors.left,
    14,
  );
  bar(
    C.P2_X0,
    s.paddles.right.cy - C.PADDLE_HALF,
    C.PADDLE_W,
    C.PADDLE_H,
    colors.right,
    14,
  );
  for (const o of s.obstacles) {
    bar(
      o.cx - C.OBSTACLE_HW,
      o.cy - C.OBSTACLE_HH,
      C.OBSTACLE_W,
      C.OBSTACLE_H,
      colors.obstacle,
      9,
    );
    text(
      o.index === 0 ? "A" : "B",
      o.cx,
      o.cy + C.OBSTACLE_HH + 24,
      12,
      colors.obstacle,
    );
  }
  if (s.ball) {
    const b = s.ball;
    ctx.lineCap = "round";
    for (let i = 1; i < b.trail.length; i++) {
      const a = b.trail[i - 1],
        p = b.trail[i];
      ctx.strokeStyle = `rgba(236,242,248,${0.08 + (i / b.trail.length) * 0.4})`;
      ctx.lineWidth = 3 + (i / b.trail.length) * 8;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.fillStyle = colors.ink;
    ctx.shadowColor = colors.ink;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(b.x, b.y, C.BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
  if (!menu || s.screen === "paused" || s.screen === "matchover") {
    text(
      s.mode === "solo" ? "SOLO / HUMAN × AI" : "VERSUS / LOCAL DUEL",
      C.FIELD_CX,
      43,
      12,
    );
    text(String(s.score.p1), C.FIELD_CX - 102, 99, 58, colors.left);
    text(String(s.score.p2), C.FIELD_CX + 102, 99, 58, colors.right);
    text("PLAYER 01", 126, 43, 12, colors.left);
    text(
      s.mode === "solo" ? "COMPUTER" : "PLAYER 02",
      1154,
      43,
      12,
      colors.right,
    );
    text("W / S", 100, 686, 12);
    text(s.mode === "solo" ? "P / ESC  PAUSE" : "↑ / ↓", 1180, 686, 12);
    text("FIRST TO 11 · WIN BY 2", 640, 686, 12);
    if (s.screen === "countdown") {
      text("READY", C.FIELD_CX, 280, 28, colors.ink);
      text(
        `SERVE TO ${s.receiver === "left" ? "PLAYER 01" : s.mode === "solo" ? "COMPUTER" : "PLAYER 02"}`,
        C.FIELD_CX,
        308,
        12,
      );
    }
  }
  if (menu) {
    if (s.screen !== "title") {
      ctx.fillStyle = "#090f19e8";
      ctx.fillRect(310, 135, 660, 515);
    }
    if (s.screen === "title") {
      text("A GAME OF ANGLES", 640, 153, 14, colors.obstacle);
      text(C.TITLE_TEXT, 640, 282, 112, colors.ink);
      text("MOVE. STRIKE. BEND THE RALLY.", 640, 318, 14);
      text("01 / SINGLE PLAYER", 874, 381, 11, colors.dim, "left");
      text("02 / SHARED KEYBOARD", 874, 449, 11, colors.dim, "left");
      text("03 / THE BASICS", 874, 517, 11, colors.dim, "left");
    } else if (s.screen === "howto") {
      text("THE ART OF THE RETURN", 640, 210, 36, colors.ink);
      const lines = [
        "SOLO    W / S or ↑ / ↓ moves your paddle.",
        "VERSUS  W / S on the left. ↑ / ↓ on the right.",
        "Strike while moving to put spin on the ball.",
        "Your motion curves its flight after contact.",
        "Bank off the amber obstacles to change the angle.",
        "First to 11 wins. Keep a two-point lead.",
        "P / ESC pauses · M toggles sound.",
      ];
      lines.forEach((line, i) =>
        text(
          line,
          640,
          282 + i * 36,
          16,
          i === 2 || i === 4 ? colors.obstacle : colors.dim,
        ),
      );
    } else {
      text(
        s.screen === "paused"
          ? "RALLY PAUSED"
          : `${s.winner === "left" ? "PLAYER 01" : s.mode === "solo" ? "COMPUTER" : "PLAYER 02"} WINS`,
        640,
        240,
        44,
        colors.ink,
      );
      text(
        s.screen === "paused"
          ? "TAKE A BREATHER. THE COURT CAN WAIT."
          : `${s.score.p1} : ${s.score.p2}  /  MATCH COMPLETE`,
        640,
        285,
        14,
      );
    }
    items(s).forEach((item, i) => {
      const r = menuItemRect(s, i)!;
      const selected = i === s.menuIndex;
      bar(r.x, r.y, r.w, r.h, selected ? "#1b333b" : "#101c2b");
      if (selected) {
        ctx.strokeStyle = colors.left;
        ctx.lineWidth = 1;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        text("→", r.x + 28, r.y + 34, 20, colors.left);
      }
      text(item, 640, r.y + 35, 18, selected ? colors.ink : colors.dim);
    });
    text("W / S OR ↑ / ↓  SELECT     ENTER  CONFIRM", 640, 662, 12);
  }
  text(
    s.muted ? "M / SOUND OFF" : "M / SOUND ON",
    C.FIELD_W - 38,
    C.FIELD_H - 12,
    10,
    colors.dim,
    "right",
  );
  text("CAROM  /  SPIN & BANK", 38, C.FIELD_H - 12, 10, colors.dim, "left");
}
