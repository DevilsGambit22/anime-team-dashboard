(() => {
  "use strict";

  const config = window.ANIME_TEAM_CONFIG || {};
  const state = {
    theme: localStorage.getItem("animeTeamTheme") || "crossover",
    effects: localStorage.getItem("animeTeamEffects") !== "off",
    activePage: "home",
    calendarDate: new Date(),
    matches: [],
    selectedTrack: 0,
    particles: [],
    logoClicks: 0,
    footerClicks: 0,
    keyBuffer: ""
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const themeCopy = {
    crossover: {
      title: "Three worlds are synchronized.",
      description: "Crossover mode blends ocean currents, chakra sparks, and cursed energy.",
      particle: "cross"
    },
    onepiece: {
      title: "Set sail for the Grand Line.",
      description: "Ocean currents, treasure sparks, and adventurous movement shape this theme.",
      particle: "bubble"
    },
    naruto: {
      title: "The will of the village is active.",
      description: "Chakra embers, swift movement, and mission-scroll energy define this theme.",
      particle: "ember"
    },
    jjk: {
      title: "Cursed energy is converging.",
      description: "Dark distortion, sharp energy traces, and domain-like pulses define this theme.",
      particle: "curse"
    }
  };

  function triggerBurst(count) {
    if (typeof window.burst === "function") window.burst(count);
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function setTheme(theme, announce = true) {
    if (!themeCopy[theme]) return;
    state.theme = theme;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("animeTeamTheme", theme);
    $$(".theme-buttons button").forEach(btn => btn.classList.toggle("active", btn.dataset.themeChoice === theme));
    $("#themeMessage").textContent = themeCopy[theme].title;
    $("#themeDescription").textContent = themeCopy[theme].description;
    if (announce) showToast(`${btnThemeName(theme)} theme activated`);
    triggerBurst(18);
  }

  function btnThemeName(theme) {
    return ({crossover:"Crossover", onepiece:"One Piece", naruto:"Naruto", jjk:"JJK"})[theme] || theme;
  }

  function setEffects(enabled) {
    state.effects = enabled;
    document.body.classList.toggle("effects-off", !enabled);
    const btn = $("#effectsToggle");
    btn.textContent = `Effects: ${enabled ? "On" : "Off"}`;
    btn.setAttribute("aria-pressed", String(enabled));
    localStorage.setItem("animeTeamEffects", enabled ? "on" : "off");
  }

  function openPage(page) {
    state.activePage = page;
    $$(".page").forEach(panel => panel.classList.toggle("active", panel.dataset.pagePanel === page));
    $$(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.page === page));
    if (page === "calendar") renderCalendar();
    if (page === "members") fetchNewestMembers();
  }

  function setupDragTabs() {
    const scroller = $("#tabScroller");
    if (!scroller) return;

    let pointerDown = false;
    let startX = 0;
    let startScroll = 0;
    let didDrag = false;

    scroller.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      pointerDown = true;
      didDrag = false;
      startX = event.clientX;
      startScroll = scroller.scrollLeft;
    });

    scroller.addEventListener("pointermove", event => {
      if (!pointerDown) return;
      const delta = event.clientX - startX;
      if (Math.abs(delta) < 10) return;
      didDrag = true;
      scroller.classList.add("dragging");
      scroller.scrollLeft = startScroll - delta;
      event.preventDefault();
    });

    const finishDrag = () => {
      pointerDown = false;
      scroller.classList.remove("dragging");
    };

    scroller.addEventListener("pointerup", finishDrag);
    scroller.addEventListener("pointercancel", finishDrag);
    scroller.addEventListener("pointerleave", () => {
      if (pointerDown) finishDrag();
    });

    $$(".tab", scroller).forEach(tab => {
      tab.addEventListener("click", event => {
        if (didDrag) {
          event.preventDefault();
          didDrag = false;
          return;
        }
        openPage(tab.dataset.page);
      });
    });

    scroller.addEventListener("wheel", event => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        scroller.scrollLeft += event.deltaY;
        event.preventDefault();
      }
    }, { passive: false });
  }

  async function fetchMatches() {
    const status = $("#apiStatus");
    const message = $("#calendarMessage");
    status.textContent = "Loading Chess.com matches…";
    message.textContent = "Requesting current and upcoming matches…";

    try {
      const slug = encodeURIComponent(config.clubSlug || "anime-team-3");
      const response = await fetch(`https://api.chess.com/pub/club/${slug}/matches`, {
        headers: { "Accept": "application/json" }
      });
      if (!response.ok) throw new Error(`Chess.com returned ${response.status}`);
      const data = await response.json();
      const inProgress = Array.isArray(data.in_progress) ? data.in_progress : [];
      const registered = Array.isArray(data.registered) ? data.registered : [];

      state.matches = [
        ...inProgress.map(m => normalizeMatch(m, "current")),
        ...registered.map(m => normalizeMatch(m, "upcoming"))
      ].filter(m => m.date);

      $("#currentCount").textContent = inProgress.length;
      $("#upcomingCount").textContent = registered.length;
      status.textContent = `API connected • ${state.matches.length} matches loaded`;
      message.textContent = state.matches.length
        ? `${state.matches.length} current/upcoming matches loaded from Chess.com.`
        : "No current or upcoming matches were returned.";
      renderCalendar();
    } catch (error) {
      console.error(error);
      $("#currentCount").textContent = "0";
      $("#upcomingCount").textContent = "0";
      status.textContent = "API unavailable";
      message.textContent = "Chess.com match data could not be loaded. Try Refresh Matches.";
      showToast("Chess.com match data is temporarily unavailable");
    }
  }

  function normalizeMatch(match, status) {
    const start = match.start_time ?? match.start_time_ts ?? match.start_time_timestamp ?? match.start_time_iso;
    const numericStart = Number(start);
    const startDate =
      typeof start === "number" || (typeof start === "string" && /^\d+$/.test(start))
        ? new Date((numericStart < 1e12 ? numericStart * 1000 : numericStart))
        : new Date(start);
    const url = match.url || match["@id"] || "";
    const name = match.name || match.title || opponentFromName(match) || "Club Match";
    return {
      id: url || `${name}-${start}`,
      title: name,
      date: Number.isNaN(startDate.getTime()) ? null : dateKey(startDate),
      datetime: Number.isNaN(startDate.getTime()) ? null : startDate,
      status,
      icon: status === "current" ? "⚔️" : "♟️",
      url,
      raw: match
    };
  }

  function opponentFromName(match) {
    if (match.opponent) return `vs ${match.opponent}`;
    return "";
  }

  function dateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function calendarEvents() {
    const manual = (config.manualEvents || []).map((event, index) => ({
      ...event, id: `manual-${index}`, status: "manual", datetime: new Date(`${event.date}T12:00:00`)
    }));
    return [...state.matches, ...manual];
  }

  function renderCalendar() {
    const grid = $("#calendarGrid");
    if (!grid) return;
    const year = state.calendarDate.getFullYear();
    const month = state.calendarDate.getMonth();
    $("#calendarTitle").textContent = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(state.calendarDate);

    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    const todayKey = dateKey(new Date());
    const events = calendarEvents();
    grid.innerHTML = "";

    for (let i = 0; i < 42; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const key = dateKey(day);
      const cell = document.createElement("div");
      cell.className = "calendar-day";
      cell.setAttribute("role", "gridcell");
      if (day.getMonth() !== month) cell.classList.add("outside");
      if (key === todayKey) cell.classList.add("today");

      const number = document.createElement("span");
      number.className = "day-number";
      number.textContent = day.getDate();
      cell.appendChild(number);

      const icons = document.createElement("div");
      icons.className = "event-icons";
      const dayEvents = events.filter(event => event.date === key);

      dayEvents.slice(0, 5).forEach(event => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `event-icon ${event.status || "manual"}`;
        btn.textContent = event.icon || "◆";
        btn.title = event.title;
        btn.setAttribute("aria-label", event.title);
        btn.addEventListener("click", () => showEvent(event));
        icons.appendChild(btn);
      });

      if (dayEvents.length > 5) {
        const more = document.createElement("span");
        more.className = "event-overflow";
        more.textContent = `+${dayEvents.length - 5}`;
        icons.appendChild(more);
      }

      cell.appendChild(icons);
      grid.appendChild(cell);
    }
  }

  function showEvent(event) {
    const panel = $("#eventDetails");
    const time = event.datetime && !Number.isNaN(event.datetime.getTime())
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(event.datetime)
      : event.date;
    const statusText = event.status === "current" ? "Current match" :
      event.status === "upcoming" ? "Upcoming match" : "Club event";
    panel.innerHTML = `
      <span class="card-kicker">${escapeHtml(statusText)}</span>
      <h3>${escapeHtml(event.icon || "♟")} ${escapeHtml(event.title)}</h3>
      <p><strong>Date:</strong> ${escapeHtml(time || "Date unavailable")}</p>
      ${event.time ? `<p><strong>Time:</strong> ${escapeHtml(event.time)}</p>` : ""}
      ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}
      ${event.url ? `<a href="${escapeAttr(event.url)}" target="_blank" rel="noopener">Open on Chess.com ↗</a>` : ""}
    `;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }
  function escapeAttr(value) { return escapeHtml(value); }

  function formatJoinedDate(timestamp) {
    if (!timestamp) return "Join date unavailable";
    const date = new Date(Number(timestamp) * 1000);
    if (Number.isNaN(date.getTime())) return "Join date unavailable";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
  }

  async function fetchNewestMembers() {
    const board = $("#newMemberBoard");
    const status = $("#membersStatus");
    if (!board || !status) return;

    status.textContent = "Loading newest members from Chess.com…";
    board.innerHTML = "";

    try {
      const slug = encodeURIComponent(config.clubSlug || "anime-team-3");
      const response = await fetch(`https://api.chess.com/pub/club/${slug}/members`, {
        headers: { "Accept": "application/json" }
      });
      if (!response.ok) throw new Error(`Chess.com returned ${response.status}`);

      const data = await response.json();
      const combined = [
        ...(Array.isArray(data.weekly) ? data.weekly : []),
        ...(Array.isArray(data.monthly) ? data.monthly : []),
        ...(Array.isArray(data.all_time) ? data.all_time : [])
      ];

      const unique = new Map();
      combined.forEach(member => {
        if (member?.username && !unique.has(member.username.toLowerCase())) {
          unique.set(member.username.toLowerCase(), member);
        }
      });

      const newest = [...unique.values()]
        .sort((a, b) => Number(b.joined || 0) - Number(a.joined || 0))
        .slice(0, 8);

      if (!newest.length) {
        status.textContent = "No member records were returned.";
        board.innerHTML = '<div class="member-empty">No members are available right now.</div>';
        return;
      }

      const profiles = await Promise.all(
        newest.map(async member => {
          try {
            const profileResponse = await fetch(
              `https://api.chess.com/pub/player/${encodeURIComponent(member.username)}`,
              { headers: { "Accept": "application/json" } }
            );
            return profileResponse.ok ? await profileResponse.json() : {};
          } catch {
            return {};
          }
        })
      );

      board.innerHTML = "";

      newest.forEach((member, index) => {
        const profile = profiles[index] || {};
        const card = document.createElement("a");
        card.className = "member-card";
        card.href = `https://www.chess.com/member/${encodeURIComponent(member.username)}`;
        card.target = "_blank";
        card.rel = "noopener";

        const avatar = document.createElement("div");
        avatar.className = "member-avatar";

        if (profile.avatar) {
          const image = document.createElement("img");
          image.src = profile.avatar;
          image.alt = `${member.username} avatar`;
          image.loading = "lazy";
          avatar.appendChild(image);
        } else {
          avatar.textContent = member.username.charAt(0).toUpperCase();
        }

        const body = document.createElement("div");
        body.className = "member-card-body";

        const nameRow = document.createElement("div");
        nameRow.className = "member-name-row";

        if (profile.title) {
          const title = document.createElement("span");
          title.className = "member-title";
          title.textContent = profile.title;
          nameRow.appendChild(title);
        }

        const name = document.createElement("strong");
        name.textContent = member.username;
        nameRow.appendChild(name);

        const joined = document.createElement("small");
        joined.textContent = `Joined ${formatJoinedDate(member.joined)}`;

        const meta = document.createElement("span");
        const country = profile.country ? profile.country.split("/").pop() : "";
        meta.textContent = country ? `Country: ${country}` : "View Chess.com profile";

        body.append(nameRow, joined, meta);
        card.append(avatar, body);
        board.appendChild(card);
      });

      status.textContent = `Showing the ${newest.length} newest members returned by Chess.com.`;
    } catch (error) {
      console.error("[Anime Team] New member board:", error);
      status.textContent = "Newest members could not be loaded.";
      board.innerHTML =
        '<div class="member-empty">The Chess.com API is temporarily unavailable. Try refreshing the board.</div>';
    }
  }

  function setupMusic() {
    const tracks = Array.isArray(config.music) ? config.music : [];
    const audio = $("#audioPlayer");
    const playButton = $("#playPause");
    const shuffleButton = $("#shuffleToggle");
    const repeatButton = $("#repeatToggle");
    let shuffle = false;
    let repeat = false;

    if (!audio || !playButton) return;
    audio.volume = Number($("#volumeControl")?.value || 0.75);

    function renderPlaylist() {
      const list = $("#playlist");
      if (!list) return;
      if (!tracks.length) {
        list.innerHTML = `<div class="empty-playlist">No tracks are configured. Add the five MP3 files to <code>assets/music</code>.</div>`;
        return;
      }
      list.innerHTML = "";
      tracks.forEach((track, index) => {
        const row = document.createElement("div");
        row.className = `playlist-item${index === state.selectedTrack ? " active" : ""}`;

        const info = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = track.title || "Untitled";
        const br = document.createElement("br");
        const artist = document.createElement("small");
        artist.textContent = track.artist || "Anime Team Radio";
        info.append(title, br, artist);

        const button = document.createElement("button");
        button.type = "button";
        button.textContent = index === state.selectedTrack ? "Selected" : "Play";
        button.addEventListener("click", () => loadTrack(index, true));

        row.append(info, button);
        list.appendChild(row);
      });
    }

    function loadTrack(index, autoplay = false) {
      if (!tracks.length) {
        showToast("Add the five MP3 files to assets/music first");
        return;
      }
      state.selectedTrack = (index + tracks.length) % tracks.length;
      const track = tracks[state.selectedTrack];
      audio.src = encodeURI(track.file);
      $("#trackTitle").textContent = track.title || "Untitled Track";
      $("#trackArtist").textContent = track.artist || "Anime Team Radio";
      renderPlaylist();

      if (autoplay) {
        audio.play().catch(() => showToast("Press Play to begin the radio"));
      }
    }

    function nextIndex() {
      if (!tracks.length) return 0;
      if (shuffle && tracks.length > 1) {
        let next = state.selectedTrack;
        while (next === state.selectedTrack) next = Math.floor(Math.random() * tracks.length);
        return next;
      }
      return (state.selectedTrack + 1) % tracks.length;
    }

    playButton.addEventListener("click", () => {
      if (!tracks.length) {
        showToast("Add the five MP3 files to assets/music first");
        return;
      }
      if (!audio.src) loadTrack(state.selectedTrack, false);
      if (audio.paused) audio.play().catch(() => showToast("The audio file could not be opened"));
      else audio.pause();
    });

    $("#prevTrack")?.addEventListener("click", () => loadTrack(state.selectedTrack - 1, true));
    $("#nextTrack")?.addEventListener("click", () => loadTrack(nextIndex(), true));

    shuffleButton?.addEventListener("click", () => {
      shuffle = !shuffle;
      shuffleButton.classList.toggle("active", shuffle);
      shuffleButton.setAttribute("aria-pressed", String(shuffle));
      showToast(`Shuffle ${shuffle ? "enabled" : "disabled"}`);
    });

    repeatButton?.addEventListener("click", () => {
      repeat = !repeat;
      repeatButton.classList.toggle("active", repeat);
      repeatButton.setAttribute("aria-pressed", String(repeat));
      showToast(`Repeat ${repeat ? "enabled" : "disabled"}`);
    });

    $("#volumeControl")?.addEventListener("input", e => {
      audio.volume = Number(e.target.value);
    });

    $("#seekBar")?.addEventListener("input", e => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = (Number(e.target.value) / 100) * audio.duration;
      }
    });

    audio.addEventListener("play", () => {
      playButton.textContent = "❚❚";
      playButton.setAttribute("aria-label", "Pause");
      $("#radioArtwork")?.classList.add("playing");
      $("#waveRing")?.classList.add("playing");
      $("#visualizer")?.classList.add("playing");
    });

    audio.addEventListener("pause", () => {
      playButton.textContent = "▶";
      playButton.setAttribute("aria-label", "Play");
      $("#radioArtwork")?.classList.remove("playing");
      $("#waveRing")?.classList.remove("playing");
      $("#visualizer")?.classList.remove("playing");
    });

    audio.addEventListener("timeupdate", () => {
      if ($("#currentTime")) $("#currentTime").textContent = formatTime(audio.currentTime);
      if ($("#duration")) $("#duration").textContent = formatTime(audio.duration);
      if ($("#seekBar")) {
        $("#seekBar").value =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? (audio.currentTime / audio.duration) * 100
            : 0;
      }
    });

    audio.addEventListener("ended", () => {
      if (repeat) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        loadTrack(nextIndex(), true);
      }
    });

    audio.addEventListener("error", () => {
      showToast("Audio file missing or filename does not match config.js");
    });

    renderPlaylist();
    if (tracks.length) loadTrack(0, false);
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  }

  function triggerThemeEffect() {
    if (!state.effects) return showToast("Turn effects on to activate this Easter egg");
    const cls = state.theme === "onepiece" ? "wave-mode" :
      state.theme === "naruto" ? "chakra-mode" :
      state.theme === "jjk" ? "cursed-mode" : "crossover-mode";
    document.body.classList.add(cls);
    if (state.theme === "jjk") domainExpansion();
    else if (state.theme === "onepiece") showToast("Treasure route discovered!");
    else if (state.theme === "naruto") showToast("Chakra network synchronized!");
    else showToast("Crossover resonance activated!");
    setTimeout(() => document.body.classList.remove(cls), 1400);
    triggerBurst(55);
  }

  function runScan() {
    const line = $("#scanLine");
    line.style.transition = "none";
    line.style.top = "-8px";
    line.style.opacity = "1";
    requestAnimationFrame(() => {
      line.style.transition = "top 1.05s linear, opacity .18s 1.05s";
      line.style.top = "100vh";
      line.style.opacity = "0";
    });
  }

  function slashEffect() {
    if (!state.effects) return;
    const fx = $("#slashFx");
    fx.style.transition = "none";
    fx.style.opacity = "1";
    fx.style.transform = "translateX(-120%)";
    requestAnimationFrame(() => {
      fx.style.transition = "transform .48s cubic-bezier(.2,.8,.2,1), opacity .2s .38s";
      fx.style.transform = "translateX(120%)";
      fx.style.opacity = "0";
    });
  }

  function domainExpansion() {
    const fx = $("#domainFx");
    fx.style.transition = "none";
    fx.style.opacity = "0";
    fx.style.transform = "scale(.15) rotate(-18deg)";
    requestAnimationFrame(() => {
      fx.style.transition = "transform .75s cubic-bezier(.2,.9,.2,1), opacity .3s";
      fx.style.opacity = ".88";
      fx.style.transform = "scale(1.5) rotate(12deg)";
      setTimeout(() => { fx.style.opacity = "0"; }, 650);
    });
    slashEffect();
  }

  function setupEasterEggs() {
    $("#logoEgg").addEventListener("click", () => {
      state.logoClicks++;
      triggerThemeEffect();
      if (state.logoClicks === 7) {
        showToast("Secret unlocked: Triple-World Resonance");
        setTheme("crossover", false);
        triggerBurst(120);
        domainExpansion();
        state.logoClicks = 0;
      }
    });

    $("#footerEgg").addEventListener("click", () => {
      state.footerClicks++;
      if (state.footerClicks >= 5) {
        const logo = $("#footerEgg");
        showToast("Lady Justice signature sequence activated");
        logo.classList.remove("egg-active");
        void logo.offsetWidth;
        logo.classList.add("egg-active");
        slashEffect();
        runScan();
        triggerBurst(100);
        setTimeout(() => logo.classList.remove("egg-active"), 1300);
        state.footerClicks = 0;
      }
    });

    document.addEventListener("keydown", e => {
      state.keyBuffer = (state.keyBuffer + e.key.toLowerCase()).slice(-24);
      if (state.keyBuffer.endsWith("pirateking")) {
        setTheme("onepiece"); triggerThemeEffect(); state.keyBuffer = "";
      } else if (state.keyBuffer.endsWith("hokage")) {
        setTheme("naruto"); triggerThemeEffect(); state.keyBuffer = "";
      } else if (state.keyBuffer.endsWith("domain")) {
        setTheme("jjk"); domainExpansion(); showToast("Domain Expansion"); state.keyBuffer = "";
      }
    });

    let logoPressTimer;
    $("#logoEgg").addEventListener("pointerdown", () => {
      logoPressTimer = setTimeout(() => {
        setTheme(["onepiece","naruto","jjk","crossover"][Math.floor(Math.random()*4)]);
        triggerThemeEffect();
      }, 1400);
    });
    ["pointerup","pointerleave","pointercancel"].forEach(type => $("#logoEgg").addEventListener(type, () => clearTimeout(logoPressTimer)));
  }

  function setupCanvas() {
    const canvas = $("#fxCanvas");
    const ctx = canvas.getContext("2d");
    let width = 0, height = 0;

    function resize() {
      width = canvas.width = Math.floor(innerWidth * devicePixelRatio);
      height = canvas.height = Math.floor(innerHeight * devicePixelRatio);
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }
    addEventListener("resize", resize);
    resize();

    function makeParticle(burstMode = false) {
      const type = themeCopy[state.theme].particle;
      return {
        type,
        x: burstMode ? innerWidth / 2 + (Math.random() - .5) * 180 : Math.random() * innerWidth,
        y: burstMode ? innerHeight / 2 + (Math.random() - .5) * 100 : innerHeight + 20,
        vx: (Math.random() - .5) * (burstMode ? 4.5 : 1.1),
        vy: burstMode ? (Math.random() - .5) * 4.5 : -(Math.random() * .55 + .18),
        size: Math.random() * 3.8 + 1.2,
        life: burstMode ? 85 : Math.random() * 220 + 160,
        maxLife: burstMode ? 85 : 380
      };
    }

    window.burst = count => {
      if (!state.effects) return;
      for (let i = 0; i < count; i++) state.particles.push(makeParticle(true));
    };

    function drawParticle(p) {
      const style = getComputedStyle(document.documentElement);
      const accent = style.getPropertyValue(p.type === "curse" ? "--accent-2" : p.type === "bubble" ? "--accent-3" : "--accent").trim();
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(.8, p.life / p.maxLife));
      ctx.strokeStyle = accent;
      ctx.fillStyle = accent;
      if (p.type === "bubble") {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 1.7, 0, Math.PI * 2); ctx.stroke();
      } else if (p.type === "ember") {
        ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4); ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
      } else if (p.type === "curse") {
        ctx.beginPath(); ctx.moveTo(p.x-p.size*2, p.y); ctx.lineTo(p.x+p.size*2, p.y-p.size); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }

    function frame() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      if (state.effects && state.particles.length < 42 && Math.random() < .24) state.particles.push(makeParticle());
      state.particles = state.particles.filter(p => {
        p.x += p.vx; p.y += p.vy; p.life--;
        drawParticle(p);
        return p.life > 0 && p.y > -40 && p.x > -50 && p.x < innerWidth + 50;
      });
      requestAnimationFrame(frame);
    }
    frame();
  }

  function safeRun(label, fn) {
    try {
      fn();
    } catch (error) {
      console.error(`${label} failed`, error);
    }
  }

  function init() {
    if ($("#copyrightYear")) $("#copyrightYear").textContent = new Date().getFullYear();

    safeRun("canvas", setupCanvas);
    safeRun("theme", () => setTheme(state.theme, false));
    safeRun("effects", () => setEffects(state.effects));
    safeRun("tabs", setupDragTabs);
    safeRun("music", setupMusic);
    safeRun("Easter eggs", setupEasterEggs);

    $$(".theme-buttons button").forEach(btn => {
      btn.addEventListener("click", () => setTheme(btn.dataset.themeChoice));
    });

    $$("[data-theme-jump]").forEach(btn => {
      btn.addEventListener("click", () => setTheme(btn.dataset.themeJump));
    });

    $$("[data-open-page]").forEach(btn => {
      btn.addEventListener("click", () => openPage(btn.dataset.openPage));
    });

    $("#effectsToggle")?.addEventListener("click", () => setEffects(!state.effects));
    $("#scanButton")?.addEventListener("click", runScan);
    $("#surpriseButton")?.addEventListener("click", triggerThemeEffect);
    $("#prevMonth")?.addEventListener("click", () => {
      state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
      renderCalendar();
    });
    $("#nextMonth")?.addEventListener("click", () => {
      state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
      renderCalendar();
    });
    $("#todayButton")?.addEventListener("click", () => {
      state.calendarDate = new Date();
      renderCalendar();
    });
    $("#refreshMatches")?.addEventListener("click", fetchMatches);
    $("#refreshMembers")?.addEventListener("click", fetchNewestMembers);

    safeRun("calendar", renderCalendar);
    fetchMatches().catch(error => console.error("Match refresh failed", error));
    fetchNewestMembers().catch(error => console.error("Member refresh failed", error));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
