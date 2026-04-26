import { provincias, candidatos, coaliciones, simularProvincia, evaluarBalotaje, calcularDHondt, calcularSenadores, PADRON_NACIONAL } from './electoralEngine.js';

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
const speedSelect = document.getElementById('speed-select');
const coalitionToggle = document.getElementById('coalition-toggle');
const tileMap = document.getElementById('tile-map');
const mapTooltip = document.getElementById('map-tooltip');
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
let groupCoalitions = false;

coalitionToggle.addEventListener('change', (e) => {
    groupCoalitions = e.target.checked;
    // We would need current totals to re-render, but for simplicity it applies on the fly or at the end.
});

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
    
    let totalPaisPct = {};
    let totalPaisAbs = {};
    let totalDiputados = {};
    let totalSenadores = {};
    
    Object.keys(candidatos).forEach(k => {
        totalPaisPct[k] = 0;
        totalPaisAbs[k] = 0;
        if(k !== 'blanco') {
            totalDiputados[k] = 0;
            totalSenadores[k] = 0;
        }
    });
    let pesoAcumulado = 0;
    
    const scenario = scenarioSelect.value;
    const scenarioLabel = scenarioSelect.options[scenarioSelect.selectedIndex].text;
    const turnout = parseInt(turnoutSlider.value);

    // Calcular padron total emitido segun turnout
    const totalEmitidosNacional = PADRON_NACIONAL * (turnout / 100);
    
    statusBadge.textContent = 'En Progreso...';
    statusBadge.className = 'px-4 py-1.5 rounded-full bg-blue-500/20 text-blue-400 text-sm font-bold border border-blue-500/50 animate-pulse';
    
    let baseAjuste = {};
    if (scenario === 'lla_surge') baseAjuste = { lla: 5 };
    if (scenario === 'uxp_surge') baseAjuste = { uxp: 5 };

    const speed = parseInt(speedSelect.value);

    for (let prov of provincias) {
        // Simular latencia de carga de datos (Live mode)
        if (speed > 0) await new Promise(res => setTimeout(res, speed));
        playTick();
        
        let resProvincia = simularProvincia(prov, baseAjuste, turnout);
        
        // Votos absolutos emitidos en esta provincia
        let emitidosProvincia = totalEmitidosNacional * (prov.peso / 100);

        // Sumar al total nacional ponderado y absoluto
        Object.keys(resProvincia).forEach(k => {
            totalPaisPct[k] += resProvincia[k] * (prov.peso / 100);
            totalPaisAbs[k] += emitidosProvincia * (resProvincia[k] / 100);
        });
        
        // Calcular Congreso para esta provincia
        let dipProv = calcularDHondt(resProvincia, prov.escanos);
        let senProv = calcularSenadores(resProvincia, prov.renuevaSenadores);
        
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
        
        // Actualizar Tile Map y Tooltips
        const tile = document.getElementById(`tile-${prov.id}`);
        if (tile) {
            tile.style.backgroundColor = hexToRgba(cGanador.color, 0.8);
            tile.style.borderColor = cGanador.color;
            tile.style.color = '#ffffff';
            tile.classList.add('shadow-[0_0_15px_rgba(255,255,255,0.3)]');
            setTimeout(() => tile.classList.remove('shadow-[0_0_15px_rgba(255,255,255,0.3)]'), 300);

            // Swing state detector
            let diff = ganador[1] - segundo[1];
            if (diff < 3) {
                tile.classList.add('animate-pulse', 'border-4', 'border-yellow-400');
            }

            // Tooltips
            tile.onmouseenter = (e) => {
                mapTooltip.style.opacity = 1;
                mapTooltip.innerHTML = `
                    <div class="font-bold text-lg mb-1">${prov.n}</div>
                    <div class="text-xs mb-1">1º ${cGanador.nombre}: <span style="color:${cGanador.color}">${ganador[1].toFixed(1)}%</span></div>
                    <div class="text-xs text-slate-400 mb-2">2º ${cSegundo.nombre}: <span style="color:${cSegundo.color}">${segundo[1].toFixed(1)}%</span></div>
                    <div class="text-[10px] uppercase text-amber-400">Diferencia: ${diff.toFixed(2)}%</div>
                `;
            };
            tile.onmousemove = (e) => {
                mapTooltip.style.left = e.pageX + 15 + 'px';
                mapTooltip.style.top = e.pageY + 15 + 'px';
            };
            tile.onmouseleave = () => {
                mapTooltip.style.opacity = 0;
            };
        }

        // Actualizar Tabla
        const fmt = new Intl.NumberFormat('es-AR');
        let votosGanadorLocal = fmt.format(Math.round(emitidosProvincia * (ganador[1] / 100)));
        let votosSegundoLocal = fmt.format(Math.round(emitidosProvincia * (segundo[1] / 100)));

        const row = document.createElement('tr');
        row.className = "border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors animate-fade-in";
        row.innerHTML = `
            <td class="py-3 font-medium text-slate-200">${prov.n}</td>
            <td class="py-3 text-right text-slate-400 text-xs">${prov.peso.toFixed(2)}%</td>
            <td class="py-3 text-center">
                <span class="px-2 py-1 rounded text-xs font-bold block mb-1" style="background-color: ${hexToRgba(cGanador.color, 0.2)}; color: ${cGanador.color}; border: 1px solid ${hexToRgba(cGanador.color, 0.5)}">
                    ${cGanador.nombre}
                </span>
            </td>
            <td class="py-3 text-right">
                <div class="font-bold text-lg leading-tight" style="color: ${cGanador.color}">${ganador[1].toFixed(1)}%</div>
                <div class="text-[10px] text-slate-500 uppercase tracking-wider">${votosGanadorLocal} v.</div>
            </td>
            <td class="py-3 text-right text-slate-400 text-xs">
                <div>${cSegundo.nombre} (${segundo[1].toFixed(1)}%)</div>
                <div class="text-[10px] text-slate-500 uppercase tracking-wider">${votosSegundoLocal} v.</div>
            </td>
        `;
        provTableBody.prepend(row);
        
        // Actualizar Cartelera Nacional
        renderNationalCharts(totalPaisPct, totalPaisAbs, pesoAcumulado);
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
    const analisis = evaluarBalotaje(totalPaisPct, totalPaisAbs);
    const fmtTot = new Intl.NumberFormat('es-AR');
    balotajeModule.classList.remove('hidden');
    balotajeText.innerHTML = `
        <div class="flex justify-between items-center mb-2 border-b border-amber-500/20 pb-2">
            <strong>Votos Afirmativos Válidos:</strong>
            <span class="font-mono bg-amber-500/20 px-2 rounded">${fmtTot.format(Math.round(analisis.totalAfirmativoAbs))}</span>
        </div>
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

function renderNationalCharts(totalPaisPonderadoPct, totalPaisAbs, pesoTotalAcumulado) {
    let dataNormalizadaPct = {};
    Object.keys(totalPaisPonderadoPct).forEach(k => {
        dataNormalizadaPct[k] = (totalPaisPonderadoPct[k] / pesoTotalAcumulado) * 100;
    });

    let displayData = {};
    let displayAbs = {};

    if (groupCoalitions) {
        Object.keys(coaliciones).forEach(c => {
            displayData[c] = 0;
            displayAbs[c] = 0;
        });
        Object.keys(dataNormalizadaPct).forEach(k => {
            let coal = Object.keys(coaliciones).find(c => coaliciones[c].candidatos.includes(k));
            if (coal) {
                displayData[coal] += dataNormalizadaPct[k];
                displayAbs[coal] += totalPaisAbs[k];
            }
        });
    } else {
        displayData = { ...dataNormalizadaPct };
        displayAbs = { ...totalPaisAbs };
    }

    let orden = Object.entries(displayData).sort((a,b) => b[1] - a[1]);
    const fmt = new Intl.NumberFormat('es-AR');
    
    let html = '';
    orden.forEach(item => {
        let key = item[0];
        let pct = item[1];
        if(pct === 0) return;
        let candInfo = groupCoalitions ? coaliciones[key] : candidatos[key];
        let absVotos = fmt.format(Math.round(displayAbs[key]));
        
        html += `
            <div class="mb-4">
                <div class="flex justify-between items-end mb-1">
                    <span class="font-bold text-slate-200">${candInfo.nombre}</span>
                    <div class="text-right">
                        <div class="font-black text-xl leading-none" style="color: ${candInfo.color}">${pct.toFixed(2)}%</div>
                        <div class="text-[10px] text-slate-400 uppercase tracking-widest mt-1">${absVotos} votos</div>
                    </div>
                </div>
                <div class="w-full bg-slate-900 rounded-full h-4 overflow-hidden border border-slate-800 relative mt-1">
                    <div class="h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden" 
                         style="width: ${pct}%; background-color: ${candInfo.color}; box-shadow: 0 0 10px ${candInfo.color};">
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
        
        let displayData = {};
        if (groupCoalitions) {
            Object.keys(coaliciones).forEach(c => displayData[c] = 0);
            Object.keys(data).forEach(k => {
                let coal = Object.keys(coaliciones).find(c => coaliciones[c].candidatos.includes(k));
                if (coal) displayData[coal] += data[k];
            });
        } else {
            displayData = { ...data };
        }

        let sorted = Object.entries(displayData).sort((a,b) => b[1] - a[1]).filter(i => i[1] > 0);
        
        sorted.forEach(item => {
            let k = item[0];
            let v = item[1];
            let candInfo = groupCoalitions ? coaliciones[k] : candidatos[k];
            let pct = (v / total) * 100;
            let displayLabel = groupCoalitions ? candInfo.nombre.substring(0,4).toUpperCase() : candidatos[k].id.toUpperCase();
            
            barHtml += `<div class="h-full" style="width: ${pct}%; background-color: ${candInfo.color};" title="${candInfo.nombre}: ${v}"></div>`;
            legendHtml += `
                <div class="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                    <div class="w-2 h-2 rounded-full" style="background-color: ${candInfo.color}"></div>
                    <span class="text-slate-400">${displayLabel}</span>
                    <span class="font-bold text-white">${v}</span>
                </div>
            `;
        });
        return { barHtml, legendHtml };
    };

    let dipUI = buildBar(diputados, 130);
    barDiputados.innerHTML = dipUI.barHtml;
    legendDiputados.innerHTML = dipUI.legendHtml;

    let senUI = buildBar(senadores, 24);
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
