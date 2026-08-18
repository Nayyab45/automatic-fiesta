# Dastarkhān — "What Should We Eat?" (Ionic 8 + Angular)

This is the Ionic 8 / Angular 18 conversion of the 38 static HTML prototype
screens in the original `Project1` folder. Every screen has been turned into
a real, routed, standalone Angular component, wired together into a
click-through app you can run in a browser or package for iOS/Android later.

## Getting started

This sandbox had no npm registry access, so dependencies could not be
installed or the project build-verified here. On your machine, with normal
internet access:

```bash
npm install
npm start        # ng serve, opens on http://localhost:4200
```

Build for production:

```bash
npm run build     # outputs to ./www
```

To later add native iOS/Android via Capacitor:

```bash
npm install -g @ionic/cli
ionic integrations enable capacitor
ionic capacitor add ios
ionic capacitor add android
```

## What was converted

All 50 screens (`AI Matching.html`, `Home Screen.html`, `Login.html`, …) are
now standalone Angular components under `src/app/pages/<screen-id>/`, each
with its own `.page.ts`, `.page.html`, and `.page.scss`. Routing lives in
`src/app/app.routes.ts` — the app boots at `/splash` and every screen is
reachable at its own URL (e.g. `/login`, `/home`, `/dining-event-details`).

The visual design was **not** rebuilt in Ionic's default components. The
original mockups already used a fully custom Tailwind-based design system
(Material-3-derived color tokens, Playfair Display + Inter type, a bespoke
bottom nav and cards) rather than stock Ionic UI, so preserving that 1:1
meant keeping the original markup and just adding Angular/Ionic plumbing
around it, rather than replacing it with `ion-header`/`ion-tab-bar`/etc. The
app still gets real Ionic value: `ion-app` + `ion-router-outlet` provide
page transition animations, gesture-based navigation, and the standard
Ionic/Capacitor foundation for shipping as a native app later.

### Design tokens

`tailwind.config.js` merges the color/spacing/type-scale tokens that were
duplicated (and, in a couple of files, extended) across all 50 prototypes,
so every page renders with pixel-identical styling to the original. Shared
CSS (safe-area padding, the soft card shadow, scrollbar hiding, autofill
styling, shared `@keyframes`, etc.) lives once in `src/global.scss`;
screen-specific rules (a glass-blur variant, a slider thumb style, the
premium shimmer text, …) stay in that screen's own `.page.scss`.

### Navigation

The prototypes were static — links were `href="#"` and buttons had no
target. This conversion wires up real navigation using each button/link's
own visible label, for example:

- The 5-icon bottom nav bar (Home / Discover / Tables / Messages / Profile)
  uses Angular's `routerLink`.
- Header back/close icons call `goBack()` (Angular `Location.back()`).
- Primary flow buttons ("Sign In", "Create Table", "Send Request", "View
  Table", …) navigate to the logical next screen.
- A few screens needed real interactivity beyond navigation and got small,
  faithful ports of their original inline `<script>` logic into the
  component class: the dietary/food preference chip togglers
  (`dietary-preferences`, `food-preferences`) and the province → city
  cascading dropdown (`profile-creation`).

This navigation map is a best-effort reconstruction of the intended user
flow (there's no backend, so it's necessarily a judgment call in a few
places) — it's easy to change: every navigation call is a plain
`(click)="go('/some-route')"` or `routerLink="/some-route"` in that page's
`.page.html`.

### Known gaps / next steps

- **No backend.** All data (restaurant cards, chat messages, table
  invites…) is the same static placeholder content from the original
  mockups. Wiring real data would mean adding services/HTTP calls and
  turning the static markup into `*ngFor` bindings.
- **Remote images.** Most photos still point at the original
  `lh3.googleusercontent.com` prototype URLs (the app needs internet access
  to show them). The two app-logo images were swapped to the local
  `src/assets/icon/logo.png` you provided.
- **Not build-verified here.** Because this sandbox couldn't reach the npm
  registry, `npm install` / `ng build` need to be run on your machine to
  confirm a clean compile (the 11 newest pages were written straight into
  your already-installed project, so a quick `npm start` is the fastest way
  to check them). The TypeScript in every generated file was syntax-checked
  locally, and all 50 internal route targets were verified to resolve to a
  real page, but a full Angular compiler pass (template
  type-checking) hasn't been run.

## Project structure

```
src/
  app/
    app.component.ts       # ion-app + ion-router-outlet shell
    app.routes.ts           # all 50 routes + splash redirect
    pages/
      splash/
      loading/
      welcome/
      login/
      signup/
      profile-creation/
      personal-interests/
      food-preferences/
      dietary-preferences/
      home/
      discover-restaurants/
      discover-people/
      search-filter/
      ai-matching/
      ai-restaurant-recommendation/
      restaurant-detail/
      restaurant-direction/
      my-tables/
      empty-state-table/
      create-table/
      dining-event-details/
      guest-list/
      request-seat/
      request-status/
      check-in/
      post-dining-review/
      dining-group-chat/
      messages/
      notifications/
      profile/
      edit-preferences/
      settings/
      premium-members/
      safety-center/
      safety-checkin/
      emergency-contacts/
      community-guidelines/
      report-users/
      future-features/
      reset-password/
      reset-password-confirmation/
      terms-of-service/
      privacy-policy/
      privacy-settings/
      identity-verification/
      blocked-users/
      full-community-policy/
      help-support/
      subscribe-to-premium/
      subscribe-to-premium-success/
  assets/icon/logo.png
  global.scss
  theme/variables.scss
  index.html
  main.ts
tailwind.config.js
postcss.config.js
angular.json
ionic.config.json
package.json
```
