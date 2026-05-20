/* ==========================================================================
   Space Impact Retro Game Module for Nokia 3310 Simulation
   Exposes: global SpaceImpactGame class
   Resolution: 168x96 monochrome LCD
   ========================================================================== */

class SpaceImpactGame {
  constructor(canvas, sound) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.sound = sound;

    // Sprite graphics definition (Monochrome Retro Pixels)
    this.sprites = {
      player: [
        "  #     ",
        "  ##    ",
        " ####   ",
        "########",
        "########",
        " ####   ",
        "  ##    ",
        "  #     "
      ],
      enemy1: [
        "   ##   ",
        " #####  ",
        "####### ",
        "## # ## ",
        " #####  ",
        "   ##   "
      ],
      enemy2: [
        "   #    ",
        "  ###   ",
        " #####  ",
        "####### ",
        "####### ",
        " #####  ",
        "  ###   ",
        "   #    "
      ],
      enemy3: [
        "    ##### ",
        "  ####### ",
        " ######## ",
        "##########",
        "###   ####",
        "###   ####",
        "##########",
        " ######## ",
        "  ####### ",
        "    ##### "
      ],
      boss: [
        "       ######           ",
        "     ##########         ",
        "    ############        ",
        "   ####  ########       ",
        "  ####    ########      ",
        "  ###  #   #######      ",
        " ###  ###   ######      ",
        "#######      #####      ",
        "######        ####      ",
        "#######      #####      ",
        " ###  ###   ######      ",
        "  ###  #   #######      ",
        "  ####    ########      ",
        "   ####  ########       ",
        "    ############        ",
        "     ##########         ",
        "       ######           "
      ],
      powerupShield: [
        "#######",
        "# ### #",
        "# #   #",
        "#  ## #",
        "#   # #",
        "# ### #",
        "#######"
      ],
      powerupDouble: [
        "#######",
        "# ##  #",
        "# # # #",
        "# # # #",
        "# # # #",
        "# ##  #",
        "#######"
      ]
    };
  }

  // Helper to play sounds safely
  playSFX(type) {
    if (!this.sound || typeof this.sound.playTone !== 'function') return;
    try {
      if (type === 'laser') {
        this.sound.playTone(1000, 0.05);
      } else if (type === 'hit') {
        this.sound.playTone(480, 0.04);
      } else if (type === 'explosion') {
        this.sound.playTone(220, 0.12);
      } else if (type === 'boss_explosion') {
        this.sound.playTone(150, 0.3);
        setTimeout(() => this.sound.playTone(100, 0.3), 150);
      } else if (type === 'gameover') {
        this.sound.playTone(300, 0.2);
        setTimeout(() => this.sound.playTone(200, 0.2), 200);
        setTimeout(() => this.sound.playTone(120, 0.4), 400);
      } else if (type === 'boss_laser') {
        this.sound.playTone(650, 0.06);
      } else if (type === 'powerup') {
        this.sound.playTone(880, 0.06);
        setTimeout(() => this.sound.playTone(1320, 0.08), 60);
      } else if (type === 'victory') {
        this.sound.playTone(1046.50, 0.08); // C6
        setTimeout(() => this.sound.playTone(1318.51, 0.08), 80); // E6
        setTimeout(() => this.sound.playTone(1567.98, 0.08), 160); // G6
        setTimeout(() => this.sound.playTone(2093.00, 0.15), 240); // C7
      }
    } catch (e) {
      console.warn("Sound playback error:", e);
    }
  }

  start(speedLevel) {
    this.speedLevel = speedLevel || 4;
    this.score = 0;
    
    // Player ship state
    this.player = {
      x: 10,
      y: 48,
      shield: 100,
      width: 8,
      height: 8
    };

    this.level = 1;
    this.enemiesDestroyed = 0;
    this.bossActive = false;
    this.bossSpawned = false;
    this.gameOver = false;
    this.victoryTimer = 0;

    // Entity pools
    this.bullets = [];        // Player bullets: {x, y, w, h}
    this.enemyBullets = [];   // Enemy bullets: {x, y, w, h, isBossLaser}
    this.enemies = [];        // Enemy ships: {x, y, type, health, w, h}
    this.powerups = [];       // Floating powerups: {x, y, type, w, h}
    this.particles = [];      // Explosive pixel particles: {x, y, vx, vy, life}
    this.boss = null;         // Boss entity: {x, y, health, maxHealth, vy, w, h}

    // Double shot status
    this.doubleShotTimer = 0;
    this.lastShotTime = 0;

    // Stars background (12 elements scroll effect)
    this.stars = [];
    for (let i = 0; i < 12; i++) {
      this.stars.push({
        x: Math.random() * 168,
        y: Math.random() * 82 + 14, // Keep under HUD
        speed: Math.random() * 0.8 + 0.2
      });
    }
  }

  step() {
    if (this.gameOver) return;

    // Handle Victory transition delay
    if (this.victoryTimer > 0) {
      this.victoryTimer--;
      
      // Update background and particles for continuity
      this.stars.forEach(star => {
        star.x -= star.speed * 0.5;
        if (star.x < 0) {
          star.x = 168;
          star.y = Math.random() * 82 + 14;
        }
      });

      this.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
      });
      this.particles = this.particles.filter(p => p.life > 0);

      if (this.victoryTimer === 0) {
        // Increment level, scale difficulty
        this.level++;
        this.speedLevel = Math.min(9, this.speedLevel + 1);
        this.player.shield = Math.min(100, this.player.shield + 30);
        
        // Reset level status
        this.enemiesDestroyed = 0;
        this.bossActive = false;
        this.bossSpawned = false;
        this.boss = null;
        
        // Flush remaining entities
        this.enemies = [];
        this.bullets = [];
        this.enemyBullets = [];
        this.powerups = [];
      }
      return;
    }

    // 1. Scroll stars background
    this.stars.forEach(star => {
      star.x -= star.speed * (this.speedLevel * 0.15 + 0.6);
      if (star.x < 0) {
        star.x = 168;
        star.y = Math.random() * 82 + 14;
      }
    });

    // 2. Update particles
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
    });
    this.particles = this.particles.filter(p => p.life > 0);

    // 3. Move player bullets right
    this.bullets.forEach(b => {
      b.x += 4.5;
    });
    this.bullets = this.bullets.filter(b => b.x <= 168);

    // 4. Move enemy bullets left
    this.enemyBullets.forEach(eb => {
      eb.x -= eb.isBossLaser ? 3.5 : 2.5;
    });
    this.enemyBullets = this.enemyBullets.filter(eb => eb.x >= 0);

    // 5. Move powerups left
    this.powerups.forEach(pw => {
      pw.x -= 1.0;
    });
    this.powerups = this.powerups.filter(pw => pw.x >= -10);

    // 6. Double shot timer decay
    if (this.doubleShotTimer > 0) {
      this.doubleShotTimer--;
    }

    // 7. Move enemies left
    this.enemies.forEach(e => {
      if (e.type === 1) {
        e.x -= 1.0 + (this.speedLevel * 0.05);
      } else if (e.type === 2) {
        e.x -= 1.8 + (this.speedLevel * 0.05);
        // Sinusoidal zigzag
        e.y += Math.sin(e.x * 0.08) * 0.8;
        e.y = Math.max(14, Math.min(96 - 8, e.y));
      } else if (e.type === 3) {
        e.x -= 0.6 + (this.speedLevel * 0.02);
      }
    });

    // Handle enemies slipping past player (shield penalty)
    this.enemies.forEach(e => {
      if (e.x < -10) {
        this.player.shield = Math.max(0, this.player.shield - 5);
        this.playSFX('hit');
        if (this.player.shield <= 0) {
          this.triggerGameOver();
        }
      }
    });
    this.enemies = this.enemies.filter(e => e.x >= -10);

    // 8. Move and Shoot Boss
    if (this.bossActive && this.boss) {
      // Entrance glide
      if (this.boss.x > 125) {
        this.boss.x -= 0.8;
      } else {
        // Vertical hover
        this.boss.y += this.boss.vy;
        if (this.boss.y <= 14 || this.boss.y >= 96 - 22) {
          this.boss.vy = -this.boss.vy;
        }

        // Periodic heavy lasers shoot
        if (Math.random() < 0.03) {
          this.enemyBullets.push({
            x: this.boss.x,
            y: this.boss.y + 8,
            w: 4,
            h: 2,
            isBossLaser: true
          });
          this.playSFX('boss_laser');
        }
      }
    }

    // 9. Spawning Enemies / Boss Trigger
    if (!this.bossActive && this.enemiesDestroyed < 15) {
      // Periodic spawn regular
      const maxEnemies = 4;
      if (this.enemies.length < maxEnemies && Math.random() < 0.025 + (this.speedLevel * 0.005)) {
        // Pick enemy type
        let type = 1;
        let health = 1;
        let w = 8, h = 6;
        
        const rand = Math.random();
        if (this.level === 1) {
          if (rand > 0.75) {
            type = 2; w = 8; h = 8;
          }
        } else {
          if (rand > 0.75) {
            type = 3; health = 3; w = 10; h = 10;
          } else if (rand > 0.4) {
            type = 2; w = 8; h = 8;
          }
        }

        this.enemies.push({
          x: 168,
          y: Math.random() * (96 - 26) + 16,
          type: type,
          health: health,
          w: w,
          h: h
        });
      }
    } else if (!this.bossActive && this.enemiesDestroyed >= 15) {
      // Clear active enemies, trigger boss once none remain
      if (this.enemies.length === 0 && !this.bossSpawned) {
        this.bossActive = true;
        this.bossSpawned = true;
        this.boss = {
          x: 168,
          y: 36,
          health: 40 + this.level * 15,
          maxHealth: 40 + this.level * 15,
          vy: 0.6,
          w: 24,
          h: 17
        };
      }
    }

    // 10. Regular enemies fire back
    this.enemies.forEach(e => {
      const shootChance = e.type === 3 ? 0.012 : 0.005;
      if (Math.random() < shootChance) {
        this.enemyBullets.push({
          x: e.x,
          y: e.y + Math.floor(e.h / 2),
          w: 2,
          h: 2,
          isBossLaser: false
        });
      }
    });

    // 11. Run Collisions detection
    this.checkCollisions();
  }

  checkCollisions() {
    // AABB intersection utility
    const overlap = (r1, r2) => {
      return r1.x < r2.x + r2.w &&
             r1.x + r1.w > r2.x &&
             r1.y < r2.y + r2.h &&
             r1.y + r1.h > r2.y;
    };

    const pRect = { x: this.player.x, y: this.player.y, w: this.player.width, h: this.player.height };

    // A. Bullet to Enemy
    this.bullets.forEach((b, bIdx) => {
      const bRect = { x: b.x, y: b.y, w: b.w, h: b.h };
      
      this.enemies.forEach((e, eIdx) => {
        const eRect = { x: e.x, y: e.y, w: e.w, h: e.h };
        if (overlap(bRect, eRect)) {
          this.bullets[bIdx].x = 999; // mark bullet for disposal
          e.health--;
          this.playSFX('hit');
          
          if (e.health <= 0) {
            this.createExplosion(e.x + e.w/2, e.y + e.h/2, 6);
            this.enemiesDestroyed++;
            this.score += 50 * this.speedLevel;
            
            // Spawn powerup chance (15%)
            if (Math.random() < 0.15) {
              this.powerups.push({
                x: e.x,
                y: e.y,
                type: Math.random() > 0.5 ? 'shield' : 'double',
                w: 7,
                h: 7
              });
            }
          }
        }
      });

      // Bullet to Boss
      if (this.bossActive && this.boss) {
        const bossRect = { x: this.boss.x, y: this.boss.y, w: this.boss.w, h: this.boss.h };
        if (overlap(bRect, bossRect)) {
          this.bullets[bIdx].x = 999;
          this.boss.health--;
          this.playSFX('hit');
          
          if (this.boss.health <= 0) {
            this.createExplosion(this.boss.x + 12, this.boss.y + 8, 16);
            this.score += 1000 * this.level;
            this.playSFX('boss_explosion');
            this.playSFX('victory');
            this.victoryTimer = 180; // 3 seconds at 60fps
          }
        }
      }
    });
    // Filter out spent bullets
    this.bullets = this.bullets.filter(b => b.x < 900);
    this.enemies = this.enemies.filter(e => e.health > 0);

    // B. Enemy / Boss to Player Ship
    this.enemies.forEach((e, idx) => {
      const eRect = { x: e.x, y: e.y, w: e.w, h: e.h };
      if (overlap(pRect, eRect)) {
        this.enemies[idx].health = 0; // destroy enemy
        this.createExplosion(e.x + e.w/2, e.y + e.h/2, 6);
        this.player.shield = Math.max(0, this.player.shield - 20);
        this.playSFX('explosion');
        
        if (this.player.shield <= 0) {
          this.triggerGameOver();
        }
      }
    });
    this.enemies = this.enemies.filter(e => e.health > 0);

    if (this.bossActive && this.boss) {
      const bossRect = { x: this.boss.x, y: this.boss.y, w: this.boss.w, h: this.boss.h };
      if (overlap(pRect, bossRect)) {
        this.player.shield = Math.max(0, this.player.shield - 25);
        this.boss.health = Math.max(0, this.boss.health - 2);
        this.player.x = Math.max(2, this.player.x - 12); // knockback player
        this.createExplosion(this.player.x + 4, this.player.y + 4, 8);
        this.playSFX('explosion');

        if (this.boss.health <= 0) {
          this.createExplosion(this.boss.x + 12, this.boss.y + 8, 16);
          this.score += 1000 * this.level;
          this.playSFX('boss_explosion');
          this.playSFX('victory');
          this.victoryTimer = 180;
        }
        if (this.player.shield <= 0) {
          this.triggerGameOver();
        }
      }
    }

    // C. Enemy Bullets to Player Ship
    this.enemyBullets.forEach((eb, idx) => {
      const ebRect = { x: eb.x, y: eb.y, w: eb.w, h: eb.h };
      if (overlap(pRect, ebRect)) {
        this.enemyBullets[idx].x = -99; // destroy bullet
        const damage = eb.isBossLaser ? 15 : 10;
        this.player.shield = Math.max(0, this.player.shield - damage);
        this.playSFX('hit');

        this.createExplosion(eb.x, eb.y, 3);
        if (this.player.shield <= 0) {
          this.triggerGameOver();
        }
      }
    });
    this.enemyBullets = this.enemyBullets.filter(eb => eb.x >= 0);

    // D. Powerup to Player Ship
    this.powerups.forEach((pw, idx) => {
      const pwRect = { x: pw.x, y: pw.y, w: pw.w, h: pw.h };
      if (overlap(pRect, pwRect)) {
        this.powerups[idx].x = -99;
        this.playSFX('powerup');
        
        if (pw.type === 'shield') {
          this.player.shield = Math.min(100, this.player.shield + 30);
        } else if (pw.type === 'double') {
          this.doubleShotTimer = 450; // ~7.5 seconds
        }
      }
    });
    this.powerups = this.powerups.filter(pw => pw.x >= 0);
  }

  createExplosion(x, y, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 1.5 + 0.6;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: Math.floor(Math.random() * 8) + 8
      });
    }
  }

  triggerGameOver() {
    this.gameOver = true;
    this.playSFX('gameover');
  }

  draw(ctx) {
    const c = ctx || this.ctx;
    if (!c) return;

    // Fetch dynamic screen color if screen exists, fallback to classic greenish
    let lcdBg = '#c8d4b4';
    let lcdPixel = '#1e2814';
    const lcdEl = document.getElementById('lcdScreen');
    if (lcdEl) {
      const computed = getComputedStyle(lcdEl);
      lcdBg = computed.getPropertyValue('--lcd-bg').trim() || lcdBg;
      lcdPixel = computed.getPropertyValue('--lcd-pixel').trim() || lcdPixel;
    }

    // 1. Reset/Clear LCD background
    c.fillStyle = lcdBg;
    c.fillRect(0, 0, 168, 96);

    // 2. Draw starfield
    c.fillStyle = lcdPixel;
    this.stars.forEach(star => {
      c.fillRect(Math.floor(star.x), Math.floor(star.y), 1, 1);
    });

    // 3. Draw particles
    this.particles.forEach(p => {
      c.fillRect(Math.floor(p.x), Math.floor(p.y), 1, 1);
    });

    // 4. Draw powerups
    this.powerups.forEach(pw => {
      const sprite = pw.type === 'shield' ? this.sprites.powerupShield : this.sprites.powerupDouble;
      this.drawSprite(c, sprite, pw.x, pw.y, lcdPixel);
    });

    // 5. Draw bullets
    this.bullets.forEach(b => {
      c.fillRect(Math.floor(b.x), Math.floor(b.y), b.w, b.h);
    });
    this.enemyBullets.forEach(eb => {
      c.fillRect(Math.floor(eb.x), Math.floor(eb.y), eb.w, eb.h);
    });

    // 6. Draw enemy ships
    this.enemies.forEach(e => {
      let sprite = this.sprites.enemy1;
      if (e.type === 2) sprite = this.sprites.enemy2;
      if (e.type === 3) sprite = this.sprites.enemy3;
      this.drawSprite(c, sprite, e.x, e.y, lcdPixel);
    });

    // 7. Draw Boss
    if (this.bossActive && this.boss) {
      this.drawSprite(c, this.sprites.boss, this.boss.x, this.boss.y, lcdPixel);
    }

    // 8. Draw Player Double-winged fighter
    this.drawSprite(c, this.sprites.player, this.player.x, this.player.y, lcdPixel);

    // 9. Draw separation line under HUD
    c.strokeStyle = lcdPixel;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, 12);
    c.lineTo(168, 12);
    c.stroke();

    // 10. Draw HUD texts
    c.fillStyle = lcdPixel;
    c.font = "bold 9px 'VT323', monospace";
    c.textAlign = "left";
    
    // Shield Label and gauge
    c.fillText("SHIELD:", 4, 9);
    c.strokeRect(38, 3, 24, 6);
    const shieldFill = Math.max(0, Math.min(22, (this.player.shield / 100) * 22));
    c.fillRect(39, 4, shieldFill, 4);

    // Boss health gauge if active
    if (this.bossActive && this.boss) {
      c.fillText("BOSS:", 68, 9);
      c.strokeRect(92, 3, 24, 6);
      const bossFill = Math.max(0, Math.min(22, (this.boss.health / this.boss.maxHealth) * 22));
      c.fillRect(93, 4, bossFill, 4);
    }

    // Score Label
    c.textAlign = "right";
    c.fillText("SCORE:" + String(this.score).padStart(5, '0'), 164, 9);

    // 11. Overlays: Victory / Game Over
    if (this.victoryTimer > 0) {
      c.fillStyle = lcdPixel;
      c.fillRect(20, 24, 128, 48);
      
      c.fillStyle = lcdBg;
      c.font = "bold 13px 'VT323', monospace";
      c.textAlign = "center";
      c.fillText("VICTORY!", 84, 40);
      c.font = "bold 9px 'VT323', monospace";
      c.fillText("LEVEL " + this.level + " COMPLETE!", 84, 52);
      c.fillText("SHIELD BONUS +30", 84, 63);
    }

    if (this.gameOver) {
      c.fillStyle = lcdPixel;
      c.fillRect(16, 22, 136, 52);
      
      c.fillStyle = lcdBg;
      c.font = "bold 15px 'VT323', monospace";
      c.textAlign = "center";
      c.fillText("GAME OVER", 84, 38);
      
      c.font = "9px 'VT323', monospace";
      c.fillText("SCORE: " + this.score, 84, 50);
      c.fillText("PRESS SELECT / 5 TO RESTART", 84, 63);
    }
  }

  // Pixel art sprite renderer
  drawSprite(ctx, sprite, x, y, color) {
    ctx.fillStyle = color;
    for (let r = 0; r < sprite.length; r++) {
      for (let c = 0; c < sprite[r].length; c++) {
        if (sprite[r][c] === '#') {
          ctx.fillRect(Math.floor(x) + c, Math.floor(y) + r, 1, 1);
        }
      }
    }
  }

  handleInput(action) {
    if (this.gameOver) {
      if (action === 'SELECT' || action === '5') {
        this.start(this.speedLevel);
        this.playSFX('powerup');
      }
      return;
    }

    if (this.victoryTimer > 0) return; // ignore control inputs on victory transition

    const moveStep = 5;

    switch (action) {
      case 'UP':
      case '2':
        this.player.y = Math.max(14, this.player.y - moveStep);
        break;
      case 'DOWN':
      case '8':
        this.player.y = Math.min(96 - this.player.height, this.player.y + moveStep);
        break;
      case 'LEFT':
      case '4':
        this.player.x = Math.max(2, this.player.x - moveStep);
        break;
      case 'RIGHT':
      case '6':
        this.player.x = Math.min(80, this.player.x + moveStep); // Limit past half screen
        break;
      case 'SELECT':
      case '5':
        // Rate-limited laser shot (120ms)
        const now = Date.now();
        if (now - this.lastShotTime >= 120) {
          this.lastShotTime = now;
          if (this.doubleShotTimer > 0) {
            // Twin wing lasers
            this.bullets.push({ x: this.player.x + 8, y: this.player.y + 1, w: 2, h: 1 });
            this.bullets.push({ x: this.player.x + 8, y: this.player.y + 6, w: 2, h: 1 });
          } else {
            // Standard single central laser
            this.bullets.push({ x: this.player.x + 8, y: this.player.y + 3, w: 2, h: 1 });
          }
          this.playSFX('laser');
        }
        break;
      default:
        break;
    }
  }

  getScore() {
    return this.score;
  }

  isGameOver() {
    return this.gameOver;
  }
}

// Bind class globally
globalThis.SpaceImpactGame = SpaceImpactGame;
