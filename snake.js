/* ==========================================================================
   Nokia 3310 Retro Snake II Game Module
   Conforms to uniform LCD Game Module interface.
   ========================================================================== */

class SnakeGame {
  constructor(canvas, sound) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sound = sound;

    // Grid Dimensions
    this.GRID_CELL = 6;
    this.GRID_COLS = 168 / this.GRID_CELL; // 28
    this.GRID_ROWS = 96 / this.GRID_CELL; // 16

    // Maze configurations
    this.MAZE_LAYOUTS = [
      {
        name: 'Pillars',
        walls: [
          {x: 7, y: 4}, {x: 7, y: 5}, {x: 7, y: 6}, {x: 7, y: 7}, {x: 7, y: 8}, {x: 7, y: 9}, {x: 7, y: 10}, {x: 7, y: 11},
          {x: 20, y: 4}, {x: 20, y: 5}, {x: 20, y: 6}, {x: 20, y: 7}, {x: 20, y: 8}, {x: 20, y: 9}, {x: 20, y: 10}, {x: 20, y: 11}
        ]
      },
      {
        name: 'Labrynth',
        walls: [
          {x: 5, y: 3}, {x: 6, y: 3}, {x: 7, y: 3}, {x: 8, y: 3}, {x: 9, y: 3}, {x: 10, y: 3},
          {x: 17, y: 12}, {x: 18, y: 12}, {x: 19, y: 12}, {x: 20, y: 12}, {x: 21, y: 12}, {x: 22, y: 12},
          {x: 14, y: 5}, {x: 14, y: 6}, {x: 14, y: 7}, {x: 14, y: 8}, {x: 14, y: 9}, {x: 14, y: 10}
        ]
      }
    ];
  }

  start(speedLevel, selectedMode = 'classic1') {
    this.score = 0;
    this.foodsEaten = 0;
    this.speedLevel = speedLevel;
    this.selectedMode = selectedMode; // 'classic1', 'classic2', 'mazes'
    this.gameOver = false;
    this.direction = 'RIGHT';
    this.directionQueue = [];

    // Reset Snake centered in the screen grid
    const startX = Math.floor(this.GRID_COLS / 2);
    const startY = Math.floor(this.GRID_ROWS / 2);
    this.snake = [
      {x: startX, y: startY},
      {x: startX - 1, y: startY},
      {x: startX - 2, y: startY}
    ];

    // Select maze
    if (this.selectedMode === 'mazes') {
      this.activeMaze = this.MAZE_LAYOUTS[Math.floor(Math.random() * this.MAZE_LAYOUTS.length)];
    } else {
      this.activeMaze = null;
    }

    this.spawnFood();
  }

  spawnFood() {
    let valid = false;
    let rx, ry;
    
    while (!valid) {
      rx = Math.floor(Math.random() * (this.GRID_COLS - 2)) + 1;
      ry = Math.floor(Math.random() * (this.GRID_ROWS - 2)) + 1;
      
      // Ensure food doesn't land on snake body
      const hitsSnake = this.snake.some(part => part.x === rx && part.y === ry);
      
      // Ensure food doesn't land on a maze wall obstacle
      let hitsWall = false;
      if (this.selectedMode === 'mazes' && this.activeMaze) {
        hitsWall = this.activeMaze.walls.some(w => w.x === rx && w.y === ry);
      }
      
      if (!hitsSnake && !hitsWall) {
        valid = true;
      }
    }
    
    this.food = {x: rx, y: ry};
  }

  step() {
    if (this.gameOver) return;

    // Apply next direction queue
    if (this.directionQueue.length > 0) {
      this.direction = this.directionQueue.shift();
    }

    // Determine current head location
    const head = this.snake[0];
    let newHead = {x: head.x, y: head.y};

    switch (this.direction) {
      case 'UP':    newHead.y -= 1; break;
      case 'DOWN':  newHead.y += 1; break;
      case 'LEFT':  newHead.x -= 1; break;
      case 'RIGHT': newHead.x += 1; break;
    }

    // Collision Detection: Screen Borders
    if (newHead.x < 0 || newHead.x >= this.GRID_COLS || newHead.y < 0 || newHead.y >= this.GRID_ROWS) {
      if (this.selectedMode === 'classic2') {
        // Classic II Mode: Wrap around boundaries
        newHead.x = (newHead.x + this.GRID_COLS) % this.GRID_COLS;
        newHead.y = (newHead.y + this.GRID_ROWS) % this.GRID_ROWS;
      } else {
        // Classic I / Mazes: Borders are absolute death
        this.triggerGameOver();
        return;
      }
    }

    // Collision Detection: Self Body
    const selfHit = this.snake.slice(0, -1).some(part => part.x === newHead.x && part.y === newHead.y);
    if (selfHit) {
      this.triggerGameOver();
      return;
    }

    // Collision Detection: Maze Wall Obstacles
    if (this.selectedMode === 'mazes' && this.activeMaze) {
      const hitWall = this.activeMaze.walls.some(w => w.x === newHead.x && w.y === newHead.y);
      if (hitWall) {
        this.triggerGameOver();
        return;
      }
    }

    // Insert new head coordinates to front
    this.snake.unshift(newHead);

    // Collision Detection: Food Eaten
    if (newHead.x === this.food.x && newHead.y === this.food.y) {
      // Snake grows! We do not pop tail.
      this.score += this.speedLevel * 10;
      this.foodsEaten += 1;
      
      this.sound.playFood(); // Synth chime!
      
      // Speed escalation mechanics in wrap-around Mode (Classic II)
      if (this.selectedMode === 'classic2' && this.foodsEaten % 5 === 0) {
        this.speedLevel = Math.min(9, this.speedLevel + 1);
        this.sound.playLevelUp(); // Level up fanfare!
        // Dispatch callback if needed to trigger update in central loop interval
        if (this.onSpeedChange) {
          this.onSpeedChange(this.speedLevel);
        }
      }

      this.spawnFood();
    } else {
      // Standard step. Pop tail to maintain length.
      this.snake.pop();
    }
  }

  triggerGameOver() {
    this.gameOver = true;
  }

  draw(ctx) {
    const pixelColor = getComputedStyle(document.getElementById('lcdScreen')).getPropertyValue('--lcd-pixel').trim();
    const bgColor = getComputedStyle(document.getElementById('lcdScreen')).getPropertyValue('--lcd-bg').trim();
    
    // 1. Draw Snake
    this.snake.forEach((part, index) => {
      ctx.fillStyle = pixelColor;
      ctx.strokeStyle = pixelColor;
      const isHead = index === 0;
      
      const px = part.x * this.GRID_CELL;
      const py = part.y * this.GRID_CELL;
      
      if (isHead) {
        ctx.fillRect(px, py, this.GRID_CELL, this.GRID_CELL);
      } else {
        // Detailed Nokia segment style
        ctx.strokeRect(px + 1, py + 1, this.GRID_CELL - 2, this.GRID_CELL - 2);
        ctx.fillRect(px + 2, py + 2, this.GRID_CELL - 4, this.GRID_CELL - 4);
      }
    });

    // 2. Draw Food
    const fx = this.food.x * this.GRID_CELL;
    const fy = this.food.y * this.GRID_CELL;
    const pulse = Math.floor(Date.now() / 150) % 2 === 0;
    
    ctx.fillStyle = pixelColor;
    ctx.strokeStyle = pixelColor;
    if (pulse) {
      ctx.fillRect(fx + 1, fy + 1, this.GRID_CELL - 2, this.GRID_CELL - 2);
    } else {
      ctx.fillRect(fx + 2, fy + 2, this.GRID_CELL - 4, this.GRID_CELL - 4);
      ctx.strokeRect(fx + 1, fy + 1, this.GRID_CELL - 2, this.GRID_CELL - 2);
    }

    // 3. Draw Maze Obstacles (if in Mazes Mode)
    if (this.selectedMode === 'mazes' && this.activeMaze) {
      this.activeMaze.walls.forEach(w => {
        const wx = w.x * this.GRID_CELL;
        const wy = w.y * this.GRID_CELL;
        
        ctx.fillStyle = pixelColor;
        ctx.fillRect(wx, wy, this.GRID_CELL, this.GRID_CELL);
        ctx.fillStyle = bgColor;
        ctx.fillRect(wx + 1, wy + 1, this.GRID_CELL - 2, this.GRID_CELL - 2);
        ctx.fillStyle = pixelColor;
        ctx.fillRect(wx + 2, wy + 2, this.GRID_CELL - 4, this.GRID_CELL - 4);
      });
    }
  }

  handleInput(action) {
    const lastDir = this.directionQueue.length > 0 ? this.directionQueue[this.directionQueue.length - 1] : this.direction;

    if (action === 'UP' && lastDir !== 'DOWN') {
      this.directionQueue.push('UP');
    } else if (action === 'DOWN' && lastDir !== 'UP') {
      this.directionQueue.push('DOWN');
    } else if (action === 'LEFT' && lastDir !== 'RIGHT') {
      this.directionQueue.push('LEFT');
    } else if (action === 'RIGHT' && lastDir !== 'LEFT') {
      this.directionQueue.push('RIGHT');
    }
  }

  getScore() {
    return this.score;
  }

  isGameOver() {
    return this.gameOver;
  }
}

// Export class globally
window.SnakeGame = SnakeGame;
