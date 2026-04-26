// electoralEngine.js
// Padrón electoral actualizado ~2025/2026 (% del padrón nacional)
export const provincias = [
    { id: "pba", n: "Buenos Aires", peso: 37.04, escanos: 70, gridCoords: { row: 5, col: 3 }, sesgo: { uxp: 8, lla: -2, fit: 2 } },
    { id: "caba", n: "CABA", peso: 7.16, escanos: 25, gridCoords: { row: 4, col: 3 }, sesgo: { lla: 5, pd: 10, uxp: -5 } },
    { id: "cba", n: "Córdoba", peso: 8.66, escanos: 18, gridCoords: { row: 4, col: 2 }, sesgo: { lla: 12, uxp: -15, pd: 5 } },
    { id: "sfe", n: "Santa Fe", peso: 7.96, escanos: 19, gridCoords: { row: 4, col: 4 }, sesgo: { lla: 7, uxp: -5, pd: 5 } },
    { id: "mza", n: "Mendoza", peso: 4.25, escanos: 10, gridCoords: { row: 5, col: 1 }, sesgo: { lla: 10, uxp: -10 } },
    { id: "tuc", n: "Tucumán", peso: 3.73, escanos: 9, gridCoords: { row: 2, col: 2 }, sesgo: { uxp: 10, lla: -2 } },
    { id: "er", n: "Entre Ríos", peso: 3.24, escanos: 9, gridCoords: { row: 5, col: 4 }, sesgo: { pd: 5, lla: 2 } },
    { id: "sal", n: "Salta", peso: 3.18, escanos: 7, gridCoords: { row: 1, col: 2 }, sesgo: { uxp: 5, lla: 5 } },
    { id: "cha", n: "Chaco", peso: 2.83, escanos: 7, gridCoords: { row: 2, col: 4 }, sesgo: { uxp: 6 } },
    { id: "mis", n: "Misiones", peso: 2.77, escanos: 7, gridCoords: { row: 3, col: 5 }, sesgo: { uxp: 5, lla: 5 } },
    { id: "cor", n: "Corrientes", peso: 2.69, escanos: 7, gridCoords: { row: 3, col: 4 }, sesgo: { pd: 8 } },
    { id: "sde", n: "Sgo. del Estero", peso: 2.29, escanos: 7, gridCoords: { row: 3, col: 3 }, sesgo: { uxp: 30 } },
    { id: "sjn", n: "San Juan", peso: 1.71, escanos: 6, gridCoords: { row: 4, col: 1 }, sesgo: { lla: 4 } },
    { id: "juj", n: "Jujuy", peso: 1.67, escanos: 6, gridCoords: { row: 1, col: 1 }, sesgo: { uxp: -5, lla: 5 } },
    { id: "rn", n: "Río Negro", peso: 1.63, escanos: 5, gridCoords: { row: 7, col: 2 }, sesgo: { uxp: 4, fit: 3 } },
    { id: "neu", n: "Neuquén", peso: 1.56, escanos: 5, gridCoords: { row: 6, col: 1 }, sesgo: { lla: 8, fit: 4 } },
    { id: "for", n: "Formosa", peso: 1.38, escanos: 5, gridCoords: { row: 1, col: 4 }, sesgo: { uxp: 25 } },
    { id: "chu", n: "Chubut", peso: 1.31, escanos: 5, gridCoords: { row: 8, col: 1 }, sesgo: { lla: 6 } },
    { id: "sl", n: "San Luis", peso: 1.19, escanos: 5, gridCoords: { row: 5, col: 2 }, sesgo: { lla: 12 } },
    { id: "cat", n: "Catamarca", peso: 0.96, escanos: 5, gridCoords: { row: 3, col: 2 }, sesgo: { uxp: 10 } },
    { id: "lr", n: "La Rioja", peso: 0.86, escanos: 5, gridCoords: { row: 3, col: 1 }, sesgo: { uxp: 5, lla: 5 } },
    { id: "lp", n: "La Pampa", peso: 0.85, escanos: 5, gridCoords: { row: 6, col: 2 }, sesgo: { uxp: 2 } },
    { id: "sc", n: "Santa Cruz", peso: 0.75, escanos: 5, gridCoords: { row: 9, col: 1 }, sesgo: { uxp: 5, fit: 5 } },
    { id: "tf", n: "Tierra del Fuego", peso: 0.42, escanos: 5, gridCoords: { row: 10, col: 2 }, sesgo: { uxp: 10, fit: 5 } }
];

export const candidatos = {
    lla: { id: 'lla', nombre: 'J. Milei', color: '#7a3e9d' },
    uxp: { id: 'uxp', nombre: 'A. Kicillof', color: '#00a4e4' },
    pro: { id: 'pro', nombre: 'M. Macri', color: '#ffd700' },
    ucr: { id: 'ucr', nombre: 'M. Lousteau', color: '#c1121f' },
    hnp: { id: 'hnp', nombre: 'M. Llaryora', color: '#023e8a' },
    pd: { id: 'pd', nombre: 'V. Villarruel', color: '#1b263b' },
    fit: { id: 'fit', nombre: 'M. Bregman', color: '#e51a2d' },
    blanco: { id: 'blanco', nombre: 'Voto Blanco', color: '#999999' }
};

// Genera un resultado aleatorio para una provincia dada
export function simularProvincia(provincia, baseAjuste = {}, turnout = 80) {
    // Penalización por baja participación (afecta a aparatos tradicionales UXP/UCR)
    let turnoutMalus = 0;
    if (turnout < 70) {
        turnoutMalus = (70 - turnout) * 0.2; // Hasta -4% si hay 50% de turnout
    }

    let v = {
        lla: 28 + (provincia.sesgo.lla || 0) + (Math.random() * 8 - 4) + (baseAjuste.lla || 0),
        uxp: 26 + (provincia.sesgo.uxp || 0) + (Math.random() * 8 - 4) + (baseAjuste.uxp || 0) - turnoutMalus,
        pro: 14 + (provincia.sesgo.pro || 0) + (Math.random() * 6 - 3) + (baseAjuste.pro || 0),
        ucr: 8 + (provincia.sesgo.ucr || 0) + (Math.random() * 4 - 2) + (baseAjuste.ucr || 0) - turnoutMalus,
        hnp: 6 + (provincia.sesgo.pj || provincia.sesgo.hnp || 0) + (Math.random() * 4 - 2) + (baseAjuste.hnp || 0),
        pd: 6 + (provincia.sesgo.pd || 0) + (Math.random() * 4 - 2) + (baseAjuste.pd || 0),
        fit: 4 + (provincia.sesgo.fit || 0) + (Math.random() * 2 - 1) + (baseAjuste.fit || 0),
        blanco: 4 + (Math.random() * 2 - 1) + (turnoutMalus * 1.5) // Baja participación aumenta voto blanco
    };

    // Asegurar no negativos
    Object.keys(v).forEach(k => v[k] = Math.max(0, v[k]));

    // Normalizar a 100% sobre los emitidos
    let suma = Object.values(v).reduce((a, b) => a + b);
    Object.keys(v).forEach(k => v[k] = (v[k] / suma) * 100);

    return v;
}

export function evaluarBalotaje(resultadosNacionales) {
    // Calculamos el % de votos afirmativos validos (sin blancos)
    let totalAfirmativo = resultadosNacionales.lla + resultadosNacionales.uxp + resultadosNacionales.pro + resultadosNacionales.ucr + resultadosNacionales.hnp + resultadosNacionales.pd + resultadosNacionales.fit;
    
    let porcentajesAfirmativos = {
        lla: (resultadosNacionales.lla / totalAfirmativo) * 100,
        uxp: (resultadosNacionales.uxp / totalAfirmativo) * 100,
        pro: (resultadosNacionales.pro / totalAfirmativo) * 100,
        ucr: (resultadosNacionales.ucr / totalAfirmativo) * 100,
        hnp: (resultadosNacionales.hnp / totalAfirmativo) * 100,
        pd: (resultadosNacionales.pd / totalAfirmativo) * 100,
        fit: (resultadosNacionales.fit / totalAfirmativo) * 100
    };

    // Ordenar de mayor a menor
    let orden = Object.entries(porcentajesAfirmativos).sort((a,b) => b[1] - a[1]);
    let primero = orden[0];
    let segundo = orden[1];

    let ganaPrimeraVuelta = false;
    let razon = "Habrá Balotaje.";

    if (primero[1] >= 45) {
        ganaPrimeraVuelta = true;
        razon = `Victoria en 1ra vuelta: ${candidatos[primero[0]].nombre} superó el 45% de los afirmativos (${primero[1].toFixed(2)}%).`;
    } else if (primero[1] >= 40 && (primero[1] - segundo[1]) > 10) {
        ganaPrimeraVuelta = true;
        razon = `Victoria en 1ra vuelta: ${candidatos[primero[0]].nombre} superó el 40% y le sacó >10% al segundo (${primero[1].toFixed(2)}% vs ${segundo[1].toFixed(2)}%).`;
    } else {
        razon = `Habrá Balotaje entre ${candidatos[primero[0]].nombre} y ${candidatos[segundo[0]].nombre}. Nadie superó el 45% o el 40% con >10% de diferencia.`;
    }

    return { ganaPrimeraVuelta, razon, primero, segundo, porcentajesAfirmativos };
}

// Algoritmo D'Hondt para repartir bancas
export function calcularDHondt(resultadosProvincia, bancasTotales) {
    let escanos = { lla: 0, uxp: 0, pro: 0, ucr: 0, hnp: 0, pd: 0, fit: 0 };
    // Filtrar blanco
    let afirmativos = { ...resultadosProvincia };
    delete afirmativos.blanco;

    // Piso del 3% del padron requerido por ley, lo simplificamos a 3% de los emitidos para la simulación
    Object.keys(afirmativos).forEach(k => {
        if (afirmativos[k] < 3) afirmativos[k] = 0;
    });

    let tabla = [];
    Object.keys(afirmativos).forEach(partido => {
        if (afirmativos[partido] > 0) {
            for (let divisor = 1; divisor <= bancasTotales; divisor++) {
                tabla.push({
                    partido: partido,
                    cociente: afirmativos[partido] / divisor
                });
            }
        }
    });

    // Ordenar de mayor a menor y asignar
    tabla.sort((a, b) => b.cociente - a.cociente);
    
    for (let i = 0; i < bancasTotales; i++) {
        if (tabla[i]) {
            escanos[tabla[i].partido]++;
        }
    }

    return escanos;
}

export function calcularSenadores(resultadosProvincia) {
    let escanos = { lla: 0, uxp: 0, pro: 0, ucr: 0, hnp: 0, pd: 0, fit: 0 };
    let afirmativos = { ...resultadosProvincia };
    delete afirmativos.blanco;

    let orden = Object.entries(afirmativos).sort((a,b) => b[1] - a[1]);
    
    // 2 para el ganador
    if (orden[0]) escanos[orden[0][0]] += 2;
    // 1 para el segundo
    if (orden[1]) escanos[orden[1][0]] += 1;

    return escanos;
}
