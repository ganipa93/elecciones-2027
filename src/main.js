import { provincias, candidatos, simularProvincia, evaluarBalotaje } from './electoralEngine.js';

const btnStart = document.getElementById('btn-start');
const globalProgressBar = document.getElementById('global-progress-bar');
const globalProgressText = document.getElementById('global-progress-text');
const nationalCharts = document.getElementById('national-charts');
const provTableBody = document.getElementById('prov-table-body');
const statusBadge = document.getElementById('status-badge');
const balotajeModule = document.getElementById('balotaje-module');
const balotajeText = document.getElementById('balotaje-text');
const scenarioSelect = document.getElementById('scenario-select');

let isRunning = false;

// Helpers para colorear las celdas
function hexToRgba(hex, alpha) {
    let r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

async function startSimulation() {
    if (isRunning) return;
    isRunning = true;
    
    // Reset UI
    btnStart.disabled = true;
    btnStart.classList.add('opacity-50', 'cursor-not-allowed');
    btnStart.innerHTML = 'ESCRUTANDO...';
    
    provTableBody.innerHTML = '';
    nationalCharts.innerHTML = '';
    balotajeModule.classList.add('hidden');
    
    let totalPais = { lla: 0, uxp: 0, pro: 0, ucr: 0, hnp: 0, pd: 0, fit: 0, blanco: 0 };
    let pesoAcumulado = 0;
    
    statusBadge.textContent = 'En Progreso...';
    statusBadge.className = 'px-4 py-1.5 rounded-full bg-blue-500/20 text-blue-400 text-sm font-bold border border-blue-500/50 animate-pulse';

    const scenario = scenarioSelect.value;
    let baseAjuste = {};
    if (scenario === 'lla_surge') baseAjuste = { lla: 5 };
    if (scenario === 'uxp_surge') baseAjuste = { uxp: 5 };

    for (let prov of provincias) {
        // Simular latencia de carga de datos (Live mode)
        await new Promise(res => setTimeout(res, 500));
        
        let resProvincia = simularProvincia(prov, baseAjuste);
        
        // Sumar al total nacional ponderado
        Object.keys(resProvincia).forEach(k => {
            totalPais[k] += resProvincia[k] * (prov.peso / 100);
        });
        
        pesoAcumulado += prov.peso;
        
        // Actualizar UI - Progreso
        let pctProgreso = pesoAcumulado.toFixed(2);
        globalProgressText.textContent = `${pctProgreso}%`;
        globalProgressBar.style.width = `${pctProgreso}%`;
        
        // Actualizar UI - Tabla
        let ordenLocal = Object.entries(resProvincia).sort((a,b) => b[1] - a[1]);
        let ganador = ordenLocal[0];
        let segundo = ordenLocal[1];
        let cGanador = candidatos[ganador[0]];
        let cSegundo = candidatos[segundo[0]];
        
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
        // Insert at top to see latest
        provTableBody.prepend(row);
        
        // Actualizar Cartelera Nacional
        renderNationalCharts(totalPais, pesoAcumulado);
    }
    
    // Finalizar
    isRunning = false;
    btnStart.disabled = false;
    btnStart.classList.remove('opacity-50', 'cursor-not-allowed');
    btnStart.innerHTML = 'REINICIAR ESCRUTINIO';
    
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
}

function renderNationalCharts(totalPaisPonderado, pesoTotalAcumulado) {
    // Normalizar respecto al peso escrutado hasta el momento para mostrar % temporales coherentes
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
                         <!-- SVG Striped pattern over the bar for high-tech feel -->
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
