/**
 * Nokia 3310 Retro Tetris Game Module
 * Highly polished, retro-authentic monochrome LCD Tetris game.
 * Exposes global class: TetrisGame
 */

// Define classic Tetromino shapes in 2D grid matrix representations.
// Each matrix is square (2x2, 3x3, 4x4) to enable clean rotation about its center.
const TETROMINOES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0]
  ]
};

class TetrisGame {
  /**
   * constructor - stores references and sets up display/grid dimensions.
   * @param {HTMLCanvasElement} canvas
   * @param {SoundEngine} sound
   */
  constructor(canvas, sound) {
    this.canvas = canvas;
    this.sound = sound;

    // Constants based on design specifications
    this.cellSize = 6;
    this.cols = 10;
    this.rows = 15;

    // Center the 10x15 grid on the 168x96 canvas
    // Width: 10 * 6 = 60px. Offset = (168 - 60) / 2 = 54px.
    // Height: 15 * 6 = 90px. Offset = (96 - 90) / 2 = 3px.
    this.offsetX = 54;
    this.offsetY = 3;

    // Random bag list for fair tetromino distribution (7-bag system)
    this.bag = [];
    
    // Default fallback values
    this.score = 0;
    this.linesCleared = 0;
    this.gameOver = false;
    this.speedLevel = 4;
    this.grid = [];
  }

  /**
   * Initializes the game state and starts playing.
   * @param {number} speedLevel - range 1 to 9
   */
  start(speedLevel) {
    this.score = 0;
    this.linesCleared = 0;
    this.gameOver = false;
    this.speedLevel = speedLevel || 4;
    this.bag = [];

    // Initialize the grid to all 0s (10x15 empty cells)
    this.grid = Array.from({ length: this.rows }, () => new Array(this.cols).fill(0));

    // Spawn initial blocks
    this.nextPiece = this.getRandomPiece();
    this.spawnPiece();
  }

  /**
   * Generates a random piece using the classic 7-bag randomizer system.
   * This guarantees a balanced and fair distribution of blocks.
   * @returns {Object} Tetromino block object
   */
  getRandomPiece() {
    if (this.bag.length === 0) {
      this.bag = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
      // Fisher-Yates Shuffle
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    const type = this.bag.pop();
    return {
      type: type,
      matrix: JSON.parse(JSON.stringify(TETROMINOES[type])),
      x: 0,
      y: 0
    };
  }

  /**
   * Spawns the next piece onto the board at the top center.
   * Checks for game over collision immediately on spawn.
   */
  spawnPiece() {
    this.currentPiece = this.nextPiece;
    this.nextPiece = this.getRandomPiece();

    // Spawn centered horizontally at the top row (y = 0)
    const pieceWidth = this.currentPiece.matrix[0].length;
    this.currentPiece.x = Math.floor((this.cols - pieceWidth) / 2);
    this.currentPiece.y = 0;

    // Check if the newly spawned piece collides immediately with locked blocks
    if (this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y)) {
      this.gameOver = true;
      if (this.sound) {
        this.sound.playGameOver();
      }
    }
  }

  /**
   * Checks if placing a given piece matrix at (px, py) will cause a collision.
   * @param {Array<Array<number>>} matrix - Tetromino grid representation
   * @param {number} px - Proposed X column position
   * @param {number} py - Proposed Y row position
   * @returns {boolean} True if collision detected
   */
  checkCollision(matrix, px, py) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const nextX = px + c;
          const nextY = py + r;

          // Out of horizontal bounds (walls)
          if (nextX < 0 || nextX >= this.cols) {
            return true;
          }

          // Out of vertical bounds (bottom floor)
          if (nextY >= this.rows) {
            return true;
          }

          // Overlaps with frozen/locked grid blocks
          // We allow y < 0 (above grid entry) but anything on the grid (y >= 0) must be checked
          if (nextY >= 0 && this.grid[nextY][nextX] !== 0) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Rotates a 2D square matrix clockwise.
   * @param {Array<Array<number>>} matrix
   * @returns {Array<Array<number>>} Rotated matrix
   */
  rotateMatrix(matrix) {
    const n = matrix.length;
    const result = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        result[c][n - 1 - r] = matrix[r][c];
      }
    }
    return result;
  }

  /**
   * Advances the game state by one physics tick.
   * Drops the piece. If it cannot move further, locks it and clears full lines.
   */
  step() {
    if (this.gameOver) return;

    // Try moving the piece down
    if (!this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y + 1)) {
      this.currentPiece.y += 1;
    } else {
      // Piece landed: freeze it onto the game board grid
      this.freezePiece();

      // Check and clear any filled lines
      this.clearLines();

      // Spawn next piece
      this.spawnPiece();
    }
  }

  /**
   * Locks the active piece blocks onto the board's permanent grid.
   */
  freezePiece() {
    const matrix = this.currentPiece.matrix;
    const px = this.currentPiece.x;
    const py = this.currentPiece.y;

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const gridX = px + c;
          const gridY = py + r;

          // Lock block inside valid grid rows
          if (gridY >= 0 && gridY < this.rows && gridX >= 0 && gridX < this.cols) {
            this.grid[gridY][gridX] = 1;
          }
        }
      }
    }
  }

  /**
   * Scans the grid for filled lines, removes them, and drops down remaining lines.
   * Awards classic NES-style proportional score multipliers.
   */
  clearLines() {
    let clearedCount = 0;

    for (let r = this.rows - 1; r >= 0; r--) {
      // Check if every cell in row r is filled (non-zero)
      if (this.grid[r].every(cell => cell !== 0)) {
        this.grid.splice(r, 1);
        this.grid.unshift(new Array(this.cols).fill(0));
        clearedCount++;
        r++; // Recheck same row index since remaining rows shifted down
      }
    }

    if (clearedCount > 0) {
      this.linesCleared += clearedCount;

      // Classic retro points multiplier scale
      const lineScores = [0, 100, 300, 500, 800];
      this.score += lineScores[clearedCount] * this.speedLevel;

      // Play quick cheerful chiptune arpeggio triggers
      if (this.sound) {
        this.sound.playTone(587.33, 0.08, 'square', 0);    // D5
        this.sound.playTone(880.00, 0.12, 'square', 0.06);  // A5
      }
    }
  }

  /**
   * Handles button inputs from the on-screen nokia pad or keyboard.
   * @param {string} action - 'UP', 'DOWN', 'LEFT', 'RIGHT', 'SELECT', 'BACK'
   */
  handleInput(action) {
    if (this.gameOver) return;

    switch (action) {
      case 'UP': {
        // Rotate piece clockwise with small wall-kick tolerances for highly responsive feel
        const rotated = this.rotateMatrix(this.currentPiece.matrix);
        let success = false;

        // Try standard rotation first
        if (!this.checkCollision(rotated, this.currentPiece.x, this.currentPiece.y)) {
          this.currentPiece.matrix = rotated;
          success = true;
        } else {
          // Wall kick kicks: Left 1, Right 1, Left 2, Right 2
          const kicks = [-1, 1, -2, 2];
          for (const kick of kicks) {
            if (!this.checkCollision(rotated, this.currentPiece.x + kick, this.currentPiece.y)) {
              this.currentPiece.x += kick;
              this.currentPiece.matrix = rotated;
              success = true;
              break;
            }
          }
        }

        if (success && this.sound) {
          this.sound.playClick();
        }
        break;
      }

      case 'LEFT': {
        if (!this.checkCollision(this.currentPiece.matrix, this.currentPiece.x - 1, this.currentPiece.y)) {
          this.currentPiece.x -= 1;
          if (this.sound) this.sound.playClick();
        }
        break;
      }

      case 'RIGHT': {
        if (!this.checkCollision(this.currentPiece.matrix, this.currentPiece.x + 1, this.currentPiece.y)) {
          this.currentPiece.x += 1;
          if (this.sound) this.sound.playClick();
        }
        break;
      }

      case 'DOWN': {
        // Soft drop
        if (!this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y + 1)) {
          this.currentPiece.y += 1;
          this.score += 1; // Soft drop bonus points
          if (this.sound) {
            this.sound.playTone(220.00, 0.02, 'square'); // Quick low-pitched tick
          }
        }
        break;
      }

      case 'SELECT': {
        // Hard drop instantly and lock
        let dropDistance = 0;
        while (!this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y + 1)) {
          this.currentPiece.y += 1;
          dropDistance++;
        }

        this.score += dropDistance * 2; // Hard drop bonus points

        if (this.sound) {
          // Retro Nokia quick double arpeggio (food-like beep)
          this.sound.playTone(880, 0.06, 'square', 0);
          this.sound.playTone(1320, 0.08, 'square', 0.05);
        }

        // Lock instantly, score line clears, and spawn next block
        this.freezePiece();
        this.clearLines();
        this.spawnPiece();
        break;
      }

      case 'BACK': {
        if (this.sound) {
          this.sound.playClick();
        }
        break;
      }
    }
  }

  /**
   * Helper function to draw a single 6x6 pixel block in monochrome LCD style.
   * Uses 1-pixel margins to simulate retro screen physical liquid crystal segments.
   */
  drawBlock(ctx, col, row, color) {
    const x = this.offsetX + col * this.cellSize;
    const y = this.offsetY + row * this.cellSize;

    ctx.fillStyle = color;
    // Draw hollow-ish pixel block styled in premium 90s aesthetic
    ctx.fillRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, this.cellSize, this.cellSize);
  }

  /**
   * Primary visual rendering method.
   * Renders centered board grid, active piece, next piece queue, HUD text.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    // Dynamically retrieve backlight and pixel colors from LCD container settings
    const lcdScreen = document.getElementById('lcdScreen');
    const styles = lcdScreen ? getComputedStyle(lcdScreen) : null;
    const bgColor = styles ? styles.getPropertyValue('--lcd-bg').trim() : '#b8c69f';
    const pixelColor = styles ? styles.getPropertyValue('--lcd-pixel').trim() : '#2b3b26';

    // 1. Clear Canvas background to match chosen Nokia color skin
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 168, 96);

    // 2. Render Board Outer Framing & Borders
    ctx.strokeStyle = pixelColor;
    ctx.lineWidth = 1;
    // Outline slightly larger than 10x15 grid (60x90 px) to separate game board from HUDs
    ctx.strokeRect(this.offsetX - 2, this.offsetY - 2, (this.cols * this.cellSize) + 4, (this.rows * this.cellSize) + 4);

    // 3. Render Locked Blocks from Grid matrix
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] !== 0) {
          this.drawBlock(ctx, c, r, pixelColor);
        }
      }
    }

    // 4. Render Active Block (if not game over)
    if (!this.gameOver && this.currentPiece) {
      const matrix = this.currentPiece.matrix;
      const px = this.currentPiece.x;
      const py = this.currentPiece.y;

      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c] !== 0) {
            const gridY = py + r;
            const gridX = px + c;

            // Only draw piece blocks if they have landed on the visible screen grid area
            if (gridY >= 0 && gridY < this.rows && gridX >= 0 && gridX < this.cols) {
              this.drawBlock(ctx, gridX, gridY, pixelColor);
            }
          }
        }
      }
    }

    // 5. Draw left-hand HUD panel: Game Title, Score, Level
    ctx.fillStyle = pixelColor;
    ctx.textAlign = 'center';
    ctx.font = "bold 14px 'VT323', monospace";
    ctx.fillText("TETRIS", 27, 20);

    ctx.font = "10px 'VT323', monospace";
    ctx.fillText("SCORE", 27, 40);
    ctx.font = "bold 12px 'VT323', monospace";
    ctx.fillText(String(this.score), 27, 52);

    ctx.font = "10px 'VT323', monospace";
    ctx.fillText("LEVEL", 27, 72);
    ctx.font = "bold 12px 'VT323', monospace";
    ctx.fillText(String(this.speedLevel), 27, 84);

    // 6. Draw right-hand HUD panel: Next Piece, Lines Cleared
    ctx.font = "10px 'VT323', monospace";
    ctx.fillText("NEXT", 141, 20);

    // Next piece queue bounding box outline (32x32)
    const nextBoxX = 125;
    const nextBoxY = 24;
    ctx.strokeStyle = pixelColor;
    ctx.strokeRect(nextBoxX, nextBoxY, 32, 32);

    // Draw centering next block piece within the bounding box
    if (this.nextPiece) {
      const nextMatrix = this.nextPiece.matrix;
      const N = nextMatrix.length;
      // Center standard matrices inside the box
      const previewOffsetX = nextBoxX + Math.floor((32 - N * this.cellSize) / 2);
      const previewOffsetY = nextBoxY + Math.floor((32 - N * this.cellSize) / 2);

      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (nextMatrix[r][c] !== 0) {
            const px = previewOffsetX + c * this.cellSize;
            const py = previewOffsetY + r * this.cellSize;

            ctx.fillStyle = pixelColor;
            ctx.fillRect(px + 1, py + 1, this.cellSize - 2, this.cellSize - 2);
            ctx.strokeStyle = pixelColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(px, py, this.cellSize, this.cellSize);
          }
        }
      }
    }

    ctx.fillStyle = pixelColor;
    ctx.font = "10px 'VT323', monospace";
    ctx.fillText("LINES", 141, 72);
    ctx.font = "bold 12px 'VT323', monospace";
    ctx.fillText(String(this.linesCleared), 141, 84);

    // 7. Render Game Over overlay screen centered above board
    if (this.gameOver) {
      ctx.fillStyle = pixelColor;
      ctx.fillRect(this.offsetX + 4, this.offsetY + 30, (this.cols * this.cellSize) - 8, 30);

      ctx.fillStyle = bgColor;
      ctx.font = "bold 13px 'VT323', monospace";
      ctx.textAlign = 'center';
      ctx.fillText("GAME OVER", this.offsetX + (this.cols * this.cellSize) / 2, this.offsetY + 44);
      ctx.font = "9px 'VT323', monospace";
      ctx.fillText("Try Again", this.offsetX + (this.cols * this.cellSize) / 2, this.offsetY + 54);
    }
  }

  /**
   * Returns current accumulated score value.
   * @returns {number} score
   */
  getScore() {
    return this.score;
  }

  /**
   * Returns state check if game is finished.
   * @returns {boolean} gameOver
   */
  isGameOver() {
    return this.gameOver;
  }
}

// Export the TetrisGame class globally
window.TetrisGame = TetrisGame;
