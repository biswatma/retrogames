/* ==========================================================================
   Nokia 3310 Retro Multi-Game Arcade Console
   Features: Modular Dispatcher, Web Audio Synthesizer, 5 Nostalgic Game Slots,
             Customizable Shell Casing, Backlight Swaps.
   ========================================================================== */

// --------------------------------------------------------------------------
// Sound Synthesis Engine (Web Audio API)
// --------------------------------------------------------------------------
class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.muted = false;
    this.volume = 0.4; // 0.0 to 1.0
  }

  init() {
    if (this.audioCtx) return;
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);
    } catch (e) {
      console.warn("Web Audio API not supported in this browser", e);
    }
  }

  setVolume(val) {
    this.init();
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
  }

  toggleMute() {
    this.init();
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.audioCtx.currentTime);
    }
    return this.muted;
  }

  // Play a single 8-bit square-wave tone
  playTone(freq, duration, type = 'square', delay = 0) {
    this.init();
    if (!this.audioCtx || this.muted) return;

    // Resume context if suspended (browser security policy)
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + delay);
    
    // Smooth envelope to prevent audio clicks
    gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime + delay);
    gainNode.gain.linearRampToValueAtTime(0.3, this.audioCtx.currentTime + delay + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + delay + duration);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.start(this.audioCtx.currentTime + delay);
    osc.stop(this.audioCtx.currentTime + delay + duration);
  }

  // Play a sequence of notes (Melody Synth)
  playMelody(notes) {
    this.init();
    if (this.muted) return;
    notes.forEach(note => {
      this.playTone(note[0], note[1], 'square', note[2]);
    });
  }

  // Pre-configured classic game sounds
  playClick() {
    this.playTone(1200, 0.02, 'square');
  }

  playFood() {
    this.playTone(880, 0.06, 'square', 0);
    this.playTone(1320, 0.08, 'square', 0.05);
  }

  playGameOver() {
    this.playTone(660, 0.15, 'square', 0);
    this.playTone(550, 0.15, 'square', 0.12);
    this.playTone(440, 0.15, 'square', 0.24);
    this.playTone(330, 0.3, 'square', 0.36);
  }

  playLevelUp() {
    this.playTone(1046.50, 0.08, 'square', 0); // C6
    this.playTone(1318.51, 0.08, 'square', 0.08); // E6
    this.playTone(1567.98, 0.08, 'square', 0.16); // G6
    this.playTone(2093.00, 0.15, 'square', 0.24); // C7
  }

  playNokiaTune() {
    const bpm = 160;
    const beat = 60 / bpm;
    
    // Notes of the iconic ringtone phrase: E6 D6 F#5 G#5 C#6 B5 D5 E5 B5 A5 C#5 E5 A5
    const melody = [
      [1318.51, beat * 0.5, 0],          // E6
      [1174.66, beat * 0.5, beat * 0.5],    // D6
      [739.99, beat, beat * 1.0],         // F#5
      [830.61, beat, beat * 2.0],         // G#5
      [1109.73, beat * 0.5, beat * 3.0],   // C#6
      [987.77, beat * 0.5, beat * 3.5],    // B5
      [587.33, beat, beat * 4.0],         // D5
      [659.25, beat, beat * 5.0],         // E5
      [987.77, beat * 0.5, beat * 6.0],    // B5
      [880.00, beat * 0.5, beat * 6.5],    // A5
      [554.37, beat, beat * 7.0],         // C#5
      [659.25, beat, beat * 8.0],         // E5
      [440.00, beat * 2.0, beat * 9.0]     // A5
    ];
    
    this.playMelody(melody);
  }
}

const Sound = new SoundEngine();

// --------------------------------------------------------------------------
// Global State Machine Types
// --------------------------------------------------------------------------
const CANVAS_WIDTH = 168;
const CANVAS_HEIGHT = 96;

const STATES = {
  BOOTING: 'booting',
  MAIN_MENU: 'main_menu',
  GAME_MODE_MENU: 'game_mode_menu',
  SPEED_MENU: 'speed_menu',
  SKIN_MENU: 'skin_menu',
  BACKLIGHT_MENU: 'backlight_menu',
  VOLUME_MENU: 'volume_menu',
  HIGH_SCORES_MENU: 'high_scores_menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  ABOUT: 'about'
};

const MODES = {
  CLASSIC1: 'classic1', // Snake Hitting wall = death
  CLASSIC2: 'classic2', // Snake Wrap around boundaries
  MAZES: 'mazes'       // Snake Brick obstacles
};

// --------------------------------------------------------------------------
// Core Phone Manager
// --------------------------------------------------------------------------
class GameEngine {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Set high-DPI scaling resolution (4x)
    const scaleFactor = 4;
    this.canvas.width = CANVAS_WIDTH * scaleFactor;
    this.canvas.height = CANVAS_HEIGHT * scaleFactor;
    this.ctx.scale(scaleFactor, scaleFactor);
    
    this.state = STATES.BOOTING;
    
    // Core settings
    this.selectedMode = MODES.CLASSIC1; // Specifically for Snake
    this.speedLevel = 4; // Global speed scale (1 to 9)
    this.highScores = {
      snake_c1: 0,
      snake_c2: 0,
      snake_mazes: 0,
      tetris: 0,
      space: 0,
      pairs: 0,
      bantumi: 0
    };
    
    // Game Management variables
    this.activeGame = null;
    this.activeGameType = 'snake'; // 'snake', 'tetris', 'space', 'pairs', 'bantumi'
    this.gameInterval = null;
    
    // Menu scrolling options - includes Skin, Backlight & Sound control for mobile screens
    this.menuIndex = 0;
    this.menuOptions = [
      'Snake II',
      'Tetris',
      'Space Impact',
      'Pairs II',
      'Bantumi',
      'Snake Mode',
      'Game Speed',
      'Phone Skin',
      'Backlight',
      'Volume',
      'High Scores',
      'About'
    ];
    
    // Boot animation state
    this.bootProgress = 0;
    
    // Key debouncing
    this.lastInputTime = 0;
  }

  init() {
    this.loadHighScores();
    this.setupUIHandlers();
    this.setupMobileScale();
    this.startBootAnimation();
  }

  // --------------------------------------------------------------------------
  // Data Records / Storage
  // --------------------------------------------------------------------------
  loadHighScores() {
    const saved = localStorage.getItem('nokia_retro_arcade_highscores');
    if (saved) {
      try {
        this.highScores = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse local highscores, resetting...", e);
      }
    }
    this.updateStatsDashboard();
  }

  saveHighScore() {
    if (!this.activeGame) return false;
    const score = this.activeGame.getScore();
    let mappedKey = 'snake_c1';
    let isNewHigh = false;
    
    if (this.activeGameType === 'snake') {
      mappedKey = this.selectedMode === MODES.CLASSIC1 ? 'snake_c1' :
                  this.selectedMode === MODES.CLASSIC2 ? 'snake_c2' : 'snake_mazes';
    } else if (this.activeGameType === 'tetris') {
      mappedKey = 'tetris';
    } else if (this.activeGameType === 'space') {
      mappedKey = 'space';
    } else if (this.activeGameType === 'pairs') {
      mappedKey = 'pairs';
    } else if (this.activeGameType === 'bantumi') {
      mappedKey = 'bantumi';
    }

    if (score > (this.highScores[mappedKey] || 0)) {
      this.highScores[mappedKey] = score;
      localStorage.setItem('nokia_retro_arcade_highscores', JSON.stringify(this.highScores));
      this.updateStatsDashboard();
      isNewHigh = true;
    }
    
    return isNewHigh;
  }

  updateStatsDashboard() {
    document.getElementById('highScoreC1').innerText = this.highScores.snake_c1 || 0;
    document.getElementById('highScoreC2').innerText = this.highScores.snake_c2 || 0;
    document.getElementById('highScoreMazes').innerText = this.highScores.snake_mazes || 0;
    document.getElementById('highScoreTetris').innerText = this.highScores.tetris || 0;
    document.getElementById('highScoreSpace').innerText = this.highScores.space || 0;
    document.getElementById('highScorePairs').innerText = this.highScores.pairs || 0;
    document.getElementById('highScoreBantumi').innerText = this.highScores.bantumi || 0;
  }

  // --------------------------------------------------------------------------
  // LCD Canvas Drawing Utilities
  // --------------------------------------------------------------------------
  clearScreen() {
    this.ctx.fillStyle = getComputedStyle(document.getElementById('lcdScreen')).getPropertyValue('--lcd-bg').trim();
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  setPixelColor() {
    this.ctx.fillStyle = getComputedStyle(document.getElementById('lcdScreen')).getPropertyValue('--lcd-pixel').trim();
    this.ctx.strokeStyle = this.ctx.fillStyle;
  }

  drawBorder() {
    this.setPixelColor();
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(1, 1, CANVAS_WIDTH - 2, CANVAS_HEIGHT - 2);
  }

  drawText(text, x, y, options = {}) {
    if (options.color) {
      this.ctx.fillStyle = options.color;
    } else {
      this.setPixelColor();
    }
    const size = options.size || '14px';
    const align = options.align || 'left';
    const isBold = options.bold ? 'bold ' : '';
    
    this.ctx.font = `${isBold}${size} 'VT323', monospace`;
    this.ctx.textAlign = align;
    this.ctx.fillText(text, x, y);
  }

  // --------------------------------------------------------------------------
  // State Machine Manager
  // --------------------------------------------------------------------------
  transitionTo(newState) {
    this.state = newState;
    this.menuIndex = 0;

    // Clear active loops
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
      this.gameInterval = null;
    }

    const footerLeft = document.getElementById('footerLeft');
    const footerRight = document.getElementById('footerRight');
    const headerTitle = document.getElementById('headerTitle');

    switch (newState) {
      case STATES.BOOTING:
        headerTitle.innerText = "NOKIA";
        footerLeft.innerText = "";
        footerRight.innerText = "";
        break;
      
      case STATES.MAIN_MENU:
        headerTitle.innerText = "GAMES";
        footerLeft.innerText = "Select";
        footerRight.innerText = "Power";
        break;
      
      case STATES.GAME_MODE_MENU:
        headerTitle.innerText = "SNAKE TYPE";
        footerLeft.innerText = "OK";
        footerRight.innerText = "Back";
        if (this.selectedMode === MODES.CLASSIC1) this.menuIndex = 0;
        else if (this.selectedMode === MODES.CLASSIC2) this.menuIndex = 1;
        else this.menuIndex = 2;
        break;

      case STATES.SPEED_MENU:
        headerTitle.innerText = "SET SPEED";
        footerLeft.innerText = "OK";
        footerRight.innerText = "Back";
        this.menuIndex = this.speedLevel - 1;
        break;

      case STATES.SKIN_MENU:
        headerTitle.innerText = "PHONE SKIN";
        footerLeft.innerText = "OK";
        footerRight.innerText = "Back";
        const activeSkin = document.getElementById('nokiaPhone').className.replace('nokia-3310', '').trim();
        const skinsList = ['navy', 'grey', 'crimson', 'yellow', 'teal'];
        this.menuIndex = skinsList.indexOf(activeSkin);
        if (this.menuIndex === -1) this.menuIndex = 0;
        break;

      case STATES.BACKLIGHT_MENU:
        headerTitle.innerText = "BACKLIGHT";
        footerLeft.innerText = "OK";
        footerRight.innerText = "Back";
        const activeBL = document.getElementById('lcdScreen').className.replace('lcd-screen', '').trim();
        const blList = ['classic', 'amber', 'blue'];
        this.menuIndex = blList.indexOf(activeBL);
        if (this.menuIndex === -1) this.menuIndex = 0;
        break;

      case STATES.VOLUME_MENU:
        headerTitle.innerText = "SOUND VOL";
        footerLeft.innerText = "OK";
        footerRight.innerText = "Back";
        if (Sound.muted) {
          this.menuIndex = 0;
        } else {
          this.menuIndex = Math.round(Sound.volume * 5); // scales 0 to 5
        }
        break;

      case STATES.HIGH_SCORES_MENU:
        headerTitle.innerText = "TOP RECORDS";
        footerLeft.innerText = "Reset";
        footerRight.innerText = "Back";
        break;

      case STATES.ABOUT:
        headerTitle.innerText = "ABOUT SUITE";
        footerLeft.innerText = "";
        footerRight.innerText = "Back";
        break;

      case STATES.PLAYING:
        headerTitle.innerText = "SCORE: 0";
        footerLeft.innerText = "Pause";
        footerRight.innerText = "Exit";
        this.startNewGame();
        break;

      case STATES.PAUSED:
        headerTitle.innerText = `SCORE: ${this.activeGame ? this.activeGame.getScore() : 0}`;
        footerLeft.innerText = "Resume";
        footerRight.innerText = "Exit";
        break;

      case STATES.GAME_OVER:
        headerTitle.innerText = "GAME OVER";
        footerLeft.innerText = "Play Again";
        footerRight.innerText = "Menu";
        break;
    }

    this.render();
  }

  // --------------------------------------------------------------------------
  // Boot Animation (Turning on the Nokia)
  // --------------------------------------------------------------------------
  startBootAnimation() {
    this.bootProgress = 0;
    Sound.playNokiaTune(); // Fanfare chime!
    
    const bootLoop = () => {
      this.clearScreen();
      this.drawBorder();
      
      this.drawText("NOKIA", CANVAS_WIDTH / 2, 40, { size: '28px', align: 'center', bold: true });
      
      this.setPixelColor();
      const barW = 100;
      const barH = 6;
      const barX = (CANVAS_WIDTH - barW) / 2;
      const barY = 60;
      this.ctx.strokeRect(barX, barY, barW, barH);
      this.ctx.fillRect(barX + 2, barY + 2, (barW - 4) * (this.bootProgress / 100), barH - 4);
      
      this.drawText("Connecting...", CANVAS_WIDTH / 2, 80, { size: '10px', align: 'center' });
      
      this.bootProgress += 2.5;
      
      if (this.bootProgress <= 100) {
        requestAnimationFrame(bootLoop);
      } else {
        setTimeout(() => {
          this.transitionTo(STATES.MAIN_MENU);
        }, 300);
      }
    };
    
    requestAnimationFrame(bootLoop);
  }

  // --------------------------------------------------------------------------
  // Core Visual Renderer Page Router
  // --------------------------------------------------------------------------
  render() {
    if (this.state === STATES.BOOTING) return;
    
    this.clearScreen();
    this.drawBorder();

    switch (this.state) {
      case STATES.MAIN_MENU:
        this.renderScrollMenu();
        break;
        
      case STATES.GAME_MODE_MENU:
        this.renderScrollMenu();
        break;

      case STATES.SKIN_MENU:
        this.renderScrollMenu();
        break;

      case STATES.BACKLIGHT_MENU:
        this.renderScrollMenu();
        break;

      case STATES.VOLUME_MENU:
        this.renderScrollMenu();
        break;

      case STATES.SPEED_MENU:
        this.renderSpeedMenu();
        break;

      case STATES.HIGH_SCORES_MENU:
        this.renderHighScoresMenu();
        break;

      case STATES.ABOUT:
        this.renderAboutPage();
        break;

      case STATES.PLAYING:
      case STATES.PAUSED:
        if (this.activeGame) {
          this.activeGame.draw(this.ctx);
        }
        
        // Render Pause overlay text
        if (this.state === STATES.PAUSED) {
          const flash = Math.floor(Date.now() / 400) % 2 === 0;
          if (flash) {
            const lcdPixelColor = getComputedStyle(document.getElementById('lcdScreen')).getPropertyValue('--lcd-pixel').trim();
            const lcdBgColor = getComputedStyle(document.getElementById('lcdScreen')).getPropertyValue('--lcd-bg').trim();
            this.ctx.fillStyle = lcdPixelColor;
            this.ctx.fillRect(24, 38, CANVAS_WIDTH - 48, 20);
            this.drawText("PAUSED", CANVAS_WIDTH / 2, 53, { size: '14px', align: 'center', bold: true, color: lcdBgColor });
          }
        }
        break;

      case STATES.GAME_OVER:
        this.renderGameOver();
        break;
    }
  }

  // Renders a beautiful scrolling list showing a window of 5 items
  renderScrollMenu() {
    const lcdPixelColor = getComputedStyle(document.getElementById('lcdScreen')).getPropertyValue('--lcd-pixel').trim();
    const lcdBgColor = getComputedStyle(document.getElementById('lcdScreen')).getPropertyValue('--lcd-bg').trim();

    this.ctx.fillStyle = lcdPixelColor;
    this.ctx.fillRect(4, 4, CANVAS_WIDTH - 8, 14);
    
    let cleanTitle = "MAIN MENU";
    let options = this.menuOptions;
    
    if (this.state === STATES.GAME_MODE_MENU) {
      cleanTitle = "SNAKE TYPE";
      options = ['Classic I', 'Classic II', 'Mazes'];
    } else if (this.state === STATES.SKIN_MENU) {
      cleanTitle = "PHONE SKIN";
      options = ['Classic Navy', 'Retro Grey', 'Crimson Red', 'Neon Yellow', 'Cyber Teal'];
    } else if (this.state === STATES.BACKLIGHT_MENU) {
      cleanTitle = "BACKLIGHT";
      options = ['Classic Green', 'Matrix Amber', 'Ice Blue'];
    } else if (this.state === STATES.VOLUME_MENU) {
      cleanTitle = "SOUND VOL";
      options = ['Muted 🔇', 'Volume 20%', 'Volume 40%', 'Volume 60%', 'Volume 80%', 'Volume 100%'];
    }
    
    this.drawText(cleanTitle, CANVAS_WIDTH / 2, 14, { size: '11px', align: 'center', bold: true, color: lcdBgColor });
    
    const maxVisible = 5;
    let startIdx = 0;
    
    if (this.menuIndex >= maxVisible - 1) {
      startIdx = this.menuIndex - (maxVisible - 2);
    }
    if (startIdx + maxVisible > options.length) {
      startIdx = Math.max(0, options.length - maxVisible);
    }
    
    const startY = 32;
    const spacing = 12;
    
    this.setPixelColor();
    if (this.menuIndex > 0) this.drawText("▲", CANVAS_WIDTH - 12, startY - 2, { size: '8px' });
    if (this.menuIndex < options.length - 1) this.drawText("▼", CANVAS_WIDTH - 12, startY + (maxVisible - 1) * spacing, { size: '8px' });

    for (let i = 0; i < maxVisible; i++) {
      const idx = startIdx + i;
      if (idx >= options.length) break;
      
      const opt = options[idx];
      const isSelected = idx === this.menuIndex;
      const optY = startY + (i * spacing);
      
      if (isSelected) {
        this.ctx.fillStyle = lcdPixelColor;
        this.ctx.fillRect(8, optY - 9, CANVAS_WIDTH - 24, 11);
        this.drawText(`${idx + 1}. ${opt}`, 12, optY, { size: '11px', bold: true, color: lcdBgColor });
      } else {
        this.drawText(`${idx + 1}. ${opt}`, 12, optY, { size: '11px', bold: false });
      }
    }
  }

  // Renders Speed Slider Settings
  renderSpeedMenu() {
    this.drawText("SELECT VELOCITY", CANVAS_WIDTH / 2, 22, { size: '14px', align: 'center', bold: true });
    
    const blockW = 10;
    const blockH = 14;
    const gap = 3;
    const startX = (CANVAS_WIDTH - (9 * blockW + 8 * gap)) / 2;
    const startY = 40;
    
    for (let i = 0; i < 9; i++) {
      const isSelected = i === this.menuIndex;
      const isFilled = i < this.speedLevel;
      const blockX = startX + (i * (blockW + gap));
      
      this.setPixelColor();
      if (isFilled) {
        this.ctx.fillRect(blockX, startY, blockW, blockH);
      } else {
        this.ctx.strokeRect(blockX, startY, blockW, blockH);
      }
      
      if (isSelected) {
        this.drawText("▲", blockX + blockW/2, startY + blockH + 11, { size: '10px', align: 'center' });
      }
    }
    
    this.drawText(`LEVEL: ${this.menuIndex + 1}`, CANVAS_WIDTH / 2, 85, { size: '13px', align: 'center', bold: true });
  }

  // Renders scroll high scores list
  renderHighScoresMenu() {
    this.drawText("PERSONAL BESTS", CANVAS_WIDTH / 2, 16, { size: '13px', align: 'center', bold: true });
    
    this.drawText(`SNAKE I/II/M: ${this.highScores.snake_c1}/${this.highScores.snake_c2}/${this.highScores.snake_mazes}`, 12, 34, { size: '11px', bold: true });
    this.drawText(`TETRIS:       ${this.highScores.tetris}`, 12, 46, { size: '11px', bold: true });
    this.drawText(`SPACE IMPACT: ${this.highScores.space}`, 12, 58, { size: '11px', bold: true });
    this.drawText(`PAIRS II:     ${this.highScores.pairs}`, 12, 70, { size: '11px', bold: true });
    this.drawText(`BANTUMI:      ${this.highScores.bantumi}`, 12, 82, { size: '11px', bold: true });
  }

  // Renders Retro Suite Credits
  renderAboutPage() {
    this.drawText("NOKIA 3310 ARCADE", CANVAS_WIDTH / 2, 20, { size: '13px', align: 'center', bold: true });
    this.drawText("Retro Multi-Game Suite", CANVAS_WIDTH / 2, 38, { size: '10px', align: 'center' });
    this.drawText("A premium nostalgic web tribute", CANVAS_WIDTH / 2, 52, { size: '10px', align: 'center' });
    this.drawText("Play via Arrow Keys or Nokia Pad", CANVAS_WIDTH / 2, 68, { size: '10px', align: 'center' });
    this.drawText("Recreated in 90s monochrome LCD", CANVAS_WIDTH / 2, 80, { size: '10px', align: 'center' });
  }

  // Renders Game Over Menu Screen
  renderGameOver() {
    const finalScore = this.activeGame ? this.activeGame.getScore() : 0;
    this.drawText("GAME OVER", CANVAS_WIDTH / 2, 28, { size: '20px', align: 'center', bold: true });
    this.drawText(`FINAL SCORE: ${finalScore}`, CANVAS_WIDTH / 2, 48, { size: '14px', align: 'center' });
    
    let mappedKey = 'snake_c1';
    if (this.activeGameType === 'snake') {
      mappedKey = this.selectedMode === MODES.CLASSIC1 ? 'snake_c1' :
                  this.selectedMode === MODES.CLASSIC2 ? 'snake_c2' : 'snake_mazes';
    } else if (this.activeGameType === 'tetris') {
      mappedKey = 'tetris';
    } else if (this.activeGameType === 'space') {
      mappedKey = 'space';
    } else if (this.activeGameType === 'pairs') {
      mappedKey = 'pairs';
    } else if (this.activeGameType === 'bantumi') {
      mappedKey = 'bantumi';
    }

    const isNewHigh = finalScore >= (this.highScores[mappedKey] || 0) && finalScore > 0;
    if (isNewHigh) {
      const flash = Math.floor(Date.now() / 250) % 2 === 0;
      if (flash) {
        this.drawText("★ NEW HIGH SCORE ★", CANVAS_WIDTH / 2, 68, { size: '11px', align: 'center', bold: true });
      } else {
        this.drawText("★                 ★", CANVAS_WIDTH / 2, 68, { size: '11px', align: 'center', bold: true });
      }
    } else {
      this.drawText("Press '5' to restart", CANVAS_WIDTH / 2, 72, { size: '11px', align: 'center' });
    }
  }

  // --------------------------------------------------------------------------
  // Core Dispatcher Gameplay Loop Manager
  // --------------------------------------------------------------------------
  startNewGame() {
    document.getElementById('headerTitle').innerText = "SCORE: 0";
    
    // Instantiate game class depending on active selection
    if (this.activeGameType === 'snake') {
      this.activeGame = new SnakeGame(this.canvas, Sound);
      this.activeGame.start(this.speedLevel, this.selectedMode);
    } else if (this.activeGameType === 'tetris') {
      this.activeGame = new TetrisGame(this.canvas, Sound);
      this.activeGame.start(this.speedLevel);
    } else if (this.activeGameType === 'space') {
      this.activeGame = new SpaceImpactGame(this.canvas, Sound);
      this.activeGame.start(this.speedLevel);
    } else if (this.activeGameType === 'pairs') {
      this.activeGame = new PairsII(this.canvas, Sound);
      this.activeGame.start(this.speedLevel);
    } else if (this.activeGameType === 'bantumi') {
      this.activeGame = new Bantumi(this.canvas, Sound);
      this.activeGame.start(this.speedLevel);
    }

    this.startNewGameInterval();
  }

  startNewGameInterval() {
    if (this.gameInterval) clearInterval(this.gameInterval);
    
    let interval = 100; // fallback
    if (this.activeGameType === 'snake') {
      interval = 240 - (this.speedLevel * 20);
    } else if (this.activeGameType === 'tetris') {
      interval = 800 - (this.speedLevel * 70);
    } else if (this.activeGameType === 'space') {
      interval = 40; // High rate scrolling side shooter
    } else if (this.activeGameType === 'pairs') {
      interval = 100;
    } else if (this.activeGameType === 'bantumi') {
      interval = 100;
    }

    this.gameInterval = setInterval(() => {
      if (this.state === STATES.PLAYING && this.activeGame) {
        // Snake can escalate speed mid-game (Classic II)
        if (this.activeGameType === 'snake' && this.activeGame.speedLevel !== this.speedLevel) {
          this.speedLevel = this.activeGame.speedLevel;
          this.startNewGameInterval();
          return;
        }

        this.activeGame.step();
        
        // Update header score dynamically
        document.getElementById('headerTitle').innerText = "SCORE: " + this.activeGame.getScore();
        
        if (this.activeGame.isGameOver()) {
          this.triggerGameOver();
        }
      }
      this.render();
    }, interval);
  }

  triggerGameOver() {
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
      this.gameInterval = null;
    }
    
    Sound.playGameOver();
    const isNewHigh = this.saveHighScore();
    
    if (isNewHigh) {
      setTimeout(() => {
        Sound.playNokiaTune();
      }, 500);
    }
    
    this.transitionTo(STATES.GAME_OVER);
  }

  // --------------------------------------------------------------------------
  // Keyboard Routing Controllers & Tactile Press Animations
  // --------------------------------------------------------------------------
  handleNavigation(action) {
    Sound.playClick();
    
    const now = Date.now();
    if (now - this.lastInputTime < 60) return; // Debounce keys quickly
    this.lastInputTime = now;

    // ACTIVE MENU NAVIGATION STATE
    if (this.state === STATES.MAIN_MENU) {
      if (action === 'UP') {
        this.menuIndex = (this.menuIndex - 1 + this.menuOptions.length) % this.menuOptions.length;
      } else if (action === 'DOWN') {
        this.menuIndex = (this.menuIndex + 1) % this.menuOptions.length;
      } else if (action === 'SELECT') {
        this.handleMenuSelection();
      } else if (action === 'BACK') {
        this.powerToggle();
      }
      this.render();
    }
    
    // GAME TYPE SELECTION MENU
    else if (this.state === STATES.GAME_MODE_MENU) {
      if (action === 'UP') {
        this.menuIndex = (this.menuIndex - 1 + 3) % 3;
      } else if (action === 'DOWN') {
        this.menuIndex = (this.menuIndex + 1) % 3;
      } else if (action === 'SELECT') {
        this.selectedMode = [MODES.CLASSIC1, MODES.CLASSIC2, MODES.MAZES][this.menuIndex];
        this.transitionTo(STATES.MAIN_MENU);
      } else if (action === 'BACK') {
        this.transitionTo(STATES.MAIN_MENU);
      }
      this.render();
    }
    
    // SPEED SELECTION SETTINGS
    else if (this.state === STATES.SPEED_MENU) {
      if (action === 'LEFT' || action === 'UP') {
        this.menuIndex = Math.max(0, this.menuIndex - 1);
        this.speedLevel = this.menuIndex + 1;
      } else if (action === 'RIGHT' || action === 'DOWN') {
        this.menuIndex = Math.min(8, this.menuIndex + 1);
        this.speedLevel = this.menuIndex + 1;
      } else if (action === 'SELECT') {
        this.transitionTo(STATES.MAIN_MENU);
      } else if (action === 'BACK') {
        this.transitionTo(STATES.MAIN_MENU);
      }
      this.render();
    }

    // PHONE SKIN SELECTION
    else if (this.state === STATES.SKIN_MENU) {
      if (action === 'UP') {
        this.menuIndex = (this.menuIndex - 1 + 5) % 5;
      } else if (action === 'DOWN') {
        this.menuIndex = (this.menuIndex + 1) % 5;
      } else if (action === 'SELECT') {
        const skinsList = ['navy', 'grey', 'crimson', 'yellow', 'teal'];
        const chosenSkin = skinsList[this.menuIndex];
        
        // Update phone chassis class
        const phone = document.getElementById('nokiaPhone');
        phone.className = 'nokia-3310 ' + chosenSkin;
        
        // Synchronize customizer panel list highlight
        const skinBtns = document.querySelectorAll('.skin-btn');
        skinBtns.forEach(btn => {
          btn.classList.remove('active');
          if (btn.getAttribute('data-skin') === chosenSkin) {
            btn.classList.add('active');
          }
        });
        
        this.transitionTo(STATES.MAIN_MENU);
      } else if (action === 'BACK') {
        this.transitionTo(STATES.MAIN_MENU);
      }
      this.render();
    }
    
    // BACKLIGHT SELECTION
    else if (this.state === STATES.BACKLIGHT_MENU) {
      if (action === 'UP') {
        this.menuIndex = (this.menuIndex - 1 + 3) % 3;
      } else if (action === 'DOWN') {
        this.menuIndex = (this.menuIndex + 1) % 3;
      } else if (action === 'SELECT') {
        const blList = ['classic', 'amber', 'blue'];
        const chosenBL = blList[this.menuIndex];
        
        // Update screen backlight class
        const screen = document.getElementById('lcdScreen');
        screen.className = 'lcd-screen ' + chosenBL;
        
        // Synchronize customizer panel backlight highlight
        const blBtns = document.querySelectorAll('.backlight-btn');
        blBtns.forEach(btn => {
          btn.classList.remove('active');
          if (btn.getAttribute('data-backlight') === chosenBL) {
            btn.classList.add('active');
          }
        });
        
        this.transitionTo(STATES.MAIN_MENU);
      } else if (action === 'BACK') {
        this.transitionTo(STATES.MAIN_MENU);
      }
      this.render();
    }
    
    // VOLUME SELECTION
    else if (this.state === STATES.VOLUME_MENU) {
      if (action === 'UP') {
        this.menuIndex = (this.menuIndex - 1 + 6) % 6;
      } else if (action === 'DOWN') {
        this.menuIndex = (this.menuIndex + 1) % 6;
      } else if (action === 'SELECT') {
        if (this.menuIndex === 0) {
          Sound.muted = true;
          if (Sound.masterGain) Sound.masterGain.gain.setValueAtTime(0, Sound.audioCtx.currentTime);
        } else {
          Sound.muted = false;
          Sound.volume = this.menuIndex * 0.2; // 0.2, 0.4, 0.6, 0.8, 1.0
          if (Sound.masterGain) Sound.masterGain.gain.setValueAtTime(Sound.volume, Sound.audioCtx.currentTime);
        }
        
        // Synchronize customizer panel volume elements
        const slider = document.getElementById('volumeSlider');
        const valLabel = document.getElementById('volumeVal');
        const muteBtn = document.getElementById('muteBtn');
        
        slider.value = Sound.muted ? 0 : Sound.volume * 100;
        valLabel.innerText = Sound.muted ? '0%' : `${Math.round(Sound.volume * 100)}%`;
        muteBtn.innerText = Sound.muted ? '🔇' : '🔊';
        
        this.transitionTo(STATES.MAIN_MENU);
      } else if (action === 'BACK') {
        this.transitionTo(STATES.MAIN_MENU);
      }
      this.render();
    }
    
    // TOP RECORDS
    else if (this.state === STATES.HIGH_SCORES_MENU) {
      if (action === 'SELECT') {
        if (confirm("Reset all high scores?")) {
          this.highScores = {
            snake_c1: 0,
            snake_c2: 0,
            snake_mazes: 0,
            tetris: 0,
            space: 0,
            pairs: 0,
            bantumi: 0
          };
          localStorage.removeItem('nokia_retro_arcade_highscores');
          this.updateStatsDashboard();
          this.render();
        }
      } else if (action === 'BACK') {
        this.transitionTo(STATES.MAIN_MENU);
      }
    }
    
    // ABOUT
    else if (this.state === STATES.ABOUT) {
      if (action === 'BACK' || action === 'SELECT') {
        this.transitionTo(STATES.MAIN_MENU);
      }
    }
    
    // ACTIVE PLAYING CONTROLS - route to the active plugin!
    else if (this.state === STATES.PLAYING) {
      if (action === 'SELECT') {
        this.transitionTo(STATES.PAUSED);
      } else if (action === 'BACK') {
        this.transitionTo(STATES.MAIN_MENU);
      } else if (this.activeGame) {
        this.activeGame.handleInput(action);
        this.render(); // Redraw immediately for crisp feedback
      }
    }
    
    // PAUSED CONTROLS
    else if (this.state === STATES.PAUSED) {
      if (action === 'SELECT') {
        this.state = STATES.PLAYING;
        document.getElementById('footerLeft').innerText = "Pause";
        this.startNewGameInterval();
        this.render();
      } else if (action === 'BACK') {
        this.transitionTo(STATES.MAIN_MENU);
      }
    }
    
    // GAME OVER ACTIONS
    else if (this.state === STATES.GAME_OVER) {
      if (action === 'SELECT') {
        this.transitionTo(STATES.PLAYING);
      } else if (action === 'BACK') {
        this.transitionTo(STATES.MAIN_MENU);
      }
    }
  }

  handleMenuSelection() {
    switch (this.menuIndex) {
      case 0:
        this.activeGameType = 'snake';
        this.transitionTo(STATES.PLAYING);
        break;
      case 1:
        this.activeGameType = 'tetris';
        this.transitionTo(STATES.PLAYING);
        break;
      case 2:
        this.activeGameType = 'space';
        this.transitionTo(STATES.PLAYING);
        break;
      case 3:
        this.activeGameType = 'pairs';
        this.transitionTo(STATES.PLAYING);
        break;
      case 4:
        this.activeGameType = 'bantumi';
        this.transitionTo(STATES.PLAYING);
        break;
      case 5:
        this.transitionTo(STATES.GAME_MODE_MENU);
        break;
      case 6:
        this.transitionTo(STATES.SPEED_MENU);
        break;
      case 7:
        this.transitionTo(STATES.SKIN_MENU);
        break;
      case 8:
        this.transitionTo(STATES.BACKLIGHT_MENU);
        break;
      case 9:
        this.transitionTo(STATES.VOLUME_MENU);
        break;
      case 10:
        this.transitionTo(STATES.HIGH_SCORES_MENU);
        break;
      case 11:
        this.transitionTo(STATES.ABOUT);
        break;
    }
  }

  // Toggle nokia screen on / off (power option)
  powerToggle() {
    const lcd = document.getElementById('lcdScreen');
    
    if (lcd.style.display !== 'none') {
      lcd.style.display = 'none';
      if (this.gameInterval) {
        clearInterval(this.gameInterval);
        this.gameInterval = null;
      }
      Sound.playTone(300, 0.4, 'sawtooth');
    } else {
      lcd.style.display = 'flex';
      this.state = STATES.BOOTING;
      this.startBootAnimation();
    }
  }

  // Set up dynamic phone scaling on mobile/tablet viewports to fit screen perfectly
  setupMobileScale() {
    const adjustScale = () => {
      const phone = document.getElementById('nokiaPhone');
      if (!phone) return;
      
      if (window.innerWidth <= 820 || window.innerHeight <= 600) {
        // Dynamic scale calculated based on screen width/height to avoid scrolling/overflow
        // Allowed to scale up freely past 1.0 to fit physical mobile screens completely
        const scaleX = window.innerWidth / 330;
        const scaleY = window.innerHeight / 590;
        const scale = Math.min(scaleX, scaleY);
        phone.style.transform = `scale(${scale})`;
      } else {
        phone.style.transform = '';
      }
    };
    
    window.addEventListener('resize', adjustScale);
    window.addEventListener('load', adjustScale);
    adjustScale();
  }

  // Bind event listeners for UI buttons and keyboards
  setupUIHandlers() {
    // 1. Physical Keyboard captures
    window.addEventListener('keydown', (e) => {
      let action = null;
      let buttonId = null;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
        case '2':
          action = 'UP';
          buttonId = 'btnKey2';
          this.triggerVisualPress('btnScrollUp');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
        case '8':
          action = 'DOWN';
          buttonId = 'btnKey8';
          this.triggerVisualPress('btnScrollDown');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
        case '4':
          action = 'LEFT';
          buttonId = 'btnKey4';
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
        case '6':
          action = 'RIGHT';
          buttonId = 'btnKey6';
          break;
        case 'Enter':
        case ' ':
        case '5':
          action = 'SELECT';
          buttonId = 'btnKey5';
          this.triggerVisualPress('btnSoftLeft');
          break;
        case 'Escape':
        case 'Backspace':
        case 'c':
        case 'C':
          action = 'BACK';
          buttonId = 'btnSoftRight';
          break;
      }

      if (action) {
        if (buttonId) this.triggerVisualPress(buttonId);
        this.handleNavigation(action);
      }
    });

    // 2. Touch captures for interactive on-screen Nokia buttons with zero latency
    const bindVirtualButton = (elementId, actionName) => {
      const btn = document.getElementById(elementId);
      if (btn) {
        const handlePress = (e) => {
          e.preventDefault();
          this.triggerVisualPress(elementId);
          this.handleNavigation(actionName);
        };
        btn.addEventListener('touchstart', handlePress, { passive: false });
        btn.addEventListener('mousedown', handlePress);
      }
    };

    bindVirtualButton('btnScrollUp', 'UP');
    bindVirtualButton('btnScrollDown', 'DOWN');
    bindVirtualButton('btnSoftLeft', 'SELECT');
    bindVirtualButton('btnSoftRight', 'BACK');

    bindVirtualButton('btnKey2', 'UP');
    bindVirtualButton('btnKey8', 'DOWN');
    bindVirtualButton('btnKey4', 'LEFT');
    bindVirtualButton('btnKey6', 'RIGHT');
    bindVirtualButton('btnKey5', 'SELECT');
    
    const extraNumKeys = ['btnKey1', 'btnKey3', 'btnKey7', 'btnKey9', 'btnKeyStar', 'btnKey0', 'btnKeyHash'];
    extraNumKeys.forEach(kid => {
      const btn = document.getElementById(kid);
      if (btn) {
        const handleExtraPress = (e) => {
          e.preventDefault();
          Sound.playClick();
          this.triggerVisualPress(kid);
        };
        btn.addEventListener('touchstart', handleExtraPress, { passive: false });
        btn.addEventListener('mousedown', handleExtraPress);
      }
    });

    const power = document.getElementById('powerBtn');
    if (power) {
      const handlePower = (e) => {
        e.preventDefault();
        if ('vibrate' in navigator) {
          try {
            navigator.vibrate(15); // Slightly longer haptic (15ms) for phone power key
          } catch (err) {}
        }
        this.powerToggle();
      };
      power.addEventListener('touchstart', handlePower, { passive: false });
      power.addEventListener('click', handlePower);
    }

    // 3. Skins chassis switcher
    const skinBtns = document.querySelectorAll('.skin-btn');
    const nokiaPhone = document.getElementById('nokiaPhone');
    
    skinBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if ('vibrate' in navigator) {
          try {
            navigator.vibrate(10); // Subtle haptic click (10ms)
          } catch (err) {}
        }
        Sound.playClick();
        skinBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const skinName = btn.getAttribute('data-skin');
        nokiaPhone.className = 'nokia-3310';
        nokiaPhone.classList.add(skinName);
      });
    });

    // 4. LCD Backlight switcher
    const backlightBtns = document.querySelectorAll('.backlight-btn');
    const lcdScreen = document.getElementById('lcdScreen');
    
    backlightBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if ('vibrate' in navigator) {
          try {
            navigator.vibrate(10); // Subtle haptic click (10ms)
          } catch (err) {}
        }
        Sound.playClick();
        backlightBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const toneName = btn.getAttribute('data-backlight');
        lcdScreen.className = 'lcd-screen';
        lcdScreen.classList.add(toneName);
        this.render();
      });
    });

    // 5. Volume controls
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeVal = document.getElementById('volumeVal');
    const muteBtn = document.getElementById('muteBtn');
    
    volumeSlider.addEventListener('input', (e) => {
      const percent = parseInt(e.target.value);
      volumeVal.innerText = `${percent}%`;
      Sound.setVolume(percent / 100);
    });

    muteBtn.addEventListener('click', () => {
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate(10); // Subtle haptic click (10ms)
        } catch (err) {}
      }
      const isMuted = Sound.toggleMute();
      muteBtn.innerText = isMuted ? '🔇' : '🔊';
      muteBtn.title = isMuted ? 'Unmute Sound' : 'Mute Sound';
      if (!isMuted) Sound.playClick();
    });
  }

  triggerVisualPress(buttonId) {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.add('pressed');
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate(12); // Subtle haptic click (12ms) for keypad
        } catch (err) {}
      }
      setTimeout(() => {
        btn.classList.remove('pressed');
      }, 100);
    }
  }
}

// --------------------------------------------------------------------------
// PWA Installation & Service Worker Registration Setup
// --------------------------------------------------------------------------
function setupPWA() {
  // 1. Register Service Worker for offline playability
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker registered successfully!', reg.scope))
        .catch(err => console.warn('Service Worker registration failed:', err));
    });
  }

  // 2. Manage Installation Prompt Dialogs
  let deferredPrompt = null;
  const installModal = document.getElementById('installPrompt');
  const iosModal = document.getElementById('iosInstallPrompt');
  
  const confirmBtn = document.getElementById('installConfirmBtn');
  const cancelBtn = document.getElementById('installCancelBtn');
  const closeIosBtn = document.getElementById('iosInstallCloseBtn');

  // Detect iOS and Standalone status
  const isIOS = (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) && 
                !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  // Listen for the native beforeinstallprompt (Android / Chrome Desktop)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    if (!sessionStorage.getItem('pwa_prompt_dismissed') && !isStandalone) {
      setTimeout(() => {
        if (installModal) installModal.classList.add('show');
      }, 5000);
    }
  });

  // Handle Android/Chrome Install Prompt trigger
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      if (installModal) installModal.classList.remove('show');
      if (!deferredPrompt) return;
      
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted PWA installation');
        }
        deferredPrompt = null;
      });
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (installModal) installModal.classList.remove('show');
      sessionStorage.setItem('pwa_prompt_dismissed', 'true');
    });
  }

  // Show custom instructions tooltip if running iOS Safari (native prompt is unsupported on iOS)
  if (isIOS && !isStandalone) {
    if (!sessionStorage.getItem('pwa_ios_prompt_dismissed')) {
      setTimeout(() => {
        if (iosModal) iosModal.classList.add('show');
      }, 6000);
    }
  }

  if (closeIosBtn) {
    closeIosBtn.addEventListener('click', () => {
      if (iosModal) iosModal.classList.remove('show');
      sessionStorage.setItem('pwa_ios_prompt_dismissed', 'true');
    });
  }
}

// --------------------------------------------------------------------------
// App Launch Setup
// --------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  const Game = new GameEngine();
  Game.init();
  
  // Initialize PWA setup
  setupPWA();

  // Bounded frame ticker to redraw game on interval ticks
  setInterval(() => {
    if (Game.state === STATES.PLAYING || Game.state === STATES.PAUSED || Game.state === STATES.GAME_OVER) {
      Game.render();
    }
  }, 100);
});
