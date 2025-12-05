// --- 0. AUDIO ---
const AudioManager = {
    synth: window.speechSynthesis, voice: null, enabled: true,
    init() { if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = () => this.loadVoice(); this.loadVoice(); },
    loadVoice() { const v = this.synth.getVoices(); this.voice = v.find(x => x.lang === 'ja-JP') || v.find(x => x.lang.includes('ja')); },
    speak(t) { if (!this.enabled || !this.voice) return; this.synth.cancel(); const u = new SpeechSynthesisUtterance(t); u.voice = this.voice; u.rate = 0.9; u.pitch = 1; this.synth.speak(u); }
};

// --- 1. STORAGE ---
const Storage = {
    KEY_S: 'kana_dojo_settings_v3', KEY_H: 'kana_dojo_highscore',
    save(s) { localStorage.setItem(this.KEY_S, JSON.stringify(s)); },
    load() { const d = localStorage.getItem(this.KEY_S); return d ? JSON.parse(d) : null; },
    getHigh() { return parseInt(localStorage.getItem(this.KEY_H) || '0'); },
    setHigh(s) { if(s > this.getHigh()){ localStorage.setItem(this.KEY_H, s); return true; } return false; }
};

// --- 2. CANVAS ---
const CanvasManager = {
    el: document.getElementById('writeCanvas'), ctx: document.getElementById('writeCanvas').getContext('2d'),
    isDrawing: false, isActive: true,
    init() {
        this.resize(); window.addEventListener('resize', () => this.resize());
        ['mousedown','touchstart'].forEach(e=>this.el.addEventListener(e, ev=>{ ev.preventDefault(); this.start(ev.touches?ev.touches[0]:ev); }));
        ['mouseup','touchend'].forEach(e=>this.el.addEventListener(e, ()=>this.stop()));
        ['mousemove','touchmove'].forEach(e=>this.el.addEventListener(e, ev=>{ ev.preventDefault(); this.draw(ev.touches?ev.touches[0]:ev); }));
        this.ctx.lineWidth = 6; this.ctx.lineCap = 'round'; this.ctx.strokeStyle = '#333';
    },
    resize() { const r=this.el.parentElement.getBoundingClientRect(); this.el.width=r.width; this.el.height=r.height; this.ctx.lineWidth=6; this.ctx.lineCap='round'; this.ctx.strokeStyle='#333'; },
    pos(ev) { const r=this.el.getBoundingClientRect(); return {x:ev.clientX-r.left, y:ev.clientY-r.top}; },
    start(p) { if(!this.isActive)return; this.isDrawing=true; this.ctx.beginPath(); const xy=this.pos(p); this.ctx.moveTo(xy.x, xy.y); },
    draw(p) { if(!this.isDrawing||!this.isActive)return; const xy=this.pos(p); this.ctx.lineTo(xy.x, xy.y); this.ctx.stroke(); },
    stop() { this.isDrawing=false; },
    clear() { this.ctx.clearRect(0,0,this.el.width,this.el.height); },
    toggle(on) { this.isActive=on; this.el.style.display=on?'block':'none'; },
    guides(n) { if(!this.isActive||n<=1)return; this.ctx.save(); this.ctx.strokeStyle='#ccc'; this.ctx.lineWidth=2; this.ctx.setLineDash([5,5]); const w=this.el.width/n; this.ctx.beginPath(); for(let i=1;i<n;i++){this.ctx.moveTo(w*i,0);this.ctx.lineTo(w*i,this.el.height);} this.ctx.stroke(); this.ctx.restore(); }
};

// --- 3. GAME ---
const Game = {
    state: { mode:'hiragana', score:0, high:0, phase:1, pool:[], current:[], revealed:false },
    conf: { time:false, canvas:true, audio:true, trace:false, rows:[] },
    timer: { id:null, max:15, cur:15 },

    init() {
        AudioManager.init(); this.loadConf();
        document.getElementById('btn-start').onclick=()=>this.start();
        document.getElementById('setup-screen').addEventListener('change',()=>this.saveConf());
        document.getElementById('btn-hira').onclick=()=>this.setMode('hiragana');
        document.getElementById('btn-kata').onclick=()=>this.setMode('katakana');
        CanvasManager.init(); this.updHigh();
    },
    loadConf() {
        const s = Storage.load();
        if(s) {
            this.setMode(s.mode);
            document.getElementById('time-mode-toggle').checked = s.time;
            document.getElementById('canvas-mode-toggle').checked = s.canvas;
            document.getElementById('audio-mode-toggle').checked = s.audio;
            document.getElementById('trace-mode-toggle').checked = s.trace;
            if(s.rows?.length){ document.querySelectorAll('.checkbox-grid input').forEach(c=>c.checked=false); s.rows.forEach(v=>{const el=document.querySelector(`input[value="${v}"]`); if(el)el.checked=true;}); }
        } else this.setMode('hiragana');
        this.state.high = Storage.getHigh();
    },
    saveConf() {
        Storage.save({
            mode:this.state.mode, time:document.getElementById('time-mode-toggle').checked,
            canvas:document.getElementById('canvas-mode-toggle').checked, audio:document.getElementById('audio-mode-toggle').checked,
            trace:document.getElementById('trace-mode-toggle').checked,
            rows:Array.from(document.querySelectorAll('.checkbox-grid input:checked')).map(c=>c.value)
        });
    },
    setMode(m) {
        this.state.mode=m;
        document.getElementById('btn-hira').classList.toggle('active',m==='hiragana');
        document.getElementById('btn-kata').classList.toggle('active',m==='katakana');
        this.saveConf();
    },
    start() {
        const sel = Array.from(document.querySelectorAll('.checkbox-grid input:checked')).map(c=>c.value);
        this.state.pool = kanaDB.filter(k => sel.includes(k.g));
        if(!this.state.pool.length) return alert("Selecciona filas");
        
        this.conf.time = document.getElementById('time-mode-toggle').checked;
        this.conf.canvas = document.getElementById('canvas-mode-toggle').checked;
        this.conf.audio = document.getElementById('audio-mode-toggle').checked;
        this.conf.trace = document.getElementById('trace-mode-toggle').checked;
        if(this.conf.trace) this.conf.time = false;

        AudioManager.enabled = this.conf.audio;
        this.state.score=0; this.state.phase=1;
        document.getElementById('setup-screen').style.display='none';
        document.getElementById('practice-screen').style.display='block';
        
        CanvasManager.toggle(this.conf.canvas);
        document.getElementById('canvas-toolbar').style.display=this.conf.canvas?'flex':'none';
        document.getElementById('score-only').style.display=this.conf.canvas?'none':'flex';
        
        // Fix resize bug on display block
        CanvasManager.resize();
        this.next();
    },
    next() {
        this.state.revealed=false;
        
        // Calc difficulty
        this.state.phase = Math.min(5, Math.floor(this.state.score/5)+1);
        let qty=1;
        if(this.conf.time || this.conf.trace) { if(this.state.phase>=3) qty=2; }
        
        let t = 15 - (this.state.phase*1.5); if(t<4) t=4;
        this.timer.max = Math.ceil(t*qty);

        // Generate
        const seq=[];
        for(let i=0;i<qty;i++){
            let c,s=0; do{c=this.state.pool[Math.floor(Math.random()*this.state.pool.length)];s++;}while(i>0&&c===seq[i-1]&&this.state.pool.length>5&&s<10);
            if(c)seq.push(c);
        }
        this.state.current=seq;

        // UI Reset
        document.getElementById('romaji-display').innerText = seq.map(x=>x.r.toUpperCase()).join(' • ');
        document.getElementById('phase-badge').innerText = `RANGO: ${this.state.phase}`;
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
            if(Math.abs(Math.round(this.timer.cur)-this.timer.cur)<0.15) document.getElementById('timer-badge').innerText=Math.ceil(this.timer.cur)+'s';
            if(this.timer.cur<=0) this.timeUp();
        },100);
    },
    timeUp() {
        clearInterval(this.timer.id);
        this.reveal(true);
    },
    handleAction() {
        if(this.conf.trace) this.markResult(true);
        else { if(!this.state.revealed) this.reveal(false); else this.next(); }
    },
    markResult(ok) {
        if(ok) {
            this.state.score++;
            document.getElementById('workspace').classList.add('success-pulse');
            setTimeout(()=>document.getElementById('workspace').classList.remove('success-pulse'),500);
            if(Storage.setHigh(this.state.score)) { this.state.high=this.state.score; this.updHigh(); }
        } else {
            this.state.score = Math.max(0,this.state.score-1);
            document.getElementById('workspace').classList.add('shake', 'failed');
            setTimeout(()=>document.getElementById('workspace').classList.remove('shake'),500);
        }
        this.updHigh();
        setTimeout(()=>this.next(), 600);
    },
    async reveal(failed) {
        if(this.timer.id) clearInterval(this.timer.id);
        this.state.revealed=true;
        if(failed) {
            this.state.score = Math.max(0, this.state.score-1);
            document.getElementById('workspace').classList.add('failed', 'shake');
            document.getElementById('action-btn').innerText="TIEMPO AGOTADO";
            this.updHigh();
        } else {
            document.getElementById('default-actions').style.display='none';
            document.getElementById('evaluation-actions').style.display='flex';
        }
        this.playAudio();
        document.getElementById('manual-audio-btn').style.display='block';
        await this.loadSvgs(false);
        // Force SVG visible
        document.getElementById('svg-container').style.opacity = '1';
    },
    playAudio() {
        const t = this.state.current.map(x => this.state.mode==='hiragana'?x.h:x.k).join('。');
        AudioManager.speak(t);
    },
    replayAnimation() {
        const p = document.querySelectorAll('path');
        p.forEach(x=>{ x.style.transition='none'; x.style.strokeDashoffset='1000'; });
        setTimeout(()=>{ p.forEach(x=>{ x.style.transition='stroke-dashoffset 0.5s ease-out'; x.style.strokeDashoffset='0'; }); },50);
    },
    updHigh() {
        const t = `BEST: ${this.state.high}`;
        document.getElementById('high-score-display').innerText=t;
        document.getElementById('high-score-display-alt').innerText=t;
        const s = `SCORE: ${this.state.score}`;
        document.getElementById('counter').innerText=s;
        document.getElementById('counter-alt').innerText=s;
    },
    exit() {
        if(this.timer.id) clearInterval(this.timer.id);
        document.getElementById('practice-screen').style.display='none';
        document.getElementById('setup-screen').style.display='block';
    }
};
window.onload=()=>Game.init();

window.generatePrintSheet = function() {
    let pool = Game.state.pool;
    if(!pool || !pool.length) {
        const sel = Array.from(document.querySelectorAll('.checkbox-grid input:checked')).map(c=>c.value);
        pool = kanaDB.filter(k => sel.includes(k.g));
    }
    if(!pool.length) return alert("Selecciona filas");
    const c = document.getElementById('print-content'); c.innerHTML='';
    document.querySelector('.print-title').innerText=`ENTRENAMIENTO: ${Game.state.mode.toUpperCase()}`;
    [...pool].sort((a,b)=>a.r.localeCompare(b.r)).forEach(k=>{
        const char = Game.state.mode==='hiragana'?k.h:k.k;
        const row = document.createElement('div'); row.className='print-row';
        const lbl = document.createElement('div'); lbl.className='print-label'; lbl.innerText=k.r;
        const grd = document.createElement('div'); grd.className='print-grid';
        for(let i=0;i<8;i++){
            const cell=document.createElement('div'); cell.className='print-cell';
            if(i<=3){ const s=document.createElement('span'); s.className='print-kana'; s.innerText=char; if(i===0)s.classList.add('master'); cell.appendChild(s); }
            grd.appendChild(cell);
        }
        row.appendChild(lbl); row.appendChild(grd); c.appendChild(row);
    });
    window.print();
};
