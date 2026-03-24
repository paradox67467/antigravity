/* =============================================
   VIBEIFY — Main Application Logic
   YouTube Data API v3 + YouTube IFrame Player
   ============================================= */

// ──────────────────────────────────────
// STATE
// ──────────────────────────────────────
let API_KEY = 'AIzaSyDHCdt56hX8AKwNu851-XowElswAQJuhF4';
let ytPlayer = null;
let ytReady = false;

let currentTrack = null;
let queue = [];
let queueIndex = -1;
let isPlaying = false;
let isShuffle = false;
let repeatMode = 0; // 0=off 1=all 2=one
let isMuted = false;
let currentVolume = 80;
let progressTimer = null;
let searchDebounceTimer = null;
let lastPage = 'home';
let currentPage = 'home';

let likedTracks = JSON.parse(localStorage.getItem('vibeify_liked') || '[]');
let historyTracks = JSON.parse(localStorage.getItem('vibeify_history') || '[]');
let userPlaylists = JSON.parse(localStorage.getItem('vibeify_playlists') || '[]');
let allSearchResults = [];

const GENRES = [
  { name: 'Pop', emoji: '🎵', color: 'linear-gradient(135deg,#1ed760,#17b34f)' },
  { name: 'Hip-Hop', emoji: '🎤', color: 'linear-gradient(135deg,#ff6b35,#f7c59f)' },
  { name: 'EDM', emoji: '⚡', color: 'linear-gradient(135deg,#7928ca,#ff0080)' },
  { name: 'Rock', emoji: '🎸', color: 'linear-gradient(135deg,#2c3e50,#e74c3c)' },
  { name: 'Lo-Fi', emoji: '🌙', color: 'linear-gradient(135deg,#3d5a80,#98c1d9)' },
  { name: 'R&B', emoji: '❤️', color: 'linear-gradient(135deg,#8b0000,#ff4d6d)' },
  { name: 'Jazz', emoji: '🎺', color: 'linear-gradient(135deg,#4a4e69,#c9ada7)' },
  { name: 'K-Pop', emoji: '💜', color: 'linear-gradient(135deg,#6a0dad,#e040fb)' },
  { name: 'Classical', emoji: '🎻', color: 'linear-gradient(135deg,#1a1a2e,#c0a060)' },
  { name: 'Bollywood', emoji: '🎬', color: 'linear-gradient(135deg,#ff9933,#138808)' },
  { name: 'Indie', emoji: '🌿', color: 'linear-gradient(135deg,#2d6a4f,#95d5b2)' },
  { name: 'Metal', emoji: '🤘', color: 'linear-gradient(135deg,#212121,#616161)' },
];

const QUICK_QUERIES = [
  'top hits 2024', 'viral songs', 'best songs 2025',
  'chill vibes', 'workout music', 'party anthems',
  'midnight drive', 'rainy day playlist'
];

const TRENDING_QUERY = 'top music hits 2025';

// ──────────────────────────────────────
// INIT
// ──────────────────────────────────────
function init() {
  setGreeting();
  buildGenreGrids();
  renderPlaylists();
  launchApp();
}

function launchApp() {
  const overlay = document.getElementById('api-overlay');
  if (overlay) overlay.style.display = 'none';
  document.getElementById('app').classList.remove('hidden');
  loadHomeContent();
}

// ──────────────────────────────────────
// GREETING
// ──────────────────────────────────────
function setGreeting() {
  const h = new Date().getHours();
  const el = document.getElementById('greeting-text');
  if (!el) return;
  if (h < 12) el.textContent = 'Good Morning ☀️';
  else if (h < 17) el.textContent = 'Good Afternoon 🌤️';
  else el.textContent = 'Good Evening 🌙';
}

// ──────────────────────────────────────
// NAVIGATION
// ──────────────────────────────────────
function navigateTo(page) {
  if (page !== 'now-playing') lastPage = page;
  currentPage = page;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const navBtn = document.querySelector(`[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  // Hide bottom player bar on now-playing page (has its own controls)
  const playerBar = document.getElementById('player-bar');
  if (playerBar) playerBar.classList.toggle('bar-hidden', page === 'now-playing');

  if (page === 'library') refreshLibrary();
  if (page === 'now-playing') refreshNowPlaying();
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.style.width = (sidebar.style.width === '72px') ? 'var(--sidebar-width)' : '72px';
}

// ──────────────────────────────────────
// HOME CONTENT
// ──────────────────────────────────────
async function loadHomeContent() {
  loadQuickPicks();
  loadTrending();
}

async function loadQuickPicks() {
  const container = document.getElementById('quick-picks');
  container.innerHTML = '';
  // Show skeletons
  for (let i = 0; i < 8; i++) {
    const sk = document.createElement('div');
    sk.className = 'quick-pick-item';
    sk.innerHTML = `<div class="skeleton" style="width:56px;height:56px;border-radius:0;flex-shrink:0"></div><div style="flex:1;padding:0 12px 0 0"><div class="skeleton" style="height:14px;width:80%;margin-bottom:6px"></div><div class="skeleton" style="height:12px;width:50%"></div></div>`;
    container.appendChild(sk);
  }

  const query = QUICK_QUERIES[Math.floor(Math.random() * QUICK_QUERIES.length)];
  const results = await ytSearch(query, 8);
  container.innerHTML = '';
  results.forEach(item => {
    const el = document.createElement('div');
    el.className = 'quick-pick-item';
    el.onclick = () => playTrack(item);
    el.oncontextmenu = (e) => showContextMenu(e, item);
    el.innerHTML = `
      <img class="qp-thumb" src="${item.thumb}" alt="" loading="lazy" />
      <div class="qp-info">
        <div class="qp-title">${escHTML(item.title)}</div>
      </div>
      <div class="qp-play">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </div>
    `;
    container.appendChild(el);
  });
}

async function loadTrending() {
  const grid = document.getElementById('trending-grid');
  grid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  const results = await ytSearch(TRENDING_QUERY, 12);
  renderCards(grid, results);
  // also load queue context
  queue = results;
}

function renderCards(container, items) {
  container.innerHTML = '';
  if (!items.length) {
    container.innerHTML = '<p style="color:var(--white-40);padding:20px;grid-column:1/-1">No results found.</p>';
    return;
  }
  items.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'music-card';
    el.onclick = () => { queue = items; queueIndex = i; playTrack(item); };
    el.oncontextmenu = (e) => showContextMenu(e, item);
    el.innerHTML = `
      <div class="card-art-wrap">
        <img class="card-art" src="${item.thumb}" alt="" loading="lazy" />
        <div class="card-play">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
      <div class="card-title">${escHTML(item.title)}</div>
      <div class="card-subtitle">${escHTML(item.channel)}</div>
    `;
    container.appendChild(el);
  });
}

function buildGenreGrids() {
  [document.getElementById('genre-grid'), document.getElementById('browse-genres')].forEach(el => {
    if (!el) return;
    GENRES.forEach(g => {
      const btn = document.createElement('button');
      btn.className = 'genre-pill';
      btn.style.background = g.color;
      btn.onclick = () => searchGenre(g.name);
      btn.innerHTML = `<span>${g.emoji} ${g.name}</span>`;
      el.appendChild(btn);
    });
  });
}

// ──────────────────────────────────────
// SEARCH
// ──────────────────────────────────────
let searchDebounce = null;

function debounceSearch(val) {
  const clearBtn = document.getElementById('clear-search-btn');
  clearBtn.style.display = val ? 'block' : 'none';

  document.getElementById('topbar-search').value = val;

  clearTimeout(searchDebounce);
  if (!val.trim()) {
    showSearchBrowse();
    return;
  }
  searchDebounce = setTimeout(() => performSearch(val.trim()), 450);
}

function handleTopbarSearch(val) {
  if (currentPage !== 'search') navigateTo('search');
  const searchInput = document.getElementById('search-input');
  searchInput.value = val;
  debounceSearch(val);
}

function clearSearch() {
  document.getElementById('search-input').value = '';
  document.getElementById('topbar-search').value = '';
  document.getElementById('clear-search-btn').style.display = 'none';
  showSearchBrowse();
}

function showSearchBrowse() {
  document.getElementById('search-browse').classList.remove('hidden');
  document.getElementById('search-results-wrap').classList.add('hidden');
}

async function performSearch(query) {
  document.getElementById('search-browse').classList.add('hidden');
  document.getElementById('search-results-wrap').classList.remove('hidden');

  const resultsEl = document.getElementById('search-results');
  resultsEl.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  document.getElementById('results-count-label').textContent = `Results for "${query}"`;

  allSearchResults = await ytSearch(query, 20);
  renderTrackList(resultsEl, allSearchResults, 'search');
  queue = allSearchResults;
}

function searchGenre(genre) {
  navigateTo('search');
  const input = document.getElementById('search-input');
  input.value = genre + ' music playlist';
  document.getElementById('clear-search-btn').style.display = 'block';
  debounceSearch(input.value);
}

function filterResults(type, btn) {
  document.querySelectorAll('.results-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const filtered = type === 'all' ? allSearchResults :
    allSearchResults.filter(r => r.type === type || (type === 'song' && r.type === 'video'));

  renderTrackList(document.getElementById('search-results'), filtered, 'search');
}

// ──────────────────────────────────────
// TRACK LIST RENDERING
// ──────────────────────────────────────
function renderTrackList(container, items, context) {
  container.innerHTML = '';
  if (!items.length) {
    container.innerHTML = '<p style="color:var(--white-40);padding:24px">No tracks found.</p>';
    return;
  }
  items.forEach((item, i) => {
    const isLiked = likedTracks.some(t => t.id === item.id);
    const isNowPlaying = currentTrack && currentTrack.id === item.id;

    const el = document.createElement('div');
    el.className = 'track-item' + (isNowPlaying ? ' playing' : '');
    el.id = `track-${item.id}`;
    el.onclick = () => { queue = items; queueIndex = i; playTrack(item); };
    el.oncontextmenu = (e) => showContextMenu(e, item);

    el.innerHTML = `
      <div class="track-num">${i + 1}</div>
      <button class="track-play-btn" style="display:none" aria-label="Play">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </button>
      <div class="track-bars" style="${isNowPlaying ? 'display:flex' : 'display:none'}">
        <span></span><span></span><span></span>
      </div>
      <img class="track-art" src="${item.thumb}" alt="" loading="lazy" />
      <div class="track-info">
        <div class="track-title" title="${escAttr(item.title)}">${escHTML(item.title)}</div>
        <div class="track-artist">${escHTML(item.channel)}</div>
      </div>
      <span class="track-dur">${item.duration || ''}</span>
      <button class="track-like ${isLiked ? 'liked' : ''}" onclick="toggleLikeItem(event, '${item.id}')" title="${isLiked ? 'Unlike' : 'Like'}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/></svg>
      </button>
    `;
    container.appendChild(el);
  });
}

// ──────────────────────────────────────
// PLAYBACK
// ──────────────────────────────────────
function playTrack(track) {
  if (!track) return;
  currentTrack = track;

  // Find index in queue
  const idx = queue.findIndex(t => t.id === track.id);
  if (idx !== -1) queueIndex = idx;

  // Add to history
  historyTracks = historyTracks.filter(t => t.id !== track.id);
  historyTracks.unshift(track);
  if (historyTracks.length > 50) historyTracks = historyTracks.slice(0, 50);
  localStorage.setItem('vibeify_history', JSON.stringify(historyTracks));

  // Update UI
  updatePlayerBar(track);
  updateNowPlaying(track);
  updateActiveTrack(track.id);

  // YouTube
  if (ytPlayer && ytReady) {
    ytPlayer.loadVideoById(track.id);
    isPlaying = true;
    ytPlayer.setVolume(currentVolume);
    updatePlayIcons(true);
  }

  startProgressUpdater();
}

function togglePlay() {
  if (!ytPlayer || !currentTrack) return;
  if (isPlaying) {
    ytPlayer.pauseVideo();
    isPlaying = false;
    stopProgressUpdater();
  } else {
    ytPlayer.playVideo();
    isPlaying = true;
    startProgressUpdater();
  }
  updatePlayIcons(isPlaying);
}

function nextTrack() {
  if (!queue.length) return;
  if (repeatMode === 2 && currentTrack) { playTrack(currentTrack); return; }

  let nextIdx;
  if (isShuffle) {
    nextIdx = Math.floor(Math.random() * queue.length);
  } else {
    nextIdx = (queueIndex + 1) % queue.length;
  }
  queueIndex = nextIdx;
  playTrack(queue[queueIndex]);
}

function prevTrack() {
  if (!queue.length) return;
  // If more than 3s into track, restart
  if (ytPlayer && ytReady && ytPlayer.getCurrentTime() > 3) {
    ytPlayer.seekTo(0);
    return;
  }
  let prevIdx = (queueIndex - 1 + queue.length) % queue.length;
  queueIndex = prevIdx;
  playTrack(queue[queueIndex]);
}

function toggleShuffle() {
  isShuffle = !isShuffle;
  document.getElementById('shuffle-btn')?.classList.toggle('active', isShuffle);
  document.getElementById('shuffle-btn-full')?.classList.toggle('active', isShuffle);
  showToast(isShuffle ? 'Shuffle on' : 'Shuffle off');
}

function toggleRepeat() {
  repeatMode = (repeatMode + 1) % 3;
  const labels = ['Repeat off', 'Repeat all', 'Repeat one'];
  showToast(labels[repeatMode]);
  updateRepeatBtn();
}

function updateRepeatBtn() {
  ['repeat-btn', 'repeat-btn-full'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.classList.toggle('active', repeatMode > 0);
    btn.style.opacity = repeatMode === 0 ? '0.6' : '1';
  });
}

function setVolume(val) {
  currentVolume = parseInt(val);
  if (ytPlayer && ytReady) ytPlayer.setVolume(currentVolume);
  document.getElementById('volume').value = currentVolume;
  const npVol = document.getElementById('np-volume');
  if (npVol) npVol.value = currentVolume;
  isMuted = currentVolume === 0;
}

function muteToggle() {
  if (isMuted) {
    setVolume(currentVolume || 70);
    isMuted = false;
  } else {
    if (ytPlayer && ytReady) ytPlayer.setVolume(0);
    isMuted = true;
  }
}

function seekTo(e, wrap) {
  if (!ytPlayer || !ytReady || !currentTrack) return;
  const rect = wrap.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const dur = ytPlayer.getDuration() || 0;
  ytPlayer.seekTo(dur * ratio, true);
}

// ──────────────────────────────────────
// PROGRESS UPDATER
// ──────────────────────────────────────
function startProgressUpdater() {
  stopProgressUpdater();
  progressTimer = setInterval(() => {
    if (!ytPlayer || !ytReady || !isPlaying) return;
    const cur = ytPlayer.getCurrentTime() || 0;
    const dur = ytPlayer.getDuration() || 0;
    if (!dur) return;

    const pct = (cur / dur) * 100;

    // Bottom bar
    const pb = document.getElementById('progress-bar');
    if (pb) pb.style.width = pct + '%';
    document.getElementById('current-time').textContent = formatTime(cur);
    document.getElementById('duration').textContent = formatTime(dur);

    // Full player
    const npPb = document.getElementById('np-progress');
    if (npPb) npPb.style.width = pct + '%';
    const npCt = document.getElementById('np-current-time');
    if (npCt) npCt.textContent = formatTime(cur);
    const npDur = document.getElementById('np-duration');
    if (npDur) npDur.textContent = formatTime(dur);
  }, 500);
}

function stopProgressUpdater() {
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
}

// ──────────────────────────────────────
// YOUTUBE IFRAME API
// ──────────────────────────────────────
function onYouTubeIframeAPIReady() {
  ytPlayer = new YT.Player('yt-player', {
    height: '1',
    width: '1',
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      origin: window.location.origin || 'http://localhost:7890',
      enablejsapi: 1,
      playsinline: 1,
    },
    events: {
      onReady: (e) => { ytReady = true; e.target.setVolume(currentVolume); },
      onStateChange: onPlayerStateChange,
      onError: onPlayerError,
    }
  });
}

function onPlayerStateChange(e) {
  // YT.PlayerState: ENDED=0, PLAYING=1, PAUSED=2, BUFFERING=3
  if (e.data === YT.PlayerState.ENDED) {
    if (repeatMode === 2) { ytPlayer.playVideo(); return; }
    nextTrack();
  }
  if (e.data === YT.PlayerState.PLAYING) {
    isPlaying = true;
    skipErrorCount = 0; // reset on successful play
    updatePlayIcons(true);
    startProgressUpdater();
  }
  if (e.data === YT.PlayerState.PAUSED) {
    isPlaying = false;
    updatePlayIcons(false);
    stopProgressUpdater();
  }
}

let skipErrorCount = 0;
function onPlayerError(e) {
  // YT error codes: 2=bad param, 5=html5, 100=not found, 101/150=not embeddable
  console.warn('YT Player error code:', e.data);
  skipErrorCount++;
  if (skipErrorCount <= 3) {
    // Silently skip to next without toast spam
    setTimeout(nextTrack, 800);
  } else {
    skipErrorCount = 0;
    showToast('Some tracks are restricted. Try searching for another song.');
  }
}

// ──────────────────────────────────────
// YOUTUBE DATA API v3
// ──────────────────────────────────────
async function ytSearch(query, maxResults = 10) {
  if (!API_KEY) return [];
  try {
    // videoEmbeddable=true ensures only videos that can be played in iframe are returned
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&maxResults=${maxResults}&key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json();
      console.error('YT API error:', err);
      if (err.error?.code === 403) showToast('API quota exceeded. Try again later.');
      else if (err.error?.code === 400) showToast('Invalid API key. Please check your key.');
      return [];
    }
    const data = await res.json();
    return (data.items || []).map(item => {
      const thumbs = item.snippet.thumbnails || {};
      // Use best available quality: maxres > standard > high > medium > default
      const thumb = (thumbs.maxres || thumbs.standard || thumbs.high || thumbs.medium || thumbs.default)?.url || '';
      return {
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumb,
        type: 'video',
        duration: '',
      };
    });
  } catch (err) {
    console.error('Fetch error:', err);
    showToast('Network error. Check your connection.');
    return [];
  }
}

// ──────────────────────────────────────
// LIKE
// ──────────────────────────────────────
function toggleLike() {
  if (!currentTrack) return;
  toggleLikeItem(null, currentTrack.id, currentTrack);
}

function toggleLikeItem(e, id, trackData) {
  if (e) e.stopPropagation();

  const track = trackData || queue.find(t => t.id === id) || allSearchResults.find(t => t.id === id) || currentTrack;
  if (!track) return;

  const idx = likedTracks.findIndex(t => t.id === id);
  if (idx === -1) {
    likedTracks.unshift(track);
    showToast('❤️ Added to Liked Songs');
  } else {
    likedTracks.splice(idx, 1);
    showToast('Removed from Liked Songs');
  }
  localStorage.setItem('vibeify_liked', JSON.stringify(likedTracks));
  refreshLikeButtons();
}

function refreshLikeButtons() {
  const isLiked = currentTrack && likedTracks.some(t => t.id === currentTrack.id);
  ['like-btn-big', 'like-btn-small'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.classList.toggle('liked', isLiked);
    const svg = btn.querySelector('svg');
    if (svg) svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
  });

  // Update track list items
  document.querySelectorAll('.track-like').forEach(btn => {
    const trackId = btn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
    if (!trackId) return;
    const liked = likedTracks.some(t => t.id === trackId);
    btn.classList.toggle('liked', liked);
    const svg = btn.querySelector('svg');
    if (svg) svg.setAttribute('fill', liked ? 'currentColor' : 'none');
  });
}

// ──────────────────────────────────────
// PLAYLISTS
// ──────────────────────────────────────
function createPlaylist() {
  document.getElementById('playlist-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('playlist-name-input').focus(), 50);
}

function cancelPlaylist() {
  document.getElementById('playlist-modal').classList.add('hidden');
  document.getElementById('playlist-name-input').value = '';
}

function confirmCreatePlaylist() {
  const name = document.getElementById('playlist-name-input').value.trim();
  if (!name) { showToast('Please enter a name'); return; }
  const playlist = { id: Date.now().toString(), name, tracks: [], created: new Date().toISOString() };
  userPlaylists.unshift(playlist);
  localStorage.setItem('vibeify_playlists', JSON.stringify(userPlaylists));
  cancelPlaylist();
  renderPlaylists();
  showToast(`✅ Created: ${name}`);
}

function renderPlaylists() {
  const list = document.getElementById('user-playlists');
  if (!list) return;
  list.innerHTML = '';
  userPlaylists.slice(0, 10).forEach(pl => {
    const btn = document.createElement('button');
    btn.className = 'playlist-item';
    btn.onclick = () => openPlaylist(pl.id);
    btn.innerHTML = `
      <div class="playlist-icon">${pl.emoji || '🎵'}</div>
      <span>${escHTML(pl.name)}</span>
    `;
    list.appendChild(btn);
  });
}

function openPlaylist(id) {
  if (id === 'liked') {
    navigateTo('library');
    showLibraryTab('liked', document.querySelector('.library-tabs .tab-btn'));
  }
}

// ──────────────────────────────────────
// LIBRARY
// ──────────────────────────────────────
function showLibraryTab(tab, btn) {
  document.querySelectorAll('.library-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.library-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`library-${tab}`)?.classList.add('active');
  btn?.classList.add('active');
  refreshLibrary(tab);
}

function refreshLibrary(tab) {
  // Liked
  const likedList = document.getElementById('liked-tracks-list');
  const likedEmpty = document.getElementById('liked-empty');
  if (likedList) {
    if (likedTracks.length) {
      likedList.classList.remove('hidden');
      likedEmpty?.classList.add('hidden');
      renderTrackList(likedList, likedTracks, 'liked');
    } else {
      likedList.classList.add('hidden');
      likedEmpty?.classList.remove('hidden');
    }
  }

  // History
  const histList = document.getElementById('history-list');
  const histEmpty = document.getElementById('history-empty');
  if (histList) {
    if (historyTracks.length) {
      histList.classList.remove('hidden');
      histEmpty?.classList.add('hidden');
      renderTrackList(histList, historyTracks, 'history');
    } else {
      histList.classList.add('hidden');
      histEmpty?.classList.remove('hidden');
    }
  }

  // Playlists
  const grid = document.getElementById('playlists-grid');
  if (grid) {
    grid.innerHTML = '';
    userPlaylists.forEach(pl => {
      const card = document.createElement('div');
      card.className = 'playlist-card';
      card.innerHTML = `
        <div class="playlist-card-art">🎵</div>
        <div class="playlist-card-name">${escHTML(pl.name)}</div>
        <div class="playlist-card-count">${pl.tracks.length} tracks</div>
      `;
      grid.appendChild(card);
    });
  }
}

// ──────────────────────────────────────
// NOW PLAYING UI — FULL PLAYER
// ──────────────────────────────────────
function refreshNowPlaying() {
  if (!currentTrack) return;
  updateNowPlaying(currentTrack);
  renderNowPlayingQueue();
}

function updateNowPlaying(track) {
  const npArt = document.getElementById('np-art');
  const npBg = document.getElementById('np-art-bg');
  const npTitle = document.getElementById('np-title');
  const npChannel = document.getElementById('np-channel');
  if (npArt) npArt.src = track.thumb;
  if (npBg) npBg.style.backgroundImage = `url(${track.thumb})`;
  if (npTitle) npTitle.textContent = track.title;
  if (npChannel) npChannel.textContent = track.channel;
  refreshLikeButtons();
}

function renderNowPlayingQueue() {
  const list = document.getElementById('np-queue-list');
  if (!list) return;
  const upcoming = queue.slice(queueIndex + 1, queueIndex + 8);
  renderTrackList(list, upcoming, 'queue');
}

// ──────────────────────────────────────
// PLAYER BAR UI
// ──────────────────────────────────────
function updatePlayerBar(track) {
  document.getElementById('player-thumb').src = track.thumb;
  document.getElementById('player-title').textContent = track.title;
  document.getElementById('player-artist').textContent = track.channel;
  refreshLikeButtons();
}

function updatePlayIcons(playing) {
  const playPath = '<path d="M8 5v14l11-7z"/>';
  const pausePath = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';

  ['play-icon', 'play-icon-full'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = playing ? pausePath : playPath;
  });
}

function updateActiveTrack(id) {
  document.querySelectorAll('.track-item').forEach(el => {
    el.classList.remove('playing');
    el.querySelector('.track-bars')?.setAttribute('style', 'display:none');
  });
  const active = document.getElementById(`track-${id}`);
  if (active) {
    active.classList.add('playing');
    active.querySelector('.track-bars')?.setAttribute('style', 'display:flex');
    active.querySelector('.track-num')?.setAttribute('style', 'display:none');
  }
}

// ──────────────────────────────────────
// CONTEXT MENU
// ──────────────────────────────────────
function showContextMenu(e, track) {
  e.preventDefault();
  removeContextMenu();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.id = 'ctx-menu';

  const isLiked = likedTracks.some(t => t.id === track.id);

  menu.innerHTML = `
    <div class="ctx-item" onclick="playTrack(${JSON.stringify(track).replace(/"/g, '&quot;')});removeContextMenu()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Play Now
    </div>
    <div class="ctx-item" onclick="addToQueue(${JSON.stringify(track).replace(/"/g, '&quot;')});removeContextMenu()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h12M4 18h8"/></svg> Add to Queue
    </div>
    <div class="ctx-item" onclick="toggleLikeItem(null,'${track.id}');removeContextMenu()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/></svg>
      ${isLiked ? 'Unlike' : 'Like'}
    </div>
    <div class="ctx-item" onclick="openInYoutube('${track.id}');removeContextMenu()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 00-3.77-3.37C14.36 3 12 3 12 3s-2.36 0-3.82.32a4.83 4.83 0 00-3.77 3.37A49.86 49.86 0 004 12a49.86 49.86 0 00.41 5.31 4.83 4.83 0 003.77 3.37C9.64 21 12 21 12 21s2.36 0 3.82-.32a4.83 4.83 0 003.77-3.37A49.86 49.86 0 0020 12a49.86 49.86 0 00-.41-5.31z"/><path fill="white" d="M10 15l5.19-3L10 9v6z"/></svg>
      Open on YouTube
    </div>
  `;

  menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - 200) + 'px';

  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', removeContextMenu, { once: true }), 0);
}

function removeContextMenu() {
  document.getElementById('ctx-menu')?.remove();
}

function addToQueue(track) {
  queue.splice(queueIndex + 1, 0, track);
  showToast('Added to queue');
}

function openInYoutube(id) {
  window.open(`https://www.youtube.com/watch?v=${id}`, '_blank');
}

// ──────────────────────────────────────
// KEYBOARD SHORTCUTS
// ──────────────────────────────────────
document.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      togglePlay();
      break;
    case 'ArrowRight':
      if (e.shiftKey) nextTrack();
      break;
    case 'ArrowLeft':
      if (e.shiftKey) prevTrack();
      break;
    case 'KeyL':
      toggleLike();
      break;
    case 'KeyS':
      toggleShuffle();
      break;
    case 'KeyR':
      toggleRepeat();
      break;
    case 'ArrowUp':
      e.preventDefault();
      setVolume(Math.min(100, currentVolume + 5));
      break;
    case 'ArrowDown':
      e.preventDefault();
      setVolume(Math.max(0, currentVolume - 5));
      break;
    case 'KeyM':
      muteToggle();
      break;
    case 'Escape':
      removeContextMenu();
      break;
  }
});

// ──────────────────────────────────────
// TOAST
// ──────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ──────────────────────────────────────
// HELPERS
// ──────────────────────────────────────
function escHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ──────────────────────────────────────
// PLAYLIST MODAL KEYBOARD
// ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('playlist-name-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmCreatePlaylist();
    if (e.key === 'Escape') cancelPlaylist();
  });

  document.getElementById('api-key-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitApiKey();
  });

  // Close modal on overlay click
  document.getElementById('playlist-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'playlist-modal') cancelPlaylist();
  });

  init();
});

// ──────────────────────────────────────
// TOPBAR SEARCH WIRING
// ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const topbar = document.getElementById('topbar-search');
  topbar?.addEventListener('focus', () => {
    if (currentPage !== 'search') navigateTo('search');
  });
});
