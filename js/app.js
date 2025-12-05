// --- 0. AUDIO ---
const AudioManager = {
    synth: window.speechSynthesis, voice: null, enabled: true,
    init() { if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = () => this.loadVoice(); this.loadVoice(); },
    loadVoice() { const v = this.synth.getVoices(); this.voice = v.find(x => x.lang === 'ja-JP') || v.find(x => x.lang.includes('ja')); },
    speak(t) { if (!this.enabled || !this.voice) return; this.synth.cancel(); const u = new SpeechSynthesisUtterance(t); u.voice = this.voice; u.rate = 0.9; u.pitch = 1; this.synth.speak(u); }
};

// --- 1. STORAGE ---
const Storage = {
    KEY_S: 'kana_dojo_settings_v3', KEY_H: 'kana_dojo_highscore', KEY_P: 'kana_dojo_progress',
    save(s) { localStorage.setItem(this.KEY_S, JSON.stringify(s)); },
    load() { const d = localStorage.getItem(this.KEY_S); return d ? JSON.parse(d) : null; },
    getProgress() { return parseInt(localStorage.getItem(this.KEY_P) || '1'); }, // Nivel actual (empieza en 1)
    saveProgress(lvl) { const cur = this.getProgress(); if(lvl > cur) localStorage.setItem(this.KEY_P, lvl); }
};

// --- 2. CANVAS ---
const CanvasManager = {
    el: document.getElementById('writeCanvas'), ctx: document.getElementById('writeCanvas').getContext('2d'),
    isDrawing: false, isActive: true,
    init() {
        this.resize(); window.addEventListener('resize', () => this.resize());
        ['mousedown','touchstart'].forEach(e=>this.el.addEventListener(e, ev=>{ ev.preventDefault(); this.start(ev.touches?ev.touches[0]:ev); }, {passive:false}));
        ['mouseup','touchend'].forEach(e=>this.el.addEventListener(e, ()=>this.stop()));
        ['mousemove','touchmove'].forEach(e=>this.el.addEventListener(e, ev=>{ ev.preventDefault(); this.draw(ev.touches?ev.touches[0]:ev); }, {passive:false}));
        this.setupStyle();
    },
    resize() { 
        const r=this.el.parentElement.getBoundingClientRect(); const dpr=window.devicePixelRatio||1;
        this.el.width=r.width*dpr; this.el.height=r.height*dpr; this.ctx.scale(dpr,dpr);
        this.el.style.width=r.width+'px'; this.el.style.height=r.height+'px'; this.setupStyle();
    },
    setupStyle() { this.ctx.lineWidth=6; this.ctx.lineCap='round'; this.ctx.strokeStyle='#333'; },
    pos(ev) { const r=this.el.getBoundingClientRect(); return {x:ev.clientX-r.left, y:ev.clientY-r.top}; },
    start(p) { if(!this.isActive)return; this.isDrawing=true; this.ctx.beginPath(); const xy=this.pos(p); this.ctx.moveTo(xy.x, xy.y); },
    draw(p) { if(!this.isDrawing||!this.isActive)return; const xy=this.pos(p); this.ctx.lineTo(xy.x, xy.y); this.ctx.stroke(); },
    stop() { this.isDrawing=false; },
    clear() { const dpr=window.devicePixelRatio||1; this.ctx.clearRect(0,0,this.el.width/dpr,this.el.height/dpr); },
    toggle(on) { this.isActive=on; this.el.style.display=on?'block':'none'; },
    guides(n) { if(!this.isActive||n<=1)return; const dpr=window.devicePixelRatio||1; const w=(this.el.width/dpr)/n; const h=this.el.height/dpr; this.ctx.save(); this.ctx.strokeStyle='#ccc'; this.ctx.lineWidth=2; this.ctx.setLineDash([5,5]); this.ctx.beginPath(); for(let i=1;i<n;i++){this.ctx.moveTo(w*i,0);this.ctx.lineTo(w*i,h);} this.ctx.stroke(); this.ctx.restore(); }
};

// --- 3. NAVEGACIÓN ---
const Navigation = {
    goHome() {
        document.getElementById('setup-screen').style.display = 'none';
        document.getElementById('practice-screen').style.display = 'none';
        document.getElementById('campaign-screen').style.display = 'none';
        document.getElementById('main-menu').style.display = 'block';
    },
    goToFreeMode() {
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('setup-screen').style.display = 'block';
    },
    goToCampaign() {
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('campaign-screen').style.display = 'block';
        Campaign.render();
    }
};

// --- 4. CAMPAÑA (Niveles basados en tu nota) ---
const Campaign = {
    data: [
        // NIVEL 1: VOCALES
        { id: 1, title: "1-1. Fundamentos", desc: "Vocales • Entrenamiento", cfg: { rows:['row-a'], trace:true, time:false, target:5 } },
        { id: 2, title: "1-2. Prueba Vocal", desc: "Vocales • Contrareloj", cfg: { rows:['row-a'], trace:false, time:true, target:8 } }, // Score > 8
        // NIVEL 2: K-ROW
        { id: 3, title: "2-1. La fila K", desc: "Ka Ki Ku... • Entrenamiento", cfg: { rows:['row-k'], trace:true, time:false, target:5 } },
        { id: 4, title: "2-2. Reflejos K", desc: "Fila K • Contrareloj", cfg: { rows:['row-k'], trace:false, time:true, target:8 } },
        // NIVEL 3: S-ROW
        { id: 5, title: "3-1. La fila S", desc: "Sa Shi Su... • Entrenamiento", cfg: { rows:['row-s'], trace:true, time:false, target:5 } },
        { id: 6, title: "3-2. Reflejos S", desc: "Fila S • Contrareloj", cfg: { rows:['row-s'], trace:false, time:true, target:8 } },
        // NIVEL 4: COMBINACIONES
        { id: 7, title: "4-1. Combo A + K", desc: "Vocales y K • Contrareloj", cfg: { rows:['row-a','row-k'], trace:false, time:true, target:10 } },
        { id: 8, title: "4-2. Triada A + K + S", desc: "Vocales, K y S • Contrareloj", cfg: { rows:['row-a','row-k','row-s'], trace:false, time:true, target:10 } },
        // NIVEL 5: T-ROW
        { id: 9, title: "5-1. La fila T", desc: "Ta Chi Tsu... • Entrenamiento", cfg: { rows:['row-t'], trace:true, time:false, target:5 } }
    ],
    
    currentLevel: null,

    render() {
        const container = document.getElementById('mission-path');
        container.innerHTML = '';
        const maxLevel = Storage.getProgress();

        this.data.forEach(lvl => {
            const isLocked = lvl.id > maxLevel;
            const isCompleted = lvl.id < maxLevel;
            const isActive = lvl.id === maxLevel;

            const div = document.createElement('div');
            div.className = `level-node ${isLocked ? 'locked' : ''} ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`;
            if (!isLocked) div.onclick = () => this.startLevel(lvl);

            div.innerHTML = `
                <div class="level-icon">${isLocked ? '🔒' : lvl.id}</div>
                <div class="level-info">
                    <h4>${lvl.title}</h4>
                    <p>${lvl.desc}</p>
                </div>
            `;
            container.appendChild(div);
        });
    },

    startLevel(lvl) {
        this.currentLevel = lvl;
        // Iniciar juego con configuración forzada
        Game.start(lvl.cfg, true); // true = modo campaña
    },

    completeLevelAndExit() {
        Storage.saveProgress(this.currentLevel.id + 1);
        document.getElementById('level-complete-modal').style.display = 'none';
        Navigation.goToCampaign();
    }
};

// --- 5. GAME ENGINE ---
const Game = {
    state: { mode:'hiragana', score:0, phase:1, pool:[], current:[], revealed:false, campaignMode:false, correctCount:0 },
    conf: { time:false, canvas:true, audio:true, trace:false, rows:[], targetScore:0 },
    timer: { id:null, max:15, cur:15 },

    init() {
        AudioManager.init(); this.loadConf();
        document.getElementById('btn-start').onclick=()=>this.start();
        document.getElementById('setup-screen').addEventListener('change',()=>this.saveConf());
        document.getElementById('btn-hira').onclick=()=>this.setMode('hiragana');
        document.getElementById('btn-kata').onclick=()=>this.setMode('katakana');
        CanvasManager.init();
    },
    loadConf() {
        const s = Storage.load();
        if(s) {
            this.setMode(s.mode);
            document.getElementById('time-mode-toggle').checked = s.time;
            document.getElementById('trace-mode-toggle').checked = s.trace;
            // ... resto de carga ...
        } else this.setMode('hiragana');
    },
    saveConf() { /* Guardar user settings solo si NO es campaña */
        if(this.state.campaignMode) return;
        // ... logica de guardado ...
    },
    setMode(m) {
        this.state.mode=m;
        document.getElementById('btn-hira').classList.toggle('active',m==='hiragana');
        document.getElementById('btn-kata').classList.toggle('active',m==='katakana');
    },
    
    // START MODIFICADO PARA ACEPTAR CONFIGURACIÓN EXTERNA
    start(overrideConfig = null, isCampaign = false) {
        this.state.campaignMode = isCampaign;
        this.state.score = 0;
        this.state.correctCount = 0;

        let rows = [];
        
        if (overrideConfig) {
            // Configuración desde Campaña
            this.conf.rows = overrideConfig.rows;
            this.conf.time = overrideConfig.time;
            this.conf.trace = overrideConfig.trace;
            this.conf.targetScore = overrideConfig.target; // Meta para ganar
            this.conf.canvas = true; // Siempre activo en campaña
            this.conf.audio = true;
            rows = this.conf.rows;
            
            document.getElementById('mission-title').innerText = isCampaign ? `OBJETIVO: ${this.conf.targetScore} PUNTOS` : "PRÁCTICA";
        } else {
            // Configuración desde UI (Modo Libre)
            rows = Array.from(document.querySelectorAll('.checkbox-grid input:checked')).map(c=>c.value);
            this.conf.time = document.getElementById('time-mode-toggle').checked;
            this.conf.trace = document.getElementById('trace-mode-toggle').checked;
            this.conf.canvas = document.getElementById('canvas-mode-toggle').checked;
            this.conf.targetScore = 9999; // Infinito en modo libre
            
            if(this.conf.trace) this.conf.time = false;
            document.getElementById('mission-title').innerText = "ENTRENAMIENTO LIBRE";
        }

        this.state.pool = kanaDB.filter(k => rows.includes(k.g));
        if(!this.state.pool.length) return alert("Error: Configuración de filas vacía");

        AudioManager.enabled = true;
        
        // Cambio de pantallas
        document.getElementById('setup-screen').style.display='none';
        document.getElementById('campaign-screen').style.display='none';
        document.getElementById('practice-screen').style.display='block';
        
        CanvasManager.toggle(this.conf.canvas);
        document.getElementById('canvas-toolbar').style.display=this.conf.canvas?'flex':'none';
        
        CanvasManager.resize();
        this.next();
    },

    next() {
        this.state.revealed=false;
        
        // Calcular tiempo si es Time Mode
        let qty=1;
        if(this.conf.time) { if(this.state.score >= 5) qty=2; }
        
        // Dificultad dinámica
        let t = 15 - (Math.min(5, Math.floor(this.state.score/3))*1.5); 
        if(t<5) t=5;
        this.timer.max = Math.ceil(t*qty);

        // Selección
        const seq=[];
        for(let i=0;i<qty;i++){
            const c = this.state.pool[Math.floor(Math.random()*this.state.pool.length)];
            seq.push(c);
        }
        this.state.current=seq;

        // UI Reset
        document.getElementById('romaji-display').innerText = seq.map(x=>x.r.toUpperCase()).join(' • ');
        document.getElementById('manual-audio-btn').style.display='none';
        document.getElementById('default-actions').style.display='flex';
        document.getElementById('evaluation-actions').style.display='none';
        document.getElementById('workspace').classList.remove('failed');
        document.getElementById('action-btn').innerText = "REVELAR JUTSU";
        
        const svgCont = document.getElementById('svg-container');
        svgCont.innerHTML=''; svgCont.classList.remove('visible');

        if(this.conf.canvas) { CanvasManager.clear(); CanvasManager.guides(qty); }

        if(this.conf.trace) {
            this.loadSvgs(true); this.playAudio();
            document.getElementById('manual-audio-btn').style.display='block';
            document.getElementById('action-btn').innerText = "SIGUIENTE";
            this.state.revealed=true;
        } else {
            this.startTimer();
        }
    },

    // ... (loadSvgs, startTimer, stopTimer, timeUp, playAudio, replayAnimation SON IGUALES QUE ANTES) ...
    async loadSvgs(ghost) {
        const c = document.getElementById('svg-container');
        const p = this.state.current.map(k => {
            const h = (this.state.mode==='hiragana'?k.h:k.k).codePointAt(0).toString(16).padStart(5,'0');
            return fetch(`https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg/kanji/${h}.svg`).then(r=>r.ok?r.text():null).catch(()=>null);
        });
        const res = await Promise.all(p);
        c.innerHTML='';
        res.forEach((txt,i)=>{
            const d=document.createElement('div'); d.className='svg-char'; if(ghost)d.classList.add('ghost');
            if(txt){ d.innerHTML=txt; const s=d.querySelector('svg'); s.removeAttribute('width'); s.removeAttribute('height'); }
            else { d.innerHTML=`<div style="font-size:3rem;font-family:'Klee One'">${this.state.mode==='hiragana'?this.state.current[i].h:this.state.current[i].k}</div>`; }
            c.appendChild(d);
        });
        c.classList.add('visible');
    },
    startTimer() {
        if(!this.conf.time) { document.getElementById('timer-container').style.display='none'; document.getElementById('timer-badge').style.display='none'; return; }
        if(this.timer.id) clearInterval(this.timer.id);
        this.timer.cur = this.timer.max;
        document.getElementById('timer-container').style.display='block';
        document.getElementById('timer-badge').style.display='block';
        document.getElementById('timer-badge').innerText = Math.ceil(this.timer.cur)+'s';
        this.timer.id = setInterval(()=>{
            this.timer.cur -= 0.1;
            document.getElementById('timer-bar').style.width = ((this.timer.cur/this.timer.max)*100)+'%';
            if(this.timer.cur<=0) this.timeUp();
        },100);
    },
    stopTimer() { if (this.timer.id) clearInterval(this.timer.id); },
    timeUp() { clearInterval(this.timer.id); this.reveal(true); },
    playAudio() { const t = this.state.current.map(x => this.state.mode==='hiragana'?x.h:x.k).join('。'); AudioManager.speak(t); },
    replayAnimation() { 
        const p = document.querySelectorAll('path'); p.forEach(x=>{ x.style.transition='none'; x.style.strokeDashoffset='1000'; });
        setTimeout(()=>{ p.forEach(x=>{ x.style.transition='stroke-dashoffset 0.5s ease-out'; x.style.strokeDashoffset='0'; }); },50); 
    },

    handleAction() {
        if(this.conf.trace) this.markResult(true);
        else { if(!this.state.revealed) this.reveal(false); else this.next(); }
    },

    async reveal(failed) {
        if(this.timer.id) clearInterval(this.timer.id);
        this.state.revealed=true;
        if(failed) {
            // En modo campaña contrareloj, fallar por tiempo puede ser fatal o restar puntos
            this.state.score = Math.max(0, this.state.score-1);
            document.getElementById('workspace').classList.add('failed', 'shake');
            document.getElementById('action-btn').innerText="TIEMPO AGOTADO";
        } else {
            document.getElementById('default-actions').style.display='none';
            document.getElementById('evaluation-actions').style.display='flex';
        }
        this.playAudio();
        document.getElementById('manual-audio-btn').style.display='block';
        await this.loadSvgs(false);
        document.getElementById('svg-container').style.opacity = '1';
    },

    markResult(ok) {
        const isTrace = this.conf.trace;
        
        if(ok) {
            this.state.score++;
            this.state.correctCount++;
            document.getElementById('workspace').classList.add('success-pulse');
            setTimeout(()=>document.getElementById('workspace').classList.remove('success-pulse'),500);
        } else {
            this.state.score = Math.max(0,this.state.score-1);
            document.getElementById('workspace').classList.add('shake', 'failed');
            setTimeout(()=>document.getElementById('workspace').classList.remove('shake'),500);
        }
        
        this.updateHUD();

        // CHECK VICTORY CONDITION (SOLO CAMPAÑA)
        if (this.state.campaignMode) {
            // Meta alcanzada? (Ej: 5 aciertos en Training, o Score 8 en Time Attack)
            const goalReached = isTrace ? (this.state.correctCount >= this.conf.targetScore) : (this.state.score >= this.conf.targetScore);
            
            if (goalReached) {
                setTimeout(() => {
                    document.getElementById('level-complete-modal').style.display = 'flex';
                }, 500);
                return;
            }
        }

        setTimeout(()=>this.next(), 600);
    },

    updateHUD() {
        document.getElementById('counter').innerText = `SCORE: ${this.state.score} / ${this.state.campaignMode ? this.conf.targetScore : '∞'}`;
    },

    exit() {
        if(this.timer.id) clearInterval(this.timer.id);
        document.getElementById('practice-screen').style.display='none';
        
        if(this.state.campaignMode) {
            document.getElementById('campaign-screen').style.display='block';
        } else {
            document.getElementById('setup-screen').style.display='block';
        }
    }
};

window.onload=()=>Game.init();
