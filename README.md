# The Golden Umbrella (Deluxe)

> A cozy 2D side-scroller for the **"What Are You Thankful For?"** community coding challenge.
> Vanilla HTML5 Canvas, CSS and ES6 JavaScript. **No libraries, images or audio files.** Open `index.html` and play.

## Theme & Inspiration

Gratitude is rarely a grand gesture. More often it is someone holding out an umbrella in the rain. The Golden Umbrella turns that
idea into a mechanic: a cold, rainy street is literally lit up, one kindness at a time. Being helped gives you a golden aura,
and passing that warmth on to a baker, a chilly kid and a street musician transforms Maple Lane from slate-blue dusk to a golden
autumn evening. At the end you turn the feeling into a keepsake: a vintage-style postcard of the street you lit up.

## Features

- **Three-layer parallax:** misty hills and rooftops (0.2x), cozy cottages with glowing window cut-outs (0.5x), and the sidewalk, lamps and trees (1.0x).
- **Dual-state world:** the street is a rainy dusk until warmth arrives. Each `LightZone` expands outward over 1.2 seconds like a golden shockwave with a glowing ring, swirling autumn leaves and rising fireflies. Lit areas stay golden and the rain stops there.
- **Expressive characters:** breathing, blinking, a scarf fluttering in the breeze, a shivering player until helped, a pulsing Golden Aura, and floating hearts and sparkles over helped neighbors.
- **Title screen and HUD:** an atmospheric title over the live rainy canvas, glowing lanterns for the Warmth Progress tracker, a Memory Journal drawer listing every kindness and thank-you in `gratitudeLog`, and a sound toggle.
- **Layered procedural audio:** pink-noise rain, then a new layer per lit zone (electric-piano chords, bass, shimmering arpeggio, and finally a melody). A rising pentatonic music-box phrase plays on every kindness.
- **Vintage keepsake postcard:** textured paper, leaf border, a painted scene that includes the neighbors you helped, your message in an italic serif, a perforated stamp and postmark. Download PNG, Copy Gratitude Note, or Play Again.
- **Accessible dialogue:** everything works with mouse or keyboard (`E` / `Enter`, `1`-`9`, `Tab`).

## How to Play

1. Open `index.html` in any modern browser (no server, no build step) and press **Step Outside**.
2. Move with `A` / `D` or the arrow keys. Walk up to a neighbor and press `E` or click when `[Press E or Click]` appears.
3. Meet the Elderly Neighbor at the bus stop first. Say thanks with a button or your own words and you gain the Golden Aura.
4. Help the Baker (hold the door), the Chilly Kid (shake the branch) and the Street Musician (share warmth).
5. Walk home to your porch at the end of the street, write what you are thankful for and create your postcard.

| Key | Action |
|---|---|
| `A` `D` / arrows | Move |
| `E` / click | Interact |
| `1`-`9`, `Enter`, `Tab` | Choose in dialogue |
| `J` | Memory Journal |
| `M` | Toggle sound |

## Technical Architecture

Everything lives in `game.js` as small, single-purpose ES6 classes with JSDoc comments. All tunable numbers (sizes, speeds, zone
radius and expansion time, parallax factors, particle counts, audio levels, postcard settings) are in one frozen `CONFIG` object,
colours are in `PALETTE`, and story text is in `STORY`.

| Class | Responsibility |
|---|---|
| `Game` | State machine (`title`, `play`, `dialogue`, `finale`, `postcard`), input, camera, story flow, HUD and journal, main loop |
| `World` | Builds the three `ParallaxLayer`s and composites the cool scene with the warm scene masked by `LightZone`s |
| `ParallaxLayer` | One depth layer: camera multiplier plus a paint callback |
| `LightZone` | A warm region that expands with easing, paints a soft radial mask and a shockwave ring |
| `ParticleSystem` | Rain, ambient leaves, swirling shockwave leaves, fireflies, floating hearts and notes |
| `Player`, `NPC` | Procedurally drawn characters with idle animation and helped states |
| `InteractionManager` | HTML/CSS dialogue card with keyboard and mouse navigation |
| `SoundEngine` | Web Audio synthesis: pink-noise rain, layered chord music, music-box chimes, footsteps |
| `PostcardGenerator` | Draws the vintage postcard and builds the plain-text gratitude note |

**Dual-state rendering:** each frame draws the cool scene. If a zone exists, the warm scene is drawn to an offscreen canvas, a soft
mask is painted from each zone's current (animated) radius, `destination-in` keeps only the lit part, and the result is composited
on top. Because rain is part of the cool scene only, it vanishes wherever the light has reached.

**Why a classic script?** Browsers block `type="module"` scripts on `file://`. A single classic script keeps "just open
`index.html`" working while the code stays organised as classes.

## Files

`index.html` (markup, HUD, title, modals) · `style.css` (theme and UI) · `game.js` (the game) · `README.md`

## Mobile & Responsive

- The canvas scales to any screen width while keeping its 900x500 crisp rendering, and the page respects phone safe areas.
- Touch devices get on-screen **left/right** buttons and a **Tap** button (hidden during dialogue). Tapping the scene also interacts when a neighbor is near.
- On narrow screens the dialogue card moves below the canvas, buttons become large tap targets, and the HUD, journal drawer and modals tighten up.
- In landscape on a phone the header is hidden so the game fills the screen. In portrait a small tip suggests rotating.
