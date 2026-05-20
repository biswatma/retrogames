/**
 * Pairs II - Classic Nokia 3310 Memory Card Matching Game
 * Fully polished for 168x96 monochrome LCD screen.
 */
class PairsII {
  constructor(canvas, sound) {
    this.canvas = canvas;
    this.sound = sound;
    this.width = 168;   // 168
    this.height = 96; // 96
    
    // Grid geometry (symmetrical)
    this.cardWidth = 32;
    this.cardHeight = 20;
    this.gapX = 8;
    this.gapY = 9;
    this.startX = 8;
    this.startY = 9;

    this.reset();
  }

  reset() {
    this.cards = [];
    this.cursorCol = 0;
    this.cursorRow = 0;
    this.firstFlippedIndex = null;
    this.secondFlippedIndex = null;
    this.inputBlocked = false;
    this.flipBackTimer = 0;
    
    this.score = 0;
    this.moves = 0;
    this.matches = 0;
    this.gameOver = false;
    this.speedLevel = 4;
  }

  start(speedLevel) {
    this.reset();
    this.speedLevel = speedLevel;
    
    // Generate 6 pairs (IDs 0 to 5)
    let ids = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
    
    // Fisher-Yates Shuffle
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }

    // Populate card grid (4 columns x 3 rows = 12 cards)
    this.cards = ids.map(id => ({
      id: id,
      flipped: false,
      matched: false
    }));
  }

  step() {
    if (this.gameOver) return;

    if (this.flipBackTimer > 0) {
      this.flipBackTimer--;
      if (this.flipBackTimer === 0) {
        // Flip back
        if (this.firstFlippedIndex !== null && this.secondFlippedIndex !== null) {
          this.cards[this.firstFlippedIndex].flipped = false;
          this.cards[this.secondFlippedIndex].flipped = false;
        }
        this.firstFlippedIndex = null;
        this.secondFlippedIndex = null;
        this.inputBlocked = false;
      }
    }
  }

  draw(ctx) {
    // 1. Draw game board layout (dotted mesh or clean LCD green background)
    // Clear screen is handled by the engine, but let's make sure we set correct colors
    const pixelColor = getComputedStyle(document.getElementById('lcdScreen')).getPropertyValue('--lcd-pixel').trim();
    ctx.strokeStyle = pixelColor;
    ctx.fillStyle = pixelColor;
    ctx.lineWidth = 1;

    // 2. Draw Cards
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const index = row * 4 + col;
        const card = this.cards[index];
        if (!card) continue;

        const x = this.startX + col * (this.cardWidth + this.gapX);
        const y = this.startY + row * (this.cardHeight + this.gapY);

        ctx.save();
        
        if (card.matched) {
          // Matched: Draw symbol with dotted border
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(x, y, this.cardWidth, this.cardHeight);
          this.drawSymbol(ctx, x, y, card.id);
        } else if (card.flipped) {
          // Flipped (Face Up): Solid card with unique symbol
          ctx.strokeRect(x, y, this.cardWidth, this.cardHeight);
          // Small inner border for extra depth
          ctx.strokeRect(x + 2, y + 2, this.cardWidth - 4, this.cardHeight - 4);
          this.drawSymbol(ctx, x, y, card.id);
        } else {
          // Face Down: Retro pattern (envelope style)
          ctx.strokeRect(x, y, this.cardWidth, this.cardHeight);
          // Diagonal corner lines to form retro bevel pattern
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 3, y + 3);
          ctx.moveTo(x + this.cardWidth, y);
          ctx.lineTo(x + this.cardWidth - 3, y + 3);
          ctx.moveTo(x, y + this.cardHeight);
          ctx.lineTo(x + 3, y + this.cardHeight - 3);
          ctx.moveTo(x + this.cardWidth, y + this.cardHeight);
          ctx.lineTo(x + this.cardWidth - 3, y + this.cardHeight - 3);
          ctx.stroke();
          // Inner rectangle
          ctx.strokeRect(x + 3, y + 3, this.cardWidth - 6, this.cardHeight - 6);
          // Tiny "?" in the absolute center
          ctx.font = "bold 9px 'VT323', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("?", x + this.cardWidth / 2, y + this.cardHeight / 2);
        }

        ctx.restore();
      }
    }

    // 3. Draw Blinking Cursor
    if (!this.gameOver) {
      const isBlinkOn = Math.floor(Date.now() / 250) % 2 === 0;
      if (isBlinkOn) {
        const curX = this.startX + this.cursorCol * (this.cardWidth + this.gapX);
        const curY = this.startY + this.cursorRow * (this.cardHeight + this.gapY);
        
        ctx.save();
        ctx.strokeStyle = pixelColor;
        ctx.lineWidth = 2;
        // Bold outer selection frame
        ctx.strokeRect(curX - 2, curY - 2, this.cardWidth + 4, this.cardHeight + 4);
        ctx.restore();
      }
    }

    // 4. Render win or game over messages
    if (this.gameOver) {
      ctx.fillStyle = pixelColor;
      ctx.fillRect(16, 28, this.width - 32, 40);
      
      const bgColor = getComputedStyle(document.getElementById('lcdScreen')).getPropertyValue('--lcd-bg').trim();
      ctx.fillStyle = bgColor;
      
      ctx.font = "bold 16px 'VT323', monospace";
      ctx.textAlign = "center";
      ctx.fillText("Pairs II Solved!", this.width / 2, 44);
      
      ctx.font = "11px 'VT323', monospace";
      ctx.fillText(`Score: ${this.score} (${this.moves} Moves)`, this.width / 2, 60);
    }
  }

  drawSymbol(ctx, x, y, symbolId) {
    const cx = x + this.cardWidth / 2;
    const cy = y + this.cardHeight / 2;

    ctx.save();
    const pixelColor = getComputedStyle(document.getElementById('lcdScreen')).getPropertyValue('--lcd-pixel').trim();
    ctx.strokeStyle = pixelColor;
    ctx.fillStyle = pixelColor;
    ctx.lineWidth = 1.5;

    switch (symbolId) {
      case 0: // Star (8-pointed)
        ctx.beginPath();
        ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6);
        ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy);
        ctx.moveTo(cx - 5, cy - 4); ctx.lineTo(cx + 5, cy + 4);
        ctx.moveTo(cx - 5, cy + 4); ctx.lineTo(cx + 5, cy - 4);
        ctx.stroke();
        break;

      case 1: // Filled Box
        ctx.fillRect(cx - 4, cy - 4, 8, 8);
        break;

      case 2: // Double Circle
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, 2 * Math.PI);
        ctx.stroke();
        break;

      case 3: // Triangle
        ctx.beginPath();
        ctx.moveTo(cx, cy - 6);
        ctx.lineTo(cx - 6, cy + 5);
        ctx.lineTo(cx + 6, cy + 5);
        ctx.closePath();
        ctx.stroke();
        break;

      case 4: // Diamond
        ctx.beginPath();
        ctx.moveTo(cx, cy - 6);
        ctx.lineTo(cx + 6, cy);
        ctx.lineTo(cx, cy + 6);
        ctx.lineTo(cx - 6, cy);
        ctx.closePath();
        ctx.stroke();
        break;

      case 5: // Heavy Cross (X)
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy - 5); ctx.lineTo(cx + 5, cy + 5);
        ctx.moveTo(cx - 5, cy + 5); ctx.lineTo(cx + 5, cy - 5);
        ctx.stroke();
        break;
    }
    ctx.restore();
  }

  handleInput(action) {
    if (this.gameOver) {
      if (action === 'SELECT') {
        this.start(this.speedLevel);
      }
      return;
    }

    if (this.inputBlocked) return;

    switch (action) {
      case 'UP':
        this.sound.playClick();
        this.cursorRow = (this.cursorRow - 1 + 3) % 3;
        break;
      case 'DOWN':
        this.sound.playClick();
        this.cursorRow = (this.cursorRow + 1) % 3;
        break;
      case 'LEFT':
        this.sound.playClick();
        this.cursorCol = (this.cursorCol - 1 + 4) % 4;
        break;
      case 'RIGHT':
        this.sound.playClick();
        this.cursorCol = (this.cursorCol + 1) % 4;
        break;
      case 'SELECT':
        this.flipSelectedCard();
        break;
    }
  }

  flipSelectedCard() {
    const index = this.cursorRow * 4 + this.cursorCol;
    const card = this.cards[index];

    // Already flipped or matched
    if (card.flipped || card.matched) return;

    this.sound.playClick();
    card.flipped = true;

    if (this.firstFlippedIndex === null) {
      this.firstFlippedIndex = index;
    } else {
      this.secondFlippedIndex = index;
      this.moves++;
      
      // Match check
      const firstCard = this.cards[this.firstFlippedIndex];
      const secondCard = this.cards[this.secondFlippedIndex];

      if (firstCard.id === secondCard.id) {
        // MATCH!
        firstCard.matched = true;
        secondCard.matched = true;
        this.matches++;
        
        // High score calculation based on efficiency
        this.score += Math.max(10, 80 - this.moves * 3);
        this.sound.playFood(); // Nostalgic beep

        this.firstFlippedIndex = null;
        this.secondFlippedIndex = null;

        if (this.matches === 6) {
          this.gameOver = true;
          this.sound.playLevelUp(); // Victory fanfare
        }
      } else {
        // MISMATCH! Block input and start timer to flip back
        this.inputBlocked = true;
        this.flipBackTimer = 8; // ~800ms
        this.sound.playTone(200, 0.2, 'sawtooth'); // Error buzz
      }
    }
  }

  getScore() {
    return this.score;
  }

  isGameOver() {
    return this.gameOver;
  }
}

// Export globally for standard integration
window.PairsII = PairsII;
