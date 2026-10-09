# Carom

A browser paddle duel about spin and bank shots. Sweep your paddle through a hit to curve the ball, and use the two amber obstacles to open unexpected angles. Play against the computer or share a keyboard. First to 11 wins, with a two-point lead.

Install with `npm ci`. Run `npm run dev` for development. `npm run build` produces the complete static site in `dist/`; serve that directory from any static host. `npm run preview` previews the production build.

Solo: W/S or the arrow keys move your paddle. Versus: W/S controls the left paddle, and up/down arrows control the right. Enter or Space confirms menus; W/S or up/down selects. Mouse and touch also select menu items, and touch controls appear on touch devices. P or Escape pauses; M toggles sound. Backtick opens the engine diagnostics.

Run `npm run typecheck`, `npm run lint`, `npm run format`, and `npm test` to check the implementation. The simulation uses elapsed seconds and runs through the Simple 2D engine without assets or network requests. Player-facing media lives in `showcase/`.
