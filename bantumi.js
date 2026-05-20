/**
 * Bantumi - Classic Nokia 3310 Mancala Board Game
 * Fully polished for 168x96 monochrome LCD screen.
 */
class Bantumi {
  constructor(canvas, sound) {
    this.canvas = canvas;
    this.sound = sound;
    this.width = 168;   // 168
    this.height = 96; // 96

    // Symmetrical positions mapping
    // Pits 0-5 (Player small, bottom left to right)
    // Pit 6 (Player store, right)
    // Pits 7-12 (CPU small, top right to left)
    // Pit 13 (CPU store, left)
    this.pitWidth = 14;
    this.pitHeight = 20;
    this.pitGap = 4;
    this.pitStartX = 32;

    this.reset();
  }

  reset() {
    // Board state
    this.board = [
      3, 3, 3, 3, 3, 3, // Pits 0-5 (Player)
      0,                // Pit 6 (Player Store)
      3, 3, 3, 3, 3, 3, // Pits 7-12 (CPU)
      0                 // Pit 13 (CPU Store)
    ];

    this.cursorIndex = 0; // 0 to 5 player small pits
    this.activePlayer = 'PLAYER'; // 'PLAYER' or 'CPU'
    this.inputBlocked = false;
    this.cpuTurnTimer = 0;
    this.gameOver = false;
    this.winnerMessage = "";
    this.statusMessage = "Your Turn";
    this.score = 0;
    this.speedLevel = 4;
  }

  start(speedLevel) {
    this.reset();
    this.speedLevel = speedLevel;
  }

  step() {
    if (this.gameOver) return;

    if (this.activePlayer === 'CPU' && !this.inputBlocked) {
      this.inputBlocked = true;
      this.cpuTurnTimer = 10; // ~1 second delay
      this.statusMessage = "CPU thinking...";
    }

    if (this.cpuTurnTimer > 0) {
      this.cpuTurnTimer--;
      if (this.cpuTurnTimer === 0) {
        this.makeCPUMove();
      }
    }
  }

  draw(ctx) {
    const pixelColor = getComputedStyle(document.getElementById('lcdScreen')).getPropertyValue('--lcd-pixel').trim();
    ctx.strokeStyle = pixelColor;
    ctx.fillStyle = pixelColor;
    ctx.lineWidth = 1;

    // 1. Draw Board Frame
    ctx.strokeRect(6, 12, 156, 68);

    // 2. Draw Left Store (CPU, Pit 13)
    ctx.strokeRect(12, 18, 16, 56);
    // Draw horizontal dashed dividing line to make it look physical
    ctx.save();
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(12, 46); ctx.lineTo(28, 46);
    ctx.stroke();
    ctx.restore();
    
    ctx.font = "10px 'VT323', monospace";
    ctx.textAlign = "center";
    ctx.fillText("CPU", 20, 28);
    ctx.font = "bold 14px 'VT323', monospace";
    ctx.fillText(this.board[13], 20, 60);

    // 3. Draw Right Store (Player, Pit 6)
    ctx.strokeRect(140, 18, 16, 56);
    ctx.save();
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(140, 46); ctx.lineTo(156, 46);
    ctx.stroke();
    ctx.restore();

    ctx.font = "10px 'VT323', monospace";
    ctx.fillText("YOU", 148, 28);
    ctx.font = "bold 14px 'VT323', monospace";
    ctx.fillText(this.board[6], 148, 60);

    // 4. Draw CPU Pits (Top, Right to Left: 7 on right, 12 on left)
    ctx.font = "bold 11px 'VT323', monospace";
    for (let i = 0; i < 6; i++) {
      const pitIdx = 12 - i; // Index 12 is on the left, Index 7 is on the right
      const x = this.pitStartX + i * (this.pitWidth + this.pitGap);
      const y = 18;

      ctx.strokeRect(x, y, this.pitWidth, this.pitHeight);
      ctx.fillText(this.board[pitIdx], x + this.pitWidth / 2, y + 14);
    }

    // 5. Draw Player Pits (Bottom, Left to Right: 0 on left, 5 on right)
    for (let i = 0; i < 6; i++) {
      const pitIdx = i; // Index 0 on left, 5 on right
      const x = this.pitStartX + i * (this.pitWidth + this.pitGap);
      const y = 54;

      ctx.strokeRect(x, y, this.pitWidth, this.pitHeight);
      ctx.fillText(this.board[pitIdx], x + this.pitWidth / 2, y + 14);
    }

    // 6. Draw Player Cursor Highlight
    if (this.activePlayer === 'PLAYER' && !this.gameOver) {
      const isBlinkOn = Math.floor(Date.now() / 250) % 2 === 0;
      if (isBlinkOn) {
        const x = this.pitStartX + this.cursorIndex * (this.pitWidth + this.pitGap);
        const y = 54;
        
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 2, y - 2, this.pitWidth + 4, this.pitHeight + 4);
        ctx.restore();
      }
    }

    // 7. Draw status bar message in center bottom
    ctx.font = "9px 'VT323', monospace";
    ctx.textAlign = "center";
    if (!this.gameOver) {
      ctx.fillText(this.statusMessage, this.width / 2, 90);
    } else {
      ctx.fillText("Game Over! Press SELECT to play again", this.width / 2, 90);
    }

    // 8. Game Over Screen Overlay
    if (this.gameOver) {
      ctx.fillStyle = pixelColor;
      ctx.fillRect(20, 24, this.width - 40, 48);
      
      const bgColor = getComputedStyle(document.getElementById('lcdScreen')).getPropertyValue('--lcd-bg').trim();
      ctx.fillStyle = bgColor;
      
      ctx.font = "bold 15px 'VT323', monospace";
      ctx.fillText(this.winnerMessage, this.width / 2, 40);
      
      ctx.font = "11px 'VT323', monospace";
      ctx.fillText(`Your Score: ${this.board[6]} | CPU: ${this.board[13]}`, this.width / 2, 58);
    }
  }

  handleInput(action) {
    if (this.gameOver) {
      if (action === 'SELECT') {
        this.start(this.speedLevel);
      }
      return;
    }

    if (this.inputBlocked || this.activePlayer !== 'PLAYER') return;

    switch (action) {
      case 'LEFT':
        this.sound.playClick();
        this.cursorIndex = (this.cursorIndex - 1 + 6) % 6;
        break;
      case 'RIGHT':
        this.sound.playClick();
        this.cursorIndex = (this.cursorIndex + 1) % 6;
        break;
      case 'SELECT':
        this.makePlayerMove();
        break;
    }
  }

  makePlayerMove() {
    const pitIdx = this.cursorIndex;
    if (this.board[pitIdx] === 0) {
      this.sound.playTone(180, 0.2, 'sawtooth'); // Error beep
      return; // Can't choose empty pit
    }

    this.sound.playClick();
    const hasExtraTurn = this.sowBeans(pitIdx);

    if (this.checkGameOver()) return;

    if (hasExtraTurn) {
      this.activePlayer = 'PLAYER';
      this.statusMessage = "Extra Turn!";
      this.sound.playLevelUp(); // Arpeggio beep
    } else {
      this.activePlayer = 'CPU';
      this.inputBlocked = true;
      this.statusMessage = "CPU thinking...";
      this.cpuTurnTimer = 10;
    }
  }

  makeCPUMove() {
    const bestPit = this.getBestCPUMove();
    if (bestPit === null) {
      this.checkGameOver();
      return;
    }

    this.sound.playClick();
    const hasExtraTurn = this.sowBeans(bestPit);

    if (this.checkGameOver()) return;

    if (hasExtraTurn) {
      this.activePlayer = 'CPU';
      this.cpuTurnTimer = 10; // Trigger CPU turn again after delay
      this.statusMessage = "CPU gets extra turn!";
      this.sound.playLevelUp();
    } else {
      this.activePlayer = 'PLAYER';
      this.inputBlocked = false;
      this.statusMessage = "Your Turn";
    }
  }

  sowBeans(startPit) {
    let beans = this.board[startPit];
    this.board[startPit] = 0;
    
    let currentIdx = startPit;
    const isPlayer = startPit < 6;

    while (beans > 0) {
      currentIdx = (currentIdx + 1) % 14;

      // Skip opponent store
      if (isPlayer && currentIdx === 13) continue; // Skip CPU store
      if (!isPlayer && currentIdx === 6) continue;  // Skip Player store

      this.board[currentIdx]++;
      beans--;
    }

    // Check last bean landing
    const ownStore = isPlayer ? 6 : 13;
    const ownSideStart = isPlayer ? 0 : 7;
    const ownSideEnd = isPlayer ? 5 : 12;

    // Rule: Lands in own store -> extra turn
    if (currentIdx === ownStore) {
      return true;
    }

    // Rule: Lands in empty pit on own side -> capture!
    if (currentIdx >= ownSideStart && currentIdx <= ownSideEnd && this.board[currentIdx] === 1) {
      const oppositeIdx = 12 - currentIdx;
      const oppositeBeans = this.board[oppositeIdx];
      
      if (oppositeBeans > 0) {
        // Collect own landing bean + opposite beans
        this.board[ownStore] += 1 + oppositeBeans;
        this.board[currentIdx] = 0;
        this.board[oppositeIdx] = 0;
        this.sound.playFood(); // Retro sound on capture!
      }
    }

    return false;
  }

  getBestCPUMove() {
    let bestRating = -Infinity;
    let bestPit = null;

    // Evaluate CPU pits 7 to 12
    for (let pit = 7; pit <= 12; pit++) {
      if (this.board[pit] === 0) continue;

      let rating = this.evaluateMove(pit);
      if (rating > bestRating) {
        bestRating = rating;
        bestPit = pit;
      }
    }

    return bestPit;
  }

  evaluateMove(startPit) {
    // Simulator for AI move decision
    // Create temporary copy of board
    let simBoard = [...this.board];
    let beans = simBoard[startPit];
    simBoard[startPit] = 0;

    let currentIdx = startPit;
    let storeGains = 0;

    while (beans > 0) {
      currentIdx = (currentIdx + 1) % 14;
      if (currentIdx === 6) continue; // Skip player store in simulation
      
      simBoard[currentIdx]++;
      beans--;
      if (currentIdx === 13) {
        storeGains++;
      }
    }

    let scoreRating = storeGains * 2;

    // Check extra turn
    if (currentIdx === 13) {
      scoreRating += 20; // High value for double turn
    }

    // Check capture
    if (currentIdx >= 7 && currentIdx <= 12 && simBoard[currentIdx] === 1) {
      const oppositeIdx = 12 - currentIdx;
      const oppositeBeans = simBoard[oppositeIdx];
      if (oppositeBeans > 0) {
        scoreRating += 15 + oppositeBeans * 2; // Capture is awesome
      }
    }

    // Defensive score: encourage emptying piles that are under threat
    // (Pits that player could capture on their next turn)
    // Also positional: favor leftmost CPU pits (closer to store) to move beans home
    scoreRating += (12 - startPit) * 0.5;

    return scoreRating;
  }

  checkGameOver() {
    const playerPitsEmpty = this.board.slice(0, 6).every(b => b === 0);
    const cpuPitsEmpty = this.board.slice(7, 13).every(b => b === 0);

    if (playerPitsEmpty || cpuPitsEmpty) {
      // Collect remaining beans
      let remainingPlayer = 0;
      for (let i = 0; i < 6; i++) {
        remainingPlayer += this.board[i];
        this.board[i] = 0;
      }
      this.board[6] += remainingPlayer;

      let remainingCPU = 0;
      for (let i = 7; i < 13; i++) {
        remainingCPU += this.board[i];
        this.board[i] = 0;
      }
      this.board[13] += remainingCPU;

      this.gameOver = true;
      this.score = this.board[6];

      if (this.board[6] > this.board[13]) {
        this.winnerMessage = "YOU WIN! 🎉";
        this.sound.playNokiaTune(); // Victory ringtone!
      } else if (this.board[6] < this.board[13]) {
        this.winnerMessage = "CPU WINS 📱";
        this.sound.playGameOver(); // Sad scale
      } else {
        this.winnerMessage = "ITS A DRAW! 🤝";
        this.sound.playTone(400, 0.4);
      }
      return true;
    }
    return false;
  }

  getScore() {
    return this.score;
  }

  isGameOver() {
    return this.gameOver;
  }
}

// Export globally for standard integration
window.Bantumi = Bantumi;
