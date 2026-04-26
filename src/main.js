import { provincias, candidatos, simularProvincia, evaluarBalotaje, calcularDHondt, calcularSenadores } from './electoralEngine.js';

const btnStart = document.getElementById('btn-start');
const globalProgressBar = document.getElementById('global-progress-bar');
const globalProgressText = document.getElementById('global-progress-text');
const nationalCharts = document.getElementById('national-charts');
const provTableBody = document.getElementById('prov-table-body');
const statusBadge = document.getElementById('status-badge');
const balotajeModule = document.getElementById('balotaje-module');
const balotajeText = document.getElementById('balotaje-text');
const scenarioSelect = document.getElementById('scenario-select');
const turnoutSlider = document.getElementById('turnout-slider');
const turnoutVal = document.getElementById('turnout-val');
const tileMap = document.getElementById('tile-map');
const congressModule = document.getElementById('congress-module');
const barDiputados = document.getElementById('bar-diputados');
const barSenadores = document.getElementById('bar-senadores');
const legendDiputados = document.getElementById('legend-diputados');
const legendSenadores = document.getElementById('legend-senadores');
const historyContainer = document.getElementById('history-container');
const btnExport = document.getElementById('btn-export');
const btnSound = document.getElementById('btn-sound');

let isRunning = false;
let soundEnabled = true;

// --- AUDIO SYSTEM ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playTick() {
    if (!soundEnabled) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.05);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
}

function playSuccess() {
    if (!soundEnabled) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    btnSound.innerHTML = soundEnabled ? '🔊' : '🔇';
    btnSound.classList.toggle('text-emerald-400', soundEnabled);
    btnSound.classList.toggle('text-slate-500', !soundEnabled);
});

// --- UI HELPERS ---
function hexToRgba(hex, alpha) {
    let r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

turnoutSlider.addEventListener('input', (e) => {
    turnoutVal.textContent = `${e.target.value}%`;
});

// --- MAPA INICIAL ---
function initTileMap() {
    tileMap.innerHTML = '';
    provincias.forEach(prov => {
        const div = document.createElement('div');
        div.id = `tile-${prov.id}`;
        div.className = 'tile bg-slate-800 border border-slate-700';
        div.style.gridRow = prov.gridCoords.row;
        div.style.gridColumn = prov.gridCoords.col;
        div.textContent = prov.id.toUpperCase();
        tileMap.appendChild(div);
    });
}
initTileMap();

// --- HISTORIAL ---
function loadHistory() {
    let hist = JSON.parse(localStorage.getItem('eleccionesHistory') || '[]');
    if (hist.length === 0) {
        historyContainer.innerHTML = '<div class="text-slate-500 italic">No hay historial aún.</div>';
        return;
    }
    historyContainer.innerHTML = '';
    hist.forEach(h => {
        const cand = candidatos[h.ganadorId];
        historyContainer.innerHTML += `
            <div class="flex justify-between items-center p-2 rounded bg-slate-900 border border-slate-800">
                <span class="text-slate-400">${h.escenario} (${h.turnout}%)</span>
                <span class="font-bold" style="color:${cand.color}">${cand.nombre} ${h.porcentaje.toFixed(1)}%</span>
            </div>
        `;
    });
}
function saveHistory(escenarioLabel, turnout, ganadorId, porcentaje) {
    let hist = JSON.parse(localStorage.getItem('eleccionesHistory') || '[]');
    hist.unshift({ escenario: escenarioLabel, turnout, ganadorId, porcentaje });
    if (hist.length > 5) hist.pop();
    localStorage.setItem('eleccionesHistory', JSON.stringify(hist));
    loadHistory();
}
loadHistory();

// --- SIMULATION ---
async function startSimulation() {
    if (isRunning) return;
    isRunning = true;
    
    // Resume audio context
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    // Reset UI
    btnStart.disabled = true;
    btnStart.classList.add('opacity-50', 'cursor-not-allowed');
    btnStart.innerHTML = 'ESCRUTANDO...';
    btnExport.classList.add('hidden');
    
    provTableBody.innerHTML = '';
    nationalCharts.innerHTML = '';
    balotajeModule.classList.add('hidden');
    congressModule.classList.add('hidden');
    initTileMap();
    
    let totalPais = { lla: 0, uxp: 0, pro: 0, ucr: 0, hnp: 0, pd: 0, fit: 0, blanco: 0 };
    let totalDiputados = { lla: 0, uxp: 0, pro: 0, ucr: 0, hnp: 0, pd: 0, fit: 0 };
    let totalSenadores = { lla: 0, uxp: 0, pro: 0, ucr: 0, hnp: 0, pd: 0, fit: 0 };
    let pesoAcumulado = 0;
    
    statusBadge.textContent = 'En Progreso...';
    statusBadge.className = 'px-4 py-1.5 rounded-full bg-blue-500/20 text-blue-400 text-sm font-bold border border-blue-500/50 animate-pulse';

    const scenario = scenarioSelect.value;
    const scenarioLabel = scenarioSelect.options[scenarioSelect.selectedIndex].text;
    const turnout = parseInt(turnoutSlider.value);
    
    let baseAjuste = {};
    if (scenario === 'lla_surge') baseAjuste = { lla: 5 };
    if (scenario === 'uxp_surge') baseAjuste = { uxp: 5 };

    for (let prov of provincias) {
        // Simular latencia de carga de datos (Live mode)
        await new Promise(res => setTimeout(res, 500));
        playTick();
        
        let resProvincia = simularProvincia(prov, baseAjuste, turnout);
        
        // Sumar al total nacional ponderado
        Object.keys(resProvincia).forEach(k => {
            totalPais[k] += resProvincia[k] * (prov.peso / 100);
        });
        
        // Calcular Congreso para esta provincia
        let dipProv = calcularDHondt(resProvincia, prov.escanos);
        let senProv = calcularSenadores(resProvincia);
        
        Object.keys(dipProv).forEach(k => totalDiputados[k] += dipProv[k]);
        Object.keys(senProv).forEach(k => totalSenadores[k] += senProv[k]);
        
        pesoAcumulado += prov.peso;
        
        // Actualizar UI - Progreso
        let pctProgreso = pesoAcumulado.toFixed(2);
        globalProgressText.textContent = `${pctProgreso}%`;
        globalProgressBar.style.width = `${pctProgreso}%`;
        
        // Determinar Ganador Local
        let ordenLocal = Object.entries(resProvincia).sort((a,b) => b[1] - a[1]);
        let ganador = ordenLocal[0];
        let segundo = ordenLocal[1];
        let cGanador = candidatos[ganador[0]];
        let cSegundo = candidatos[segundo[0]];
        
        // Actualizar Tile Map
        const tile = document.getElementById(`tile-${prov.id}`);
        if (tile) {
            tile.style.backgroundColor = hexToRgba(cGanador.color, 0.8);
            tile.style.borderColor = cGanador.color;
            tile.style.color = '#ffffff';
            tile.classList.add('shadow-[0_0_15px_rgba(255,255,255,0.3)]');
            setTimeout(() => tile.classList.remove('shadow-[0_0_15px_rgba(255,255,255,0.3)]'), 300);
        }

        // Actualizar Tabla
        const row = document.createElement('tr');
        row.className = "border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors animate-fade-in";
        row.innerHTML = `
            <td class="py-3 font-medium text-slate-200">${prov.n}</td>
            <td class="py-3 text-right text-slate-400 text-xs">${prov.peso.toFixed(2)}%</td>
            <td class="py-3 text-center">
                <span class="px-2 py-1 rounded text-xs font-bold" style="background-color: ${hexToRgba(cGanador.color, 0.2)}; color: ${cGanador.color}; border: 1px solid ${hexToRgba(cGanador.color, 0.5)}">
                    ${cGanador.nombre}
                </span>
            </td>
            <td class="py-3 text-right font-bold" style="color: ${cGanador.color}">${ganador[1].toFixed(1)}%</td>
            <td class="py-3 text-right text-slate-400 text-xs">${cSegundo.nombre} (${segundo[1].toFixed(1)}%)</td>
        `;
        provTableBody.prepend(row);
        
        // Actualizar Cartelera Nacional
        renderNationalCharts(totalPais, pesoAcumulado);
    }
    
    playSuccess();

    // Finalizar
    isRunning = false;
    btnStart.disabled = false;
    btnStart.classList.remove('opacity-50', 'cursor-not-allowed');
    btnStart.innerHTML = 'NUEVA SIMULACIÓN';
    btnExport.classList.remove('hidden');
    
    statusBadge.textContent = 'Escrutinio Finalizado (100%)';
    statusBadge.className = 'px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-bold border border-emerald-500/50';

    // Evaluar Constitucionalidad (Balotaje)
    const analisis = evaluarBalotaje(totalPais);
    balotajeModule.classList.remove('hidden');
    balotajeText.innerHTML = `
        <strong>Análisis sobre votos afirmativos válidos (sin blancos/nulos):</strong><br>
        1. ${candidatos[analisis.primero[0]].nombre}: ${analisis.porcentajesAfirmativos[analisis.primero[0]].toFixed(2)}%<br>
        2. ${candidatos[analisis.segundo[0]].nombre}: ${analisis.porcentajesAfirmativos[analisis.segundo[0]].toFixed(2)}%<br>
        <br>
        <span class="${analisis.ganaPrimeraVuelta ? 'text-emerald-400' : 'text-amber-400'} font-black text-base">
            DICTAMEN: ${analisis.razon}
        </span>
    `;

    // Renderizar Congreso
    renderCongress(totalDiputados, totalSenadores);

    // Guardar Historial
    saveHistory(scenarioLabel, turnout, analisis.primero[0], analisis.porcentajesAfirmativos[analisis.primero[0]]);
}

function renderNationalCharts(totalPaisPonderado, pesoTotalAcumulado) {
    let dataNormalizada = {};
    Object.keys(totalPaisPonderado).forEach(k => {
        dataNormalizada[k] = (totalPaisPonderado[k] / pesoTotalAcumulado) * 100;
    });

    let orden = Object.entries(dataNormalizada).sort((a,b) => b[1] - a[1]);
    
    let html = '';
    orden.forEach(item => {
        let key = item[0];
        let pct = item[1];
        let cand = candidatos[key];
        
        html += `
            <div class="mb-4">
                <div class="flex justify-between items-end mb-1">
                    <span class="font-bold text-slate-200">${cand.nombre}</span>
                    <span class="font-black text-xl" style="color: ${cand.color}">${pct.toFixed(2)}%</span>
                </div>
                <div class="w-full bg-slate-900 rounded-full h-4 overflow-hidden border border-slate-800 relative">
                    <div class="h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden" 
                         style="width: ${pct}%; background-color: ${cand.color}; box-shadow: 0 0 10px ${cand.color};">
                         <svg class="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <pattern id="stripes" width="8" height="8" patternTransform="rotate(45)">
                                    <line x1="0" y1="0" x2="0" y2="8" stroke="#ffffff" stroke-width="4"></line>
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#stripes)"></rect>
                         </svg>
                    </div>
                </div>
            </div>
        `;
    });
    
    nationalCharts.innerHTML = html;
}

function renderCongress(diputados, senadores) {
    congressModule.classList.remove('hidden');
    
    const buildBar = (data, total) => {
        let barHtml = '';
        let legendHtml = '';
        let sorted = Object.entries(data).sort((a,b) => b[1] - a[1]).filter(i => i[1] > 0);
        
        sorted.forEach(item => {
            let k = item[0];
            let v = item[1];
            let cand = candidatos[k];
            let pct = (v / total) * 100;
            
            barHtml += `<div class="h-full" style="width: ${pct}%; background-color: ${cand.color};" title="${cand.nombre}: ${v}"></div>`;
            legendHtml += `
                <div class="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                    <div class="w-2 h-2 rounded-full" style="background-color: ${cand.color}"></div>
                    <span class="text-slate-400">${cand.id.toUpperCase()}</span>
                    <span class="font-bold text-white">${v}</span>
                </div>
            `;
        });
        return { barHtml, legendHtml };
    };

    let dipUI = buildBar(diputados, 257);
    barDiputados.innerHTML = dipUI.barHtml;
    legendDiputados.innerHTML = dipUI.legendHtml;

    let senUI = buildBar(senadores, 72);
    barSenadores.innerHTML = senUI.barHtml;
    legendSenadores.innerHTML = senUI.legendHtml;
}

// --- EXPORT FUNCTIONALITY ---
btnExport.addEventListener('click', () => {
    const target = document.getElementById('export-target');
    btnExport.innerHTML = 'Generando...';
    
    html2canvas(target, {
        backgroundColor: '#0f172a', // bg-slate-900
        scale: 2
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Elecciones2027_Reporte_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        btnExport.innerHTML = '📸 Exportar Reporte';
    });
});

btnStart.addEventListener('click', startSimulation);

// CSS inline animation config
const style = document.createElement('style');
style.innerHTML = `
@keyframes fade-in {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
    animation: fade-in 0.3s ease-out forwards;
}
`;
document.head.appendChild(style);
