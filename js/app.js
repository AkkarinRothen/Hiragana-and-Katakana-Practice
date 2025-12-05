/**
 * DOJO DE KANA - Lógica Principal v3
 * Incluye Modo Trazado (Aprendizaje)
 */

// --- 0. GESTOR DE AUDIO ---
const AudioManager = {
    synth: window.speechSynthesis,
    voice: null,
    enabled: true,
    init() { if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = () => this.loadVoice(); this.loadVoice(); },
    loadVoice() { const voices = this.synth.getVoices(); this.voice = voices.find(v => v.lang === 'ja-JP') || voices.find(v => v.lang.includes('ja')); },
    speak(text) {
        if (!this.enabled || !this.voice) return;
        this.synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.voice = this.voice; u.rate = 0.9; u.pitch = 1;
        this.synth.speak(u);
    }
};

// --- 1. GESTOR DE ALMACENAMIENTO ---
const Storage = {
    KEY_SETTINGS: 'kana_dojo_settings_v3',
    KEY_HIGHSCORE: 'kana_dojo_highscore',
    saveSettings(settings) { localStorage.setItem(this.KEY_SETTINGS, JSON.stringify(settings)); },
    loadSettings() { const data = localStorage.getItem(this.KEY_SETTINGS); return data ? JSON.parse(data) : null; },
    getHighScore() { return parseInt(localStorage.getItem(this.KEY_HIGHSCORE) || '0'); },
    setHighScore(score) {
        if (score > this.getHighScore()) { localStorage.setItem(this.KEY_HIGHSCORE, score); return true; }
        return false;
    }
};

// --- 2. GESTOR DE CANVAS ---
const CanvasManager = {
    canvas: document.getElementById('writeCanvas'),
    ctx: document.getElementById('writeCanvas').getContext('2d'),
    isDrawing: false, isActive: true,
    init() {
        this.resize(); window.addEventListener('resize', () => this.resize());
        ['mousedown','touchstart'].forEach(evt => this.canvas.addEventListener(evt, (e) => { e.preventDefault(); this.startDraw(e.touches?e.touches[0]:e); }));
        ['mouseup','touchend'].forEach(evt => this.canvas.addEventListener(evt, () => this.endDraw()));
        ['mousemove','touchmove'].forEach(evt => this.canvas.addEventListener(evt, (e) => { e.preventDefault(); this.draw(e.touches?e.touches[0]:e); }));
        this.ctx.lineWidth = 6; this.ctx.lineCap = 'round'; this.ctx.strokeStyle = '#333';
    },
    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width; this.canvas.height = rect.height;
        this.ctx.lineWidth = 6; this.ctx.lineCap = 'round'; this.ctx.strokeStyle = '#333';
    },
    getPos(e) { const r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; },
    startDraw(e) { if (!this.isActive) return; this.isDrawing = true; this.ctx.beginPath(); const p = this.getPos(e); this.ctx.moveTo(p.x, p.y); },
    draw(e) { if (!this.isDrawing || !this.isActive) return; const p = this.getPos(e); this.ctx.lineTo(p.x, p.y); this.ctx.stroke(); },
    endDraw() { this.isDrawing = false; },
    clear() { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); },
    drawGuides(count) {
        if (!this.isActive || count <= 1) return;
        this.ctx.save(); this.ctx.strokeStyle = '#e0e0e0'; this.ctx.lineWidth = 2; this.ctx.setLineDash([5, 5]);
        const w = this.canvas.width / count;
        this.ctx.beginPath();
        for (let i = 1; i < count; i++) { this.ctx.moveTo(w*i, 0); this.ctx.lineTo(w*i, this.canvas.height); }
        this.ctx.stroke(); this.ctx.restore();
    },
    toggle(active) { this.isActive = active; this.canvas.style.display = active ? 'block' : 'none'; }
};

// --- 3. LÓGICA DEL JUEGO ---
const Game = {
    state: { mode: 'hiragana', score: 0, highScore: 0, phase: 1, pool: [], currentChallenge: [], isRevealed: false },
    settings: { timeMode: false, canvasMode: true, audioMode: true, traceMode: false, selectedRows: [] },
    timer: { interval: null, max: 15, current: 15 },

    init() {
        AudioManager.init();
        this.loadUserPreferences();
        this.bindEvents();
        CanvasManager.init();
        this.updateHighScoreUI();
    },

    loadUserPreferences() {
        const saved = Storage.loadSettings();
        if (saved) {
            this.setMode(saved.mode);
            document.getElementById('time-mode-toggle').checked = saved.timeMode;
            document.getElementById('canvas-mode-toggle').checked = saved.canvasMode;
            document.getElementById('audio-mode-toggle').checked = saved.audioMode ?? true;
            document.getElementById('trace-mode-toggle').checked = saved.traceMode ?? false; // Nuevo
            if (saved.selectedRows?.length > 0) {
                document.querySelectorAll('.checkbox-grid input').forEach(cb => cb.checked = false);
                saved.selectedRows.forEach(val => { const el = document.querySelector(`input[value="${val}"]`); if(el) el.checked=true; });
            }
        } else this.setMode('hiragana');
        this.state.highScore = Storage.getHighScore();
    },

    saveUserPreferences() {
        const selectedRows = Array.from(document.querySelectorAll('.checkbox-grid input:checked')).map(cb => cb.value);
        Storage.saveSettings({
            mode: this.state.mode,
            timeMode: document.getElementById('time-mode-toggle').checked,
            canvasMode: document.getElementById('canvas-mode-toggle').checked,
            audioMode: document.getElementById('audio-mode-toggle').checked,
            traceMode: document.getElementById('trace-mode-toggle').checked,
            selectedRows: selectedRows
        });
    },

    bindEvents() {
        document.getElementById('btn-start').onclick = () => this.start();
        document.getElementById('setup-screen').addEventListener('change', () => this.saveUserPreferences());
    },

    setMode(mode) {
        this.state.mode = mode;
        document.getElementById('btn-hira').classList.toggle('active', mode === 'hiragana');
        document.getElementById('btn-kata').classList.toggle('active', mode === 'katakana');
        this.saveUserPreferences();
    },

    start() {
        const checkboxes = document.querySelectorAll('.checkbox-grid input:checked');
        const selectedGroups = Array.from(checkboxes).map(cb => cb.value);
        this.state.pool = kanaDB.filter(item => selectedGroups.includes(item.g));
        if (this.state.pool.length === 0) return alert("Selecciona al menos una fila");

        // Leer settings
        this.settings.timeMode = document.getElementById('time-mode-toggle').checked;
        this.settings.canvasMode = document.getElementById('canvas-mode-toggle').checked;
        this.settings.audioMode = document.getElementById('audio-mode-toggle').checked;
        this.settings.traceMode = document.getElementById('trace-mode-toggle').checked;
        
        // En modo trazado, desactivamos tiempo
        if (this.settings.traceMode) this.settings.timeMode = false;

        AudioManager.enabled = this.settings.audioMode;
        this.state.score = 0;
        this.state.phase = 1;
        
        document.getElementById('setup-screen').style.display = 'none';
        document.getElementById('practice-screen').style.display = 'flex';
        
        this.setupWorkspace();
        this.nextTurn();
    },

    setupWorkspace() {
        CanvasManager.toggle(this.settings.canvasMode);
        document.getElementById('canvas-toolbar').style.display = this.settings.canvasMode ? 'flex' : 'none';
        document.getElementById('score-only').style.display = this.settings.canvasMode ? 'none' : 'flex';
        document.getElementById('instruction-text').innerText = this.settings.traceMode ? "Repasa sobre la guía" : "Escribe de memoria";
    },

    updateUI() {
        this.state.phase = Math.min(5, Math.floor(this.state.score / 5) + 1);
        let t = `Nivel ${this.state.phase}`;
        if(this.state.phase>=3) t+=" (Combos)";
        document.getElementById('phase-badge').innerText = t;
        const s = `Score: ${this.state.score}`;
        document.getElementById('counter').innerText = s;
        document.getElementById('counter-alt').innerText = s;
    },

    generateChallenge() {
        this.updateUI();
        let qty = 1;
        if (this.settings.timeMode) {
            if(this.state.phase>=3) qty=2; if(this.state.phase>=5) qty=3;
        } else if (this.settings.traceMode) {
             // En modo trazado, también permitimos combos simples progresivos
            if(this.state.phase>=3) qty=2;
        }

        let timePerKana = 15 - (this.state.phase*1.5);
        if(timePerKana<4) timePerKana=4;
        this.timer.max = Math.ceil(timePerKana * qty);

        const seq = [];
        for(let i=0; i<qty; i++) {
            let c, safe=0;
            do { c = this.state.pool[Math.floor(Math.random()*this.state.pool.length)]; safe++; 
                 if(i>0 && c===seq[i-1] && this.state.pool.length>5) c=null; 
            } while(!c && safe<10);
            if(c) seq.push(c);
        }
        return seq;
    },

    nextTurn() {
        this.state.currentChallenge = this.generateChallenge();
        this.state.isRevealed = false;

        // UI Reset
        document.getElementById('romaji-display').innerText = this.state.currentChallenge.map(c=>c.r.toUpperCase()).join(' • ');
        document.getElementById('manual-audio-btn').style.display = 'none';
        
        const svgCont = document.getElementById('svg-container');
        svgCont.innerHTML = '';
        svgCont.classList.remove('visible');
        document.getElementById('workspace').classList.remove('failed', 'shake', 'success-pulse');
        document.getElementById('default-actions').style.display = 'flex';
        document.getElementById('evaluation-actions').style.display = 'none';
        document.getElementById('replay-btn').style.display = 'none';

        // Botón
        const btn = document.getElementById('action-btn');
        btn.innerText = "Ver Respuesta";
        btn.classList.remove('btn-main', 'btn-outline');
        btn.classList.add('btn-main');

        // Canvas Clear
        if (this.settings.canvasMode) {
            CanvasManager.clear();
            CanvasManager.drawGuides(this.state.currentChallenge.length);
        }

        // --- LÓGICA MODO TRAZADO ---
        if (this.settings.traceMode) {
            // Cargar SVGs inmediatamente como "Ghost"
            this.loadSVGs(true); 
            this.playCurrentAudio();
            document.getElementById('manual-audio-btn').style.display = 'block';
            btn.innerText = "Siguiente >";
            this.state.isRevealed = true; // Ya está revelado técnicamente
        } else {
            this.startTimer();
        }
    },

    // Nueva función helper para cargar SVGs
    async loadSVGs(isGhost = false) {
        const container = document.getElementById('svg-container');
        container.classList.add('visible');
        
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
            if (isGhost) wrapper.classList.add('ghost'); // Añadir clase ghost
            
            if (svg) {
                wrapper.innerHTML = svg;
                const el = wrapper.querySelector('svg');
                el.removeAttribute('width'); el.removeAttribute('height');
            } else {
                const item = this.state.currentChallenge[idx];
                const char = this.state.mode === 'hiragana' ? item.h : item.k;
                wrapper.innerHTML = `<div style="font-size:3rem;font-family:'Klee One'">${char}</div>`;
            }
            container.appendChild(wrapper);
        });
    },

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
        uiBar.style.width = '100%'; uiBar.style.background = 'var(--secondary)';
        uiBadge.innerText = Math.ceil(this.timer.current) + 's';

        this.timer.interval = setInterval(() => {
            this.timer.current -= 0.1;
            const pct = (this.timer.current / this.timer.max) * 100;
            uiBar.style.width = `${pct}%`;
            if (pct < 30) uiBar.style.background = 'var(--danger)';
            if (Math.abs(Math.round(this.timer.current) - this.timer.current) < 0.15) uiBadge.innerText = Math.ceil(this.timer.current) + 's';
            if (this.timer.current <= 0) this.timeUp();
        }, 100);
    },

    stopTimer() { if (this.timer.interval) clearInterval(this.timer.interval); },

    timeUp() {
        this.stopTimer();
        document.getElementById('timer-bar').style.width = '0%';
        this.revealAnswer(true);
    },

    handleAction() {
        if (this.settings.traceMode) {
            // En modo trazado, el botón es "Siguiente", así que simplemente pasamos
            this.markResult(true); // Asumimos correcto porque es práctica
        } else {
            if (!this.state.isRevealed) this.revealAnswer(false);
            else this.nextTurn();
        }
    },

    markResult(correct) {
        const workspace = document.getElementById('workspace');
        if (correct) {
            this.state.score++;
            workspace.classList.add('success-pulse');
            if (Storage.setHighScore(this.state.score)) {
                this.state.highScore = this.state.score;
                this.updateHighScoreUI();
            }
        } else {
            this.state.score = Math.max(0, this.state.score - 1);
            workspace.classList.add('failed', 'shake');
        }
        this.updateUI();
        setTimeout(() => this.nextTurn(), 600);
    },

    async revealAnswer(failed = false) {
        this.stopTimer();
        this.state.isRevealed = true;
        
        if (failed) {
            this.state.score = Math.max(0, this.state.score - 1);
            document.getElementById('workspace').classList.add('failed', 'shake');
            this.updateUI();
            document.getElementById('action-btn').innerText = "Tiempo Agotado (Continuar)";
        } else {
            document.getElementById('default-actions').style.display = 'none';
            document.getElementById('evaluation-actions').style.display = 'flex';
        }

        this.playCurrentAudio();
        document.getElementById('manual-audio-btn').style.display = 'block';
        document.getElementById('replay-btn').style.display = 'block';

        // Cargar SVGs normales
        await this.loadSVGs(false);
        this.animateStrokeOrder();
    },

    playCurrentAudio() {
        const t = this.state.currentChallenge.map(i=>this.state.mode==='hiragana'?i.h:i.k).join('。');
        AudioManager.speak(t);
    },

    animateStrokeOrder() {
        const paths = document.querySelectorAll('#svg-container path');
        paths.forEach(p => { p.style.transition = 'none'; p.style.strokeDasharray = '1000'; p.style.strokeDashoffset = '1000'; });
        void document.getElementById('svg-container').offsetWidth;
        let delay = 0;
        paths.forEach(p => { setTimeout(() => { p.style.transition = 'stroke-dashoffset 600ms ease-out'; p.style.strokeDashoffset = '0'; }, delay); delay += 150; });
    },

    replayAnimation() { this.animateStrokeOrder(); },
    updateHighScoreUI() { const t = `🏆 Best: ${this.state.highScore}`; document.getElementById('high-score-display').innerText = t; document.getElementById('high-score-display-alt').innerText = t; },
    exit() { this.stopTimer(); document.getElementById('practice-screen').style.display = 'none'; document.getElementById('setup-screen').style.display = 'block'; }
};

window.onload = () => Game.init();
