// --- GAME STATE ---
let currentMode = 'hiragana';
let availablePool = [];
let currentChallenge = [];
let isRevealed = false;
let score = 0;
let gamePhase = 1; 

// Timer & Settings
let isTimeMode = false;
let isCanvasMode = true; 
let maxTime = 15;
let currentTime = 15;
let timerInterval = null;

// Canvas
const canvas = document.getElementById('writeCanvas');
const ctx = canvas.getContext('2d');
let isDrawing = false;

// --- SETUP LOGIC ---
function setMode(mode) {
    currentMode = mode;
    document.getElementById('btn-hira').classList.toggle('active', mode === 'hiragana');
    document.getElementById('btn-kata').classList.toggle('active', mode === 'katakana');
}

function startPractice() {
    // 1. Obtener filas
    const checkboxes = document.querySelectorAll('.checkbox-grid input:checked');
    const selectedGroups = Array.from(checkboxes).map(cb => cb.value);
    availablePool = kanaDB.filter(item => selectedGroups.includes(item.g));

    if (availablePool.length === 0) return alert("Selecciona al menos una fila");

    // 2. Configuración Juego
    isTimeMode = document.getElementById('time-mode-toggle').checked;
    isCanvasMode = document.getElementById('canvas-mode-toggle').checked; 
    
    score = 0;
    gamePhase = 1;

    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('practice-screen').style.display = 'flex';
    
    // Configurar UI según modo pizarra
    if (isCanvasMode) {
        document.getElementById('canvas-toolbar').style.display = 'flex';
        document.getElementById('score-only').style.display = 'none';
        document.getElementById('writeCanvas').style.display = 'block';
        document.getElementById('instruction-text').innerText = "Escribe en las zonas asignadas";
        initCanvas();
    } else {
        document.getElementById('canvas-toolbar').style.display = 'none';
        document.getElementById('score-only').style.display = 'block';
        document.getElementById('writeCanvas').style.display = 'none'; 
        document.getElementById('instruction-text').innerText = "Escribe en tu papel";
    }

    nextTurn();
}

function exitPractice() {
    stopTimer();
    document.getElementById('practice-screen').style.display = 'none';
    document.getElementById('setup-screen').style.display = 'block';
}

// --- CORE GAME LOGIC ---

function updatePhase() {
    gamePhase = Math.floor(score / 5) + 1;
    if (gamePhase > 5) gamePhase = 5;
    
    let phaseText = `Nivel ${gamePhase}`;
    if(gamePhase >= 3) phaseText += " (Combos)";
    if(gamePhase >= 5) phaseText += " (Experto)";
    document.getElementById('phase-badge').innerText = phaseText;
    
    document.getElementById('counter').innerText = `Score: ${score}`;
    document.getElementById('score-only').innerText = `Score: ${score}`;
}

function generateNextChallenge() {
    updatePhase();

    let quantity = 1;
    if (isTimeMode) {
        if (gamePhase >= 3) quantity = 2;
        if (gamePhase >= 5) quantity = 3;
    }

    let timePerKana = 15 - (gamePhase * 1.5); 
    if (timePerKana < 4) timePerKana = 4;
    maxTime = Math.ceil(timePerKana * quantity);

    const sequence = [];
    
    for (let i = 0; i < quantity; i++) {
        let candidate;
        let attempts = 0;
        
        do {
            candidate = availablePool[Math.floor(Math.random() * availablePool.length)];
            attempts++;
            
            let bad = false;
            if (i >= 2) {
                if (candidate === sequence[i-1] && candidate === sequence[i-2]) bad = true;
            }
            if (availablePool.length > 10 && i > 0) {
                if (candidate === sequence[i-1]) bad = true;
            }

        } while (attempts < 10 && candidate === undefined);

        sequence.push(candidate);
    }
    
    return sequence;
}

function nextTurn() {
    currentChallenge = generateNextChallenge();
    loadCardUI();
}

function loadCardUI() {
    isRevealed = false;
    
    const romajiString = currentChallenge.map(c => c.r.toUpperCase()).join(' • ');
    document.getElementById('romaji-display').innerText = romajiString;

    const svgContainer = document.getElementById('svg-container');
    svgContainer.innerHTML = '';
    svgContainer.classList.remove('visible');
    document.getElementById('workspace').classList.remove('failed'); 
    
    const btn = document.getElementById('action-btn');
    btn.innerText = "Ver Respuesta";
    btn.classList.remove('btn-outline');
    btn.classList.add('btn-main');
    document.getElementById('replay-btn').style.display = 'none';

    if (isCanvasMode) {
        clearCanvas();
        drawCanvasGuides(currentChallenge.length);
    }

    startTimer();
}

// --- CANVAS HELPERS ---
function drawCanvasGuides(count) {
    if (count <= 1) return;
    
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    const sectionWidth = canvas.width / count;
    
    ctx.beginPath();
    for (let i = 1; i < count; i++) {
        const x = sectionWidth * i;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }
    ctx.stroke();
    
    ctx.setLineDash([]);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 8;
}

// --- TIMER LOGIC ---
function startTimer() {
    if (!isTimeMode) {
        document.getElementById('timer-container').style.display = 'none';
        document.getElementById('timer-badge').style.display = 'none';
        return;
    }

    currentTime = maxTime;
    const timerBar = document.getElementById('timer-bar');
    const timerBadge = document.getElementById('timer-badge');
    
    document.getElementById('timer-container').style.display = 'block';
    timerBadge.style.display = 'block';
    timerBadge.innerText = `${Math.ceil(currentTime)}s`;
    timerBar.style.width = '100%';
    timerBar.style.background = 'var(--secondary)';

    stopTimer(); 

    timerInterval = setInterval(() => {
        currentTime -= 0.1;
        const percentage = (currentTime / maxTime) * 100;
        timerBar.style.width = `${percentage}%`;
        
        if (percentage < 30) timerBar.style.background = 'var(--danger)';
        
        if(Math.floor(currentTime*10)%10 === 0) {
                timerBadge.innerText = `${Math.ceil(currentTime)}s`;
        }

        if (currentTime <= 0) {
            timeUp();
        }
    }, 100);
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
}

function timeUp() {
    stopTimer();
    document.getElementById('timer-bar').style.width = '0%';
    revealAnswer(true); 
}

// --- REVEAL LOGIC ---
function handleAction() {
    if (!isRevealed) revealAnswer(false);
    else {
        score++;
        nextTurn();
    }
}

async function revealAnswer(failed = false) {
    stopTimer();
    isRevealed = true;
    
    const btn = document.getElementById('action-btn');
    btn.innerText = failed ? "Tiempo Agotado (Continuar)" : "Correcto (Siguiente)";
    if(failed) score = Math.max(0, score - 1);

    document.getElementById('replay-btn').style.display = 'block';
    
    const container = document.getElementById('svg-container');
    container.classList.add('visible');
    if (failed) document.getElementById('workspace').classList.add('failed');

    const promises = currentChallenge.map(item => {
        const char = currentMode === 'hiragana' ? item.h : item.k;
        const hex = char.codePointAt(0).toString(16).padStart(5, '0');
        const url = `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg/kanji/${hex}.svg`;
        return fetch(url).then(res => res.ok ? res.text() : null).catch(() => null);
    });

    const results = await Promise.all(promises);

    container.innerHTML = '';
    results.forEach((svgText, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'svg-char';
        
        if (svgText) {
            wrapper.innerHTML = svgText;
            const svgElement = wrapper.querySelector('svg');
            svgElement.removeAttribute('width');
            svgElement.removeAttribute('height');
        } else {
            const item = currentChallenge[index];
            wrapper.innerHTML = `<div style="font-size:3rem; font-family:'Klee One'">${currentMode==='hiragana'?item.h:item.k}</div>`;
        }
        container.appendChild(wrapper);
    });

    animateStrokeOrder();
}

function animateStrokeOrder() {
    const paths = document.querySelectorAll('#svg-container path');
    
    paths.forEach(p => {
        p.style.transition = 'none';
        p.style.strokeDasharray = '1000';
        p.style.strokeDashoffset = '1000';
    });
    
    void document.getElementById('svg-container').offsetWidth;

    let delay = 0;
    const duration = 600; 

    paths.forEach((path) => {
        setTimeout(() => {
            path.style.transition = `stroke-dashoffset ${duration}ms ease-out`;
            path.style.strokeDashoffset = '0';
        }, delay);
        delay += 100;
    });
}

// --- CANVAS INPUT ---
function initCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#333';
    
    canvas.onmousedown = startDraw;
    canvas.onmouseup = endDraw;
    canvas.onmousemove = draw;
    canvas.ontouchstart = (e) => { e.preventDefault(); startDraw(e.touches[0]); };
    canvas.ontouchend = endDraw;
    canvas.ontouchmove = (e) => { e.preventDefault(); draw(e.touches[0]); };
}
function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    return { 
        x: (clientX - rect.left), 
        y: (clientY - rect.top) 
    };
}
function startDraw(e) { if(!isCanvasMode) return; isDrawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); }
function draw(e) { if (!isDrawing || !isCanvasMode) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }
function endDraw() { isDrawing = false; }
function clearCanvas() { 
    if(!isCanvasMode) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    if(currentChallenge.length > 1) drawCanvasGuides(currentChallenge.length);
}

// --- PRINT LOGIC ---
function generatePrintSheet() {
    if (availablePool.length === 0 && (!currentChallenge || currentChallenge.length === 0)) {
        const checkboxes = document.querySelectorAll('.checkbox-grid input:checked');
        const selectedGroups = Array.from(checkboxes).map(cb => cb.value);
        availablePool = kanaDB.filter(item => selectedGroups.includes(item.g));
    }
    if (availablePool.length === 0) return alert("Selecciona al menos una fila");
    
    const container = document.getElementById('print-content');
    container.innerHTML = ''; 
    document.querySelector('.print-title').innerText = `Práctica de ${currentMode === 'hiragana' ? 'Hiragana' : 'Katakana'}`;
    
    const itemsToPrint = [...availablePool].sort((a,b) => a.r.localeCompare(b.r));

    itemsToPrint.forEach(item => {
        const char = currentMode === 'hiragana' ? item.h : item.k;
        const row = document.createElement('div');
        row.className = 'print-row';
        const label = document.createElement('div');
        label.className = 'print-label';
        label.innerText = item.r;
        row.appendChild(label);
        const grid = document.createElement('div');
        grid.className = 'print-grid';
        for(let i=0; i<8; i++) {
            const cell = document.createElement('div');
            cell.className = 'print-cell';
            if (i <= 3) {
                const span = document.createElement('span');
                span.className = 'print-kana';
                span.innerText = char;
                if (i === 0) span.classList.add('master');
                cell.appendChild(span);
            }
            grid.appendChild(cell);
        }
        row.appendChild(grid);
        container.appendChild(row);
    });
    window.print();
}
