# Anime Team Dashboard

A GitHub Pages-ready Chess.com club dashboard for Anime Team.

## Included

- Selectable Crossover, One Piece, Naruto, and JJK themes
- Distinct particles, transitions, theme effects, and Easter eggs
- Drag-to-scroll page tabs that remain clickable
- Chess.com PubAPI calendar for current and upcoming club matches
- Local music player with an easy playlist configuration
- Responsive iframe-friendly layout
- Footer credit for DevilsGambit22 and And Chess For All Official
- No Supabase or database required

## Upload to GitHub

1. Create a new public repository, for example `anime-team-dashboard`.
2. Upload everything inside this folder to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)`.
6. Save and wait for the GitHub Pages URL.

Your URL will normally look like:

`https://YOUR-USERNAME.github.io/anime-team-dashboard/`

## Chess.com iframe

Replace `YOUR-USERNAME` with the GitHub account hosting the repository:

```html
<!-- Anime Team Dashboard -->
<p>
  <iframe
    width="100%"
    height="1500"
    style="border:0;border-radius:28px;"
    src="https://YOUR-USERNAME.github.io/anime-team-dashboard/"
    scrolling="no">
  </iframe>
</p>
```

Increase the height if the embedded content is cut off.

## Add music

1. Put an MP3, OGG, or WAV file in `assets/music/`.
2. Open `config.js`.
3. Add an entry:

```js
music: [
  {
    title: "Grand Line Adventure",
    artist: "Artist Name",
    file: "assets/music/grand-line-adventure.mp3"
  }
]
```

Use lowercase filenames without spaces when possible.

The browser will not autoplay music before a visitor interacts with the page. This is normal browser behavior.

## Match calendar

The calendar requests:

`https://api.chess.com/pub/club/anime-team-3/matches`

It uses the API's `in_progress` and `registered` collections for current and upcoming matches.

If the API is unavailable, the rest of the dashboard continues working and a refresh button remains available.

## Optional manual events

Manual events can be added in `config.js`. They do not require Supabase:

```js
manualEvents: [
  {
    date: "2026-08-15",
    title: "Anime Team Community Night",
    icon: "🎉",
    time: "8:00 PM",
    description: "A special community event.",
    url: "https://www.chess.com/club/anime-team-3"
  }
]
```

## Easter eggs

Some are discovered through:

- Repeated logo clicks
- Long-pressing the logo
- Repeated footer chess-piece clicks
- Theme-related keyboard phrases
- The Surprise button

All major effects respect the Effects toggle and reduced-motion browser settings.
