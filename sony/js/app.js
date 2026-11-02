/* ═══════════════════════════════════════════
   APP — главный контроллер
   Прогресс, переходы, запуск уровней, награда-лист
   ═══════════════════════════════════════════ */

const App = {
  overlayLayer: null,
  transitionOverlay: null,

  progress: {
    introSeen: false,
    completed: [],
    finalDone: false
  },

  STORAGE_KEY: 'sony_starlight_journey_v1',
  audioStarted: false,

  init () {
    this.overlayLayer = document.getElementById('overlay-layer');
    this.transitionOverlay = document.getElementById('transition-overlay');

    this._loadProgress();

    // Графика карты
    Menu.init();

    // Разблокировка Web Audio по первому касанию
    const unlock = (e) => {
      if (this.audioStarted) return;
      this.audioStarted = true;
      const ok = AudioEngine.init();
      AudioEngine.resume();
      if (ok) {
        AudioEngine.crossfadeTo('menu');
      }
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('mousedown', unlock);
    };
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('mousedown', unlock, { passive: true });

    const hasProgress = this.progress.introSeen || this.progress.completed.length > 0;

    Menu.showInitialMenu(
      hasProgress,
      () => this.onStartClicked(hasProgress),
      () => this.restartGame()
    );
  },

  _loadProgress () {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          this.progress.introSeen = !!saved.introSeen;
          this.progress.completed = Array.isArray(saved.completed) ? saved.completed.filter(n => [0,1,2,3].includes(n)) : [];
          this.progress.finalDone = !!saved.finalDone;
        }
      }
    } catch (e) {
      console.warn('progress load failed', e);
    }

    if (CONFIG.DEV_UNLOCK_ALL) {
      this.progress.introSeen = true;
      this.progress.completed = [0, 1, 2];
      this.progress.finalDone = false;
    }
  },

  _saveProgress () {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.progress));
    } catch (e) {
      console.warn('progress save failed', e);
    }
  },

  _ensureAudio () {
    if (this.audioStarted) {
      AudioEngine.resume();
      return;
    }
    this.audioStarted = true;
    AudioEngine.init();
    AudioEngine.resume();
    AudioEngine.crossfadeTo('menu');
  },

  onStartClicked (hasProgress) {
    this._ensureAudio();

    if (hasProgress && this.progress.introSeen) {
      this.openMapScreen();
      return;
    }

    Menu.playIntroSequence(() => {
      this.progress.introSeen = true;
      this._saveProgress();
      this.openMapScreen();
    });
  },

  openMapScreen () {
    this._ensureAudio();
    const curIdx = this._getCurrentLevelIndex();
    AudioEngine.crossfadeTo('menu');

    Menu.setupMap(this.progress.completed, curIdx, (starIdx, state) => {
      if (state === 'completed') {
        if (starIdx < 3) {
          this.openSheet(starIdx);
        } else {
          this.startLevelFlow(starIdx);
        }
        return;
      }
      this.startLevelFlow(starIdx);
    }, () => this.returnToMenu());
  },

  _getCurrentLevelIndex () {
    for (let i = 0; i < 4; i++) {
      if (!this.progress.completed.includes(i)) return i;
    }
    return 3;
  },

  startLevelFlow (levelIdx) {
    this._ensureAudio();
    this.overlayLayer.innerHTML = '';
    this.overlayLayer.classList.add('hidden');

    const isFinal = levelIdx === 3;
    Menu.flyIntoStar(levelIdx, () => {
      this._showLevelTitle(levelIdx, () => {
        this._launchLevel(levelIdx);
      }, isFinal);
    }, isFinal ? { duration: 2800, zoom: 3.0 } : undefined);
  },

  _showLevelTitle (levelIdx, onDone, longHold) {
    const titleText = levelIdx < 3 ? CONFIG.LEVEL_TITLES[levelIdx] : CONFIG.FINAL_TITLE;

    this.overlayLayer.innerHTML = '';
    this.overlayLayer.classList.remove('hidden');

    const title = document.createElement('div');
    title.className = 'level-title-screen';
    title.textContent = titleText;
    this.overlayLayer.appendChild(title);

    const trans = this.transitionOverlay;
    trans.classList.remove('active');

    requestAnimationFrame(() => {
      title.style.opacity = '1';
    });

    setTimeout(() => {
      title.style.opacity = '0';
      setTimeout(() => {
        if (title.parentNode) title.remove();
        if (onDone) onDone();
      }, longHold ? 1200 : 900);
    }, longHold ? 3800 : 2650);
  },

  _launchLevel (levelIdx) {
    this.overlayLayer.innerHTML = '';
    this.overlayLayer.classList.remove('hidden');

    if (levelIdx === 0) {
      AudioEngine.crossfadeTo('level1');
      Quiz.mount(this.overlayLayer, () => this.onLevelCompleted(0));
      return;
    }
    if (levelIdx === 1) {
      AudioEngine.crossfadeTo('level2');
      Platformer.mount(this.overlayLayer, () => this.onLevelCompleted(1));
      return;
    }
    if (levelIdx === 2) {
      AudioEngine.crossfadeTo('level3');
      Slideshow.mount(this.overlayLayer, () => this.onLevelCompleted(2));
      return;
    }
    if (levelIdx === 3) {
      AudioEngine.crossfadeTo('final');
      if (typeof runFinal === 'function') {
        runFinal(this.overlayLayer, () => this.onFinalCompleted());
      } else {
        this.onFinalCompleted();
      }
      return;
    }

    this.overlayLayer.classList.add('hidden');
    this.openMapScreen();
  },

  onLevelCompleted (levelIdx) {
    this.overlayLayer.innerHTML = '';
    this.overlayLayer.classList.remove('hidden');
    this.overlayLayer.style.background = 'transparent';

    AudioEngine.crossfadeTo('sheet');
    try { AudioEngine.playPaperRustle(); } catch (_) {}

    Sheet.show(levelIdx, this.overlayLayer, () => {
      this.overlayLayer.innerHTML = '';
      this.overlayLayer.classList.add('hidden');
      this.overlayLayer.style.background = '';

      if (!this.progress.completed.includes(levelIdx)) {
        this.progress.completed.push(levelIdx);
        this._saveProgress();
      }

      AudioEngine.crossfadeTo('menu');
      Menu.lightProgressBar(levelIdx);

      const nextIdx = levelIdx + 1;
      Menu.animateStarLine(levelIdx, nextIdx, () => {
        const cur = this._getCurrentLevelIndex();
        Menu.updateStarsState(
          this.progress.completed,
          cur,
          (sIdx, st) => {
            if (st === 'completed') {
              if (sIdx < 3) this.openSheet(sIdx);
              return;
            }
            if (st === 'current') {
              this.startLevelFlow(sIdx);
              return;
            }
            if (CONFIG.DEV_UNLOCK_ALL) {
              this.startLevelFlow(sIdx);
            }
          }
        );
      });
    });
  },

  onFinalCompleted () {
    this.overlayLayer.innerHTML = '';
    this.overlayLayer.classList.add('hidden');

    if (!this.progress.completed.includes(3)) {
      this.progress.completed.push(3);
      this.progress.finalDone = true;
      this._saveProgress();
    }

    AudioEngine.crossfadeTo('menu');
    this.openMapScreen();
  },

  openSheet (sheetIdx) {
    if (sheetIdx < 0 || sheetIdx > 2) return;
    this._ensureAudio();
    this.overlayLayer.innerHTML = '';
    this.overlayLayer.classList.remove('hidden');
    this.overlayLayer.style.background = 'transparent';

    AudioEngine.crossfadeTo('sheet');
    try { AudioEngine.playPaperRustle(); } catch (_) {}

    Sheet.showReadOnly(sheetIdx, this.overlayLayer, () => {
      this.overlayLayer.innerHTML = '';
      this.overlayLayer.classList.add('hidden');
      this.overlayLayer.style.background = '';
      AudioEngine.crossfadeTo('menu');
    });
  },

  backToMap () {
    this.overlayLayer.innerHTML = '';
    this.overlayLayer.classList.add('hidden');
    this.overlayLayer.style.background = '';
    const trans = this.transitionOverlay;
    trans.classList.remove('active');
    this.openMapScreen();
  },

  returnToMenu () {
    this._ensureAudio();
    this.overlayLayer.innerHTML = '';
    this.overlayLayer.classList.add('hidden');
    this.overlayLayer.style.background = '';
    AudioEngine.crossfadeTo('menu');
    const hasProgress = this.progress.introSeen || this.progress.completed.length > 0;
    Menu.showInitialMenu(
      hasProgress,
      () => this.onStartClicked(hasProgress),
      () => this.restartGame()
    );
  },

  restartGame () {
    this._ensureAudio();
    this.progress = {
      introSeen: true,
      completed: [],
      finalDone: false
    };
    this._saveProgress();
    this.openMapScreen();
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
