/**
 * DOJO DE KANA - Lógica Principal
 * Estructura modular para mejor mantenimiento y persistencia
 */

// --- 1. GESTOR DE ALMACENAMIENTO (Persistence) ---
const Storage = {
    KEY_SETTINGS: 'kana_dojo_settings',
    KEY_HIGHSCORE: 'kana_dojo_highscore',

    // Guardar preferencias del usuario
    saveSettings(settings) {
        localStorage.setItem(this.KEY_SETTINGS, JSON.stringify(settings));
    },

    // Cargar preferencias
    loadSettings() {
        const data = localStorage.getItem(this.KEY_SETTINGS);
        return data ? JSON.parse(data) : null;
    },

    // Gestión de High Score
    getHighScore() {
        return parseInt(localStorage.getItem(this.KEY_HIGHSCORE) || '0');
    },

    setHighScore(score) {
        const current = this.getHighScore();
        if (score > current) {
            localStorage.setItem(this.KEY_HIGHSCORE, score);
            return true; // Nuevo record
        }
        return false;
    }
};

// --- 2. GESTOR DE CANVAS (Pizarra) ---
const CanvasManager = {
    canvas: document.getElementById('writeCanvas'),
    ctx: document.getElementById('writeCanvas').getContext('2d'),
    isDrawing: false,
    isActive: true,

    init() {
        // Ajustar resolución
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Eventos
        this.canvas.addEventListener('mousedown', (e) => this.startDraw(e));
        this.canvas.addEventListener('mouseup', () => this.endDraw());
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this.startDraw(e.touches[0]); });
        this.canvas.addEventListener('touchend', () => this.endDraw());
        this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); this.draw(e.touches[0]); });

        // Configuración de trazo
        this.ctx.lineWidth = 6;
        this.ctx.lineCap = 'round';
        this.ctx.strokeStyle = '#333';
    },

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        // Reiniciar estilos de contexto tras resize
        this.ctx.lineWidth = 6;
        this.ctx.lineCap = 'round';
        this.ctx.strokeStyle = '#333';
    },

    getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return { 
            x: e.clientX - rect.left, 
            y: e.clientY - rect.top 
        };
    },

    startDraw(e) {
        if (!this.isActive) return;
        this.isDrawing = true;
        this.ctx.beginPath();
        const p = this.getPos(e);
        this.ctx.moveTo(p.x, p.y);
    },

    draw(e) {
        if (!this.isDrawing || !this.isActive) return;
        const p = this.getPos(e);
        this.ctx.lineTo(p.x, p.y);
        this.ctx.stroke();
    },

    endDraw() { this.isDrawing = false; },

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    },

    drawGuides(count) {
        if (!this.isActive || count <= 1) return;
        
        this.ctx.save();
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        
        const sectionWidth = this.canvas.width / count;
        
        this.ctx.beginPath();
        for (let i = 1; i < count; i++) {
            const x = sectionWidth * i;
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
        }
        this.ctx.stroke();
        this.ctx.restore();
    },

    toggle(active) {
        this.isActive = active;
        this.canvas.style.display = active ? 'block' : 'none';
    }
};

// --- 3. LÓGICA DEL JUEGO (Game Engine) ---
const Game = {
    state: {
        mode: 'hiragana', // hiragana | katakana
        score: 0,
        highScore: 0,
        phase: 1,
        pool: [],
        currentChallenge: [],
        isRevealed: false
    },
    
    settings: {
        timeMode: false,
        canvasMode: true,
        selectedRows: []
    },

    timer: {
        interval: null,
        max: 15,
        current: 15
    },

    // --- INICIALIZACIÓN ---
    init() {
        this.loadUserPreferences();
        this.bindEvents();
        CanvasManager.init();
        this.updateHighScoreUI();
    },

    loadUserPreferences() {
        const saved = Storage.loadSettings();
        if (saved) {
            // Restaurar Mode
            this.setMode(saved.mode);
            
            // Restaurar Toggles
            document.getElementById('time-mode-toggle').checked = saved.timeMode;
            document.getElementById('canvas-mode-toggle').checked = saved.canvasMode;
            
            // Restaurar Checkboxes
            if (saved.selectedRows && saved.selectedRows.length > 0) {
                // Primero desmarcar todo
                document.querySelectorAll('.checkbox-grid input').forEach(cb => cb.checked = false);
                // Marcar guardados
                saved.selectedRows.forEach(val => {
                    const el = document.querySelector(`input[value="${val}"]`);
                    if (el) el.checked = true;
                });
            }
        } else {
            // Default setup
            this.setMode('hiragana');
        }
        
        this.state.highScore = Storage.getHighScore();
    },

    saveUserPreferences() {
        const checkboxes = document.querySelectorAll('.checkbox-grid input:checked');
        const selectedRows = Array.from(checkboxes).map(cb => cb.value);
        
        const settings = {
            mode: this.state.mode,
            timeMode: document.getElementById('time-mode-toggle').checked,
            canvasMode: document.getElementById('canvas-mode-toggle').checked,
            selectedRows: selectedRows
        };
        
        Storage.saveSettings(settings);
    },

    bindEvents() {
        // Toggle de Modo (Hiragana/Katakana)
        document.getElementById('btn-hira').onclick = () => this.setMode('hiragana');
        document.getElementById('btn-kata').onclick = () => this.setMode('katakana');

        // Botón Start
        document.getElementById('btn-start').onclick = () => this.start();

        // Listeners para auto-guardado en configuración
        document.getElementById('setup-screen').addEventListener('change', () => this.saveUserPreferences());
    },

    setMode(mode) {
        this.state.mode = mode;
        document.getElementById('btn-hira').classList.toggle('active', mode === 'hiragana');
        document.getElementById('btn-kata').classList.toggle('active', mode === 'katakana');
        this.saveUserPreferences();
    },

    // --- CORE GAME LOOP ---
    start() {
        // 1. Validar selección
        const checkboxes = document.querySelectorAll('.checkbox-grid input:checked');
        const selectedGroups = Array.from(checkboxes).map(cb => cb.value);
        this.state.pool = kanaDB.filter(item => selectedGroups.includes(item.g));

        if (this.state.pool.length === 0) return alert("Selecciona al menos una fila");

        // 2. Configurar Entorno
        this.settings.timeMode = document.getElementById('time-mode-toggle').checked;
        this.settings.canvasMode = document.getElementById('canvas-mode-toggle').checked;
        
        // Reset State
        this.state.score = 0;
        this.state.phase = 1;
        
        // Update UI
        document.getElementById('setup-screen').style.display = 'none';
        document.getElementById('practice-screen').style.display = 'flex';
        
        // Configurar Pizarra
        this.setupWorkspace();
        
        this.nextTurn();
    },

    setupWorkspace() {
        CanvasManager.toggle(this.settings.canvasMode);
        
        const canvasToolbar = document.getElementById('canvas-toolbar');
        const scoreOnly = document.getElementById('score-only');
        const instr = document.getElementById('instruction-text');

        if (this.settings.canvasMode) {
            canvasToolbar.style.display = 'flex';
            scoreOnly.style.display = 'none';
            instr.innerText = "Escribe en las zonas asignadas";
        } else {
            canvasToolbar.style.display = 'none';
            scoreOnly.style.display = 'flex';
            instr.innerText = "Escribe en tu papel";
        }
    },

    updateUI() {
        // Calcular fase
        this.state.phase = Math.min(5, Math.floor(this.state.score / 5) + 1);
        
        // Textos
        let phaseText = `Nivel ${this.state.phase}`;
        if(this.state.phase >= 3) phaseText += " (Combos)";
        if(this.state.phase >= 5) phaseText += " (Experto)";
        
        document.getElementById('phase-badge').innerText = phaseText;
        
        const scoreText = `Score: ${this.state.score}`;
        document.getElementById('counter').innerText = scoreText;
        document.getElementById('counter-alt').innerText = scoreText;
    },

    generateChallenge() {
        this.updateUI();

        // Determinar dificultad
        let quantity = 1;
        if (this.settings.timeMode) {
            if (this.state.phase >= 3) quantity = 2;
            if (this.state.phase >= 5) quantity = 3;
        }

        // Timer calculation
        let timePerKana = 15 - (this.state.phase * 1.5);
        if (timePerKana < 4) timePerKana = 4;
        this.timer.max = Math.ceil(timePerKana * quantity);

        // Selección de Kanas (Algoritmo anti-repetición simple)
        const sequence = [];
        for (let i = 0; i < quantity; i++) {
            let candidate;
            let safety = 0;
            do {
                candidate = this.state.pool[Math.floor(Math.random() * this.state.pool.length)];
                safety++;
                // Evitar repetir el inmediatamente anterior
                if (i > 0 && candidate === sequence[i-1] && this.state.pool.length > 5) candidate = null;
            } while (!candidate && safety < 10);
            
            if (candidate) sequence.push(candidate);
        }
        return sequence;
    },

    nextTurn() {
        this.state.currentChallenge = this.generateChallenge();
        this.state.isRevealed = false;

        // UI Reset
        const romajiStr = this.state.currentChallenge.map(c => c.r.toUpperCase()).join(' • ');
        document.getElementById('romaji-display').innerText = romajiStr;

        const svgCont = document.getElementById('svg-container');
        svgCont.innerHTML = '';
        svgCont.classList.remove('visible');
        document.getElementById('workspace').classList.remove('failed');

        // Botones
        const btn = document.getElementById('action-btn');
        btn.innerText = "Ver Respuesta";
        btn.classList.remove('btn-outline');
        btn.classList.add('btn-main');
        document.getElementById('replay-btn').style.display = 'none';

        // Canvas
        if (this.settings.canvasMode) {
            CanvasManager.clear();
            CanvasManager.drawGuides(this.state.currentChallenge.length);
        }

        this.startTimer();
    },

    // --- TIMER SYSTEM ---
    startTimer() {
        if (!this.settings.timeMode) {
            document.getElementById('timer-container').style.display = 'none';
            document.getElementById('timer-badge').style.display = 'none';
            return;
        }

        this.stopTimer();
        this.timer.current = this.timer.max;
        
        const uiBar = document.getElementById('timer-bar');
        const uiBadge = document.getElementById('timer-badge');
        
        document.getElementById('timer-container').style.display = 'block';
        uiBadge.style.display = 'block';
        uiBar.style.width = '100%';
        uiBar.style.background = 'var(--secondary)';
        uiBadge.innerText = Math.ceil(this.timer.current) + 's';

        this.timer.interval = setInterval(() => {
            this.timer.current -= 0.1;
            const pct = (this.timer.current / this.timer.max) * 100;
            
            uiBar.style.width = `${pct}%`;
            if (pct < 30) uiBar.style.background = 'var(--danger)';
            
            // Actualizar texto badge cada segundo (no cada 100ms)
            if (Math.abs(Math.round(this.timer.current) - this.timer.current) < 0.15) {
                uiBadge.innerText = Math.ceil(this.timer.current) + 's';
            }

            if (this.timer.current <= 0) this.timeUp();
        }, 100);
    },

    stopTimer() {
        if (this.timer.interval) clearInterval(this.timer.interval);
    },

    timeUp() {
        this.stopTimer();
        document.getElementById('timer-bar').style.width = '0%';
        this.revealAnswer(true);
    },

    // --- ACTIONS ---
    handleAction() {
        if (!this.state.isRevealed) this.revealAnswer(false);
        else {
            this.state.score++;
            this.updateHighScoreUI();
            this.nextTurn();
        }
    },

    async revealAnswer(failed = false) {
        this.stopTimer();
        this.state.isRevealed = true;

        const btn = document.getElementById('action-btn');
        btn.innerText = failed ? "Tiempo Agotado (Continuar)" : "Correcto (Siguiente)";
        
        if (failed) {
            this.state.score = Math.max(0, this.state.score - 1);
            document.getElementById('workspace').classList.add('failed');
            this.updateUI();
        } else {
             // Check High Score
             if (Storage.setHighScore(this.state.score)) {
                 this.state.highScore = this.state.score;
                 this.updateHighScoreUI();
             }
        }

        document.getElementById('replay-btn').style.display = 'block';
        const container = document.getElementById('svg-container');
        container.classList.add('visible');

        // Carga paralela de SVGs
        const promises = this.state.currentChallenge.map(item => {
            const char = this.state.mode === 'hiragana' ? item.h : item.k;
            const hex = char.codePointAt(0).toString(16).padStart(5, '0');
            const url = `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg/kanji/${hex}.svg`;
            return fetch(url).then(r => r.ok ? r.text() : null).catch(()=>null);
        });

        const results = await Promise.all(promises);
        
        container.innerHTML = '';
        results.forEach((svg, idx) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'svg-char';
            if (svg) {
                wrapper.innerHTML = svg;
                const el = wrapper.querySelector('svg');
                el.removeAttribute('width'); 
                el.removeAttribute('height');
            } else {
                // Fallback texto
                const item = this.state.currentChallenge[idx];
                const char = this.state.mode === 'hiragana' ? item.h : item.k;
                wrapper.innerHTML = `<div style="font-size:3rem;font-family:'Klee One'">${char}</div>`;
            }
            container.appendChild(wrapper);
        });

        this.animateStrokeOrder();
    },

    animateStrokeOrder() {
        const paths = document.querySelectorAll('#svg-container path');
        paths.forEach(p => {
            p.style.transition = 'none';
            p.style.strokeDasharray = '1000';
            p.style.strokeDashoffset = '1000';
        });

        // Force reflow
        void document.getElementById('svg-container').offsetWidth;

        let delay = 0;
        paths.forEach(p => {
            setTimeout(() => {
                p.style.transition = 'stroke-dashoffset 600ms ease-out';
                p.style.strokeDashoffset = '0';
            }, delay);
            delay += 150;
        });
    },

    replayAnimation() {
        this.animateStrokeOrder();
    },

    updateHighScoreUI() {
        const text = `🏆 Best: ${this.state.highScore}`;
        document.getElementById('high-score-display').innerText = text;
        document.getElementById('high-score-display-alt').innerText = text;
    },

    exit() {
        this.stopTimer();
        document.getElementById('practice-screen').style.display = 'none';
        document.getElementById('setup-screen').style.display = 'block';
    }
};

// Iniciar aplicación
window.onload = () => Game.init();
