/**
 * KANA RUSH - Game Engine (Integrado)
 * Usa IDs únicos (arcade-*) para convivir con el modo práctica
 */

// --- CANVAS MANAGER (Arcade Version) ---
const ArcadeCanvas = {
    el: null, // Se asigna en init
    ctx: null,
    isDrawing: false, isActive: true,
    
    init() {
        this.el = document.getElementById('arcadeCanvas');
        if(!this.el) return;
        this.ctx = this.el.getContext('2d');
        this.resize();
        
        ['mousedown','touchstart'].forEach(e=>this.el.addEventListener(e, ev=>this.start(ev)));
        ['mouseup','touchend'].forEach(e=>this.el.addEventListener(e, ()=>this.stop()));
        ['mousemove','touchmove'].forEach(e=>this.el.addEventListener(e, ev=>this.draw(ev)));
        
        this.ctx.lineWidth = 6; this.ctx.lineCap = 'round'; this.ctx.strokeStyle = '#333';
    },
    resize() {
        if(!this.el) return;
        const r = this.el.parentElement.getBoundingClientRect();
        this.el.width = r.width; this.el.height = r.height;
        this.ctx.lineWidth = 6; this.ctx.lineCap = 'round'; this.ctx.strokeStyle = '#333';
    },
    pos(ev) {
        const r = this.el.getBoundingClientRect();
        const t = ev.touches ? ev.touches[0] : ev;
        return { x: t.clientX - r.left, y: t.clientY - r.top };
    },
    start(ev) { if(!this.isActive)return; ev.preventDefault(); this.isDrawing=true; this.ctx.beginPath(); const p=this.pos(ev); this.ctx.moveTo(p.x, p.y); },
    draw(ev) { if(!this.isDrawing)return; ev.preventDefault(); const p=this.pos(ev); this.ctx.lineTo(p.x, p.y); this.ctx.stroke(); },
    stop() { this.isDrawing=false; },
    clear() { if(this.ctx) this.ctx.clearRect(0,0,this.el.width,this.el.height); },
    toggle(on) { this.isActive = on; }
};

// --- GAME LOGIC ---
const KanaRush = {
    db: typeof kanaDB !== 'undefined' ? kanaDB : [],
    mode: 'hiragana',
    
    score: 0, lives: 3, combo: 1.0, maxCombo: 1.0, level: 1, correctCount: 0,
    timer: null, timeLimit: 10, timeLeft: 10, currentKana: null, isPlaying: false,

    init() {
        ArcadeCanvas.init();
        window.addEventListener('resize', () => ArcadeCanvas.resize());
    },

    setMode(m) {
        this.mode = m;
        // Los botones visuales se gestionan en index.html, aquí solo guardamos el estado
    },

    getLevelParams() {
        // Nivel 1: Vocales (10s)
        if (this.level === 1) return { t: 10, f: k => k.g === 'row-a' };
        // Nivel 2: + K, S, T (8s)
        if (this.level === 2) return { t: 8, f: k => ['row-a','row-k','row-s','row-t'].includes(k.g) };
        // Nivel 3: + N, H, M, Y (7s)
        if (this.level === 3) return { t: 7, f: k => !['row-r','row-w','dakuten'].includes(k.g) };
        // Nivel 4: Todo Seion (6s)
        if (this.level === 4) return { t: 6, f: k => k.g !== 'dakuten' };
        // Nivel 5+: Todo (5s...)
        let t = Math.max(3, 5 - (this.level - 5)*0.2);
        return { t: t, f: k => true };
    },

    start() {
        this.score = 0; this.lives = 3; this.combo = 1.0; this.level = 1; this.correctCount = 0; this.isPlaying = true;

        document.getElementById('setup-screen').style.display = 'none';
        document.getElementById('arcade-screen').style.display = 'block';
        
        // Resize canvas after showing (important!)
        ArcadeCanvas.resize();
        
        this.updateHUD();
        this.nextRound();
    },

    nextRound() {
        if (!this.isPlaying) return;

        const params = this.getLevelParams();
        this.timeLimit = params.t;
        const pool = this.db.filter(params.f);
        this.currentKana = pool[Math.floor(Math.random() * pool.length)];
        
        // UI Setup
        document.getElementById('arcade-enemy').innerText = this.currentKana.r.toUpperCase();
        document.getElementById('arcade-action-area').style.display = 'flex';
        document.getElementById('arcade-eval-area').style.display = 'none';
        
        const svgCont = document.getElementById('arcade-svg-container');
        svgCont.innerHTML = '';
        svgCont.classList.remove('visible'); // Custom style needed?
        svgCont.style.opacity = '0';
        
        ArcadeCanvas.clear();
        ArcadeCanvas.toggle(true);

        this.startTimer();
    },

    startTimer() {
        if(this.timer) clearInterval(this.timer);
        this.timeLeft = this.timeLimit;
        const bar = document.getElementById('arcade-timer');
        bar.className = 'rush-fill'; 
        
        this.timer = setInterval(() => {
            this.timeLeft -= 0.1;
            const pct = (this.timeLeft / this.timeLimit) * 100;
            bar.style.width = `${pct}%`;
            if (pct < 30) bar.classList.add('danger');
            if (this.timeLeft <= 0) this.timeUp();
        }, 100);
    },

    checkAnswer() {
        clearInterval(this.timer);
        ArcadeCanvas.toggle(false);
        this.showSolution();
        document.getElementById('arcade-action-area').style.display = 'none';
        document.getElementById('arcade-eval-area').style.display = 'flex';
    },

    async showSolution() {
        const char = this.mode === 'hiragana' ? this.currentKana.h : this.currentKana.k;
        const hex = char.codePointAt(0).toString(16).padStart(5, '0');
        const url = `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg/kanji/${hex}.svg`;
        const container = document.getElementById('arcade-svg-container');
        
        // Audio (opcional, reutilizando el manager de app.js si está cargado)
        if(typeof AudioManager !== 'undefined') AudioManager.speak(char);

        try {
            const res = await fetch(url);
            if(res.ok) {
                container.innerHTML = await res.text();
                const svg = container.querySelector('svg');
                svg.removeAttribute('width'); svg.removeAttribute('height');
                svg.style.width = '80%'; svg.style.height = '80%'; // Adjust size
                
                // SVG Styles for Arcade
                const paths = svg.querySelectorAll('path');
                paths.forEach(p => { 
                    p.style.fill = 'none'; 
                    p.style.stroke = '#E6007E'; 
                    p.style.strokeWidth = '5'; 
                    p.style.strokeLinecap = 'round';
                    p.style.strokeLinejoin = 'round';
                });
                
                container.style.opacity = '1';
            } else {
                container.innerHTML = `<div style="font-size:5rem; color:#ccc;">${char}</div>`;
                container.style.opacity = '1';
            }
        } catch(e) {
            container.innerHTML = `<div style="font-size:5rem; color:#ccc;">${char}</div>`;
            container.style.opacity = '1';
        }
    },

    resolveRound(isCorrect) {
        if (isCorrect) {
            const timeBonus = Math.ceil(this.timeLeft * 10);
            const points = Math.ceil((100 + timeBonus) * this.combo);
            this.score += points;
            this.correctCount++;
            
            if (this.correctCount % 3 === 0) {
                this.combo = parseFloat((this.combo + 0.1).toFixed(1));
                if(this.combo > 3.0) this.combo = 3.0;
            }
            if(this.combo > this.maxCombo) this.maxCombo = this.combo;
            if (this.correctCount % 5 === 0) this.level++;
        } else {
            this.lives--;
            this.combo = 1.0;
            document.querySelector('.game-hud').classList.add('shake');
            setTimeout(()=>document.querySelector('.game-hud').classList.remove('shake'), 500);
        }

        this.updateHUD();

        if (this.lives <= 0) {
            this.gameOver();
        } else {
            setTimeout(() => this.nextRound(), 500);
        }
    },

    timeUp() {
        clearInterval(this.timer);
        this.resolveRound(false);
    },

    updateHUD() {
        document.getElementById('arcade-score').innerText = this.score;
        document.getElementById('arcade-combo').innerText = `x${this.combo.toFixed(1)}`;
        let hearts = "";
        for(let i=0; i<this.lives; i++) hearts += "❤️";
        for(let i=this.lives; i<3; i++) hearts += "🖤";
        document.getElementById('arcade-lives').innerHTML = hearts;
    },

    gameOver() {
        this.isPlaying = false;
        document.getElementById('final-score').innerText = this.score;
        document.getElementById('final-combo').innerText = `x${this.maxCombo.toFixed(1)}`;
        document.getElementById('game-over-modal').style.display = 'flex';
    }
};

window.addEventListener('load', () => KanaRush.init());
