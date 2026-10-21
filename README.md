<div align="center">

# 🐂 Bulls & Cows

**A multiplayer number-guessing game that runs entirely in the browser.**
No accounts. No database. No backend. Just a four-character room code.

[English](#english) · [العربية](#العربية)

[![CI](https://github.com/your-user/bulls-cows/actions/workflows/ci.yml/badge.svg)](https://github.com/your-user/bulls-cows/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-violet.svg)](LICENSE)

</div>

---

<a name="english"></a>

## English

### What it is

Bulls & Cows is a party game for two to eight people. One player creates a
room and gets a short code such as `K7P4`. Everyone else joins with that code
— or with a link — and takes turns guessing a hidden number.

- **Bulls** — the digit is right _and_ in the right place.
- **Cows** — the digit is right, but in the wrong place.

The first player to solve it wins.

### Why it is built this way

There is **no server**. The game is a static site, and the room lives in the
Host's browser memory. Players talk to the Host directly over **WebRTC data
channels** (via [PeerJS](https://peerjs.com/)); PeerJS's public signaling
server is used only to introduce peers to each other — game traffic never
touches it.

```
                    ┌───────────────────────┐
                    │       HOST            │
   peer.id = "K7P4" │  authoritative state  │
                    │  secret · turn · logs │
                    └───┬───────────┬───────┘
        ┌───────────────┘           └──────────────┐
        │                                          │
   ┌────▼─────┐  ┌─────────────┐  ┌────────────┐  ┌▼────────┐
   │ Player 1 │  │  Player 2   │  │  Player 3  │  │Spectator│
   └──────────┘  └─────────────┘  └────────────┘  └─────────┘
        \____________  WebRTC data channels  ____________/
```

The trade-off is deliberate and documented: **when the Host closes the tab,
the room ends.** That is what "no backend" means, and the game tells the
player so rather than freezing.

### Features

- 🎮 Mobile-first neon-arcade interface, designed for one thumb
- 🌐 **English and Arabic**, with a fully mirrored right-to-left layout
- 👥 Up to 8 players in one room, star topology
- 📶 Live per-player attempts board, leaderboard and chat
- 🔁 Automatic reconnection with a visible countdown — never a silent spinner
- 🧩 Original SVG mascot, synthesised sound effects, haptics and confetti
- 🪶 No binary assets: the whole game is about **46 KB gzipped**
- ♿ WCAG AA contrast, keyboard access, reduced-motion support

### Quick start

```bash
git clone https://github.com/your-user/bulls-cows.git
cd bulls-cows
npm install
npm run dev
```

Open <http://localhost:5173>, create a room, and share the link.

To try it on two devices at once, run `npm run dev -- --host` and open
`http://<your-lan-ip>:5173` on the other device.

### Deploying

The build output is a plain static folder. All three hosts below serve the
same `dist/`, and none of them needs a server, a function or an environment
variable.

#### GitHub Pages

The Pages workflow builds and publishes automatically on every push to
`main`. Enable **Settings → Pages → Source: GitHub Actions**.

The repository name is used as the path prefix, so
`https://<user>.github.io/bulls-cows/` works out of the box.

#### Netlify

```bash
npx netlify-cli deploy --prod --dir=dist
```

Or connect the repository in the Netlify UI — the build command and publish
directory are already in `netlify.toml`.

#### Vercel

```bash
npx vercel --prod
```

Or import the repository — `vercel.json` already describes the build.

### How the pieces fit

| Concern                     | Where                  | Note                                            |
| --------------------------- | ---------------------- | ----------------------------------------------- |
| Game rules, scoring, secret | `src/core/`            | Pure. No DOM, no network, no timers.            |
| Wire protocol               | `src/core/protocol.js` | The only place that sees raw wire data.         |
| Transport                   | `src/net/`             | PeerJS, with timeouts, backoff and liveness.    |
| Interface                   | `src/ui/`              | Screens and components, built with the DOM API. |
| Text                        | `src/i18n/`            | English and Arabic locale tables.               |
| Design tokens               | `src/styles/main.css`  | Colours, type and motion, in one place.         |

The Host owns the only authoritative state. Every change is broadcast as a
complete snapshot, which makes late joiners and reconnects work for free and
removes an entire class of desynchronisation bugs.

### Configuration

Everything tunable lives in [`src/config.js`](src/config.js). There are **no
environment variables** — the project must build and run with zero
configuration.

| Setting              | Default                   | Purpose                                                    |
| -------------------- | ------------------------- | ---------------------------------------------------------- |
| `SIGNALING_HOST`     | `0.peerjs.com`            | Swap for a self-hosted PeerServer if you want one.         |
| `ICE_SERVERS`        | Three public STUN servers | Add a TURN relay if your players are behind symmetric NAT. |
| `CONNECT_TIMEOUT_MS` | `15000`                   | How long a connection attempt may take.                    |
| `RETRY_DELAYS_MS`    | `1s → 15s`                | Backoff between attempts.                                  |
| `SEAT_HOLD_MS`       | `60000`                   | How long a disconnected player keeps their seat.           |
| `GUEST_TIMEOUT_MS`   | `25000`                   | How long the Host waits to hear from a guest.              |
| `MAX_PLAYERS`        | `8`                       | Room capacity.                                             |

### Development

```bash
npm run dev            # development server
npm run verify         # lint, format, typecheck, unit, build, contrast
npm run test           # unit tests (Vitest)
npm run test:coverage  # unit tests with coverage
npm run test:e2e       # end-to-end tests (Playwright, real browsers)
npm run check:contrast # WCAG AA contrast over the design tokens
npm run check:bundle   # bundle budget
```

The project has **nine gates**, and a stage is not done until every
applicable one is green. They are listed in [`AGENTS.md`](AGENTS.md), and
the end-to-end suite runs against the **live public PeerJS server** in real
browsers — a mocked transport would not catch the failures that actually
happen.

### Documentation

| Document                                               | What it covers                                     |
| ------------------------------------------------------ | -------------------------------------------------- |
| [`AGENTS.md`](AGENTS.md)                               | The rules every contributor and agent works under. |
| [`docs/architecture.md`](docs/architecture.md)         | Topology, state model, message flow.               |
| [`docs/protocol.md`](docs/protocol.md)                 | The wire protocol, message by message.             |
| [`docs/deployment.md`](docs/deployment.md)             | Deploying to each host, step by step.              |
| [`docs/design-system.md`](docs/design-system.md)       | Colours, type, motion and components.              |
| [`docs/accessibility.md`](docs/accessibility.md)       | What is guaranteed, and how it is checked.         |
| [`docs/testing-strategy.md`](docs/testing-strategy.md) | The three test layers and why.                     |
| [`docs/roadmap.md`](docs/roadmap.md)                   | What is next.                                      |
| [`docs/adr/`](docs/adr/)                               | The decisions, and the reasons behind them.        |
| [`docs/research/`](docs/research/)                     | What was measured, and what it means.              |

### License

MIT. See [LICENSE](LICENSE).

---

<a name="العربية"></a>

## العربية

### ما هي هذه اللعبة

«ثور وبقر» لعبة جماعية لعدد من اللاعبين بين شخصين وثمانية أشخاص. ينشئ
أحد اللاعبين غرفة ويحصل على رمز قصير مثل `K7P4`. ينضم بقيّة اللاعبين بهذا
الرمز — أو برابط — ويتناوبون على تخمين رقم مخفي.

- **الثور** — الرقم صحيح وفي مكانه الصحيح.
- **البقرة** — الرقم صحيح لكنه في المكان الخطأ.

أول من يفك الشفرة هو الفائز.

### لماذا بُنيت هكذا

**لا يوجد خادم إطلاقًا.** اللعبة موقع ثابت، والغرفة تعيش في ذاكرة متصفح
المضيف. يتواصل اللاعبون مع المضيف مباشرة عبر **قنوات بيانات WebRTC**
(باستخدام [PeerJS](https://peerjs.com/))؛ ويُستخدم خادم الإشارات العام في
PeerJS لمقدّمة اللاعبين إلى بعضهم فقط — ولا تمرّ بيانات اللعبة عبره أبدًا.

المقايضة مقصودة وموثّقة: **عندما يغلق المضيف التبويب، تنتهي الغرفة.** هذا
هو معنى «بلا خادم»، وتُخبر اللعبة اللاعب بذلك بوضوح بدل أن تتجمّد.

### المزايا

- 🎮 واجهة أركيد متنوّرة مصمّمة للهاتف أولًا، تعمل بإبهام واحد
- 🌐 **العربية والإنجليزية**، مع تخطيط من اليمين إلى اليسار معكوس تمامًا
- 👥 حتى 8 لاعبين في غرفة واحدة
- 📶 لوحة محاولات حيّة لكل لاعب، ولوحة متصدرين، ودردشة
- 🔁 إعادة اتصال تلقائية مع عدّاد تنازلي ظاهر — لا انتظار صامت أبدًا
- 🧩 تميمة SVG أصلية، ومؤثرات صوتية مُركّبة، واهتزاز، وقصاصات احتفال
- 🪶 بلا ملفات ثنائية: اللعبة كلها بحجم **46 كيلوبايت** مضغوطة
- ♿ تباين WCAG AA، وتنقّل بلوحة المفاتيح، ودعم تقليل الحركة

### التشغيل السريع

```bash
git clone https://github.com/your-user/bulls-cows.git
cd bulls-cows
npm install
npm run dev
```

افتح <http://localhost:5173>، وأنشئ غرفة، وشارك الرابط.

### النشر

مخرجات البناء مجلد ثابت عادي. Hosts الثلاثة التالية تخدم الملف نفسه
`dist/`، ولا يحتاج أيٌّ منها إلى خادم أو دالة أو متغيّر بيئة.

- **GitHub Pages** — فعّل **Settings → Pages → Source: GitHub Actions**؛
  يتولّى الملف自己的工作 النشر تلقائيًا عند كل دفعة إلى `main`.
- **Netlify** — `npx netlify-cli deploy --prod --dir=dist`، أو اربط المستودع
  من واجهة Netlify؛ الإعداد موجود في `netlify.toml`.
- **Vercel** — `npx vercel --prod`، أو استورد المستودع؛ الإعداد موجود في
  `vercel.json`.

### بنية المشروع

| الجزء                 | المسار                 | ملاحظة                                              |
| --------------------- | ---------------------- | --------------------------------------------------- |
| قواعد اللعبة والتقييم | `src/core/`            | نقي: بلا DOM، وبلا شبكة، وبلا مؤقّتات.              |
| بروتوكول الاتصال      | `src/core/protocol.js` | المكان الوحيد الذي يرى بيانات الشبكة الخام.         |
| النقل                 | `src/net/`             | PeerJS مع مهلات وأعِد المحاولة وكشف لِيعيش الاتصال. |
| الواجهة               | `src/ui/`              | شاشات ومكوّنات مبنية بواجهة DOM.                    |
| النصوص                | `src/i18n/`            | جداول نصوص العربية والإنجليزية.                     |
| رموز التصميم          | `src/styles/main.css`  | الألوان والخطوط والحركة في مكان واحد.               |

المضيف يملك الحالة الوحيدة المعتمَدة. تُبَثّ كل تغييرات على شكل لقطة
كاملة، فيعمل المنضمّون المتأخّرون وإعادة الاتصال بلا 비용 إضافي، وتختفي
فئة كاملة من أخطاء عدم التزامن.

### التطوير

```bash
npm run verify         # الفحص الكامل: lint, format, typecheck, unit, build, contrast
npm run test           # اختبارات الوحدة
npm run test:e2e       # الاختبارات الشاملة (متصفحات حقيقية)
```

للمشروع **تسع بوّابات**، ولا تُعتبر أي مرحلة مكتملة قبل أن تكون كل بوّابة
منطبقة خضراء. البوابات موثّقة في [`AGENTS.md`](AGENTS.md).

### الترخيص

MIT. راجع [LICENSE](LICENSE).
