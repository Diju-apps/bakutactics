export interface CardData {
    name: string;
    type: string;
    attribute?: string;
    description: string;
    hsp?: string;
    limit?: string;
}

export interface CardAnalysis {
    howItWorks: string;
    whenToUse: string;
    counters: string[];
    vulnerabilities: string[];
}

export function analyzeCard(card: CardData): CardAnalysis {
    const desc = (card.description || "").toLowerCase();
    const name = (card.name || "").toLowerCase();

    let howItWorks = card.description;
    let whenToUse = "Usa esta carta en momentos estratégicos que se alineen con tu plan de juego general.";
    let counters: string[] = [];
    let vulnerabilities: string[] = [];

    // Default Vulnerabilities
    vulnerabilities.push("Puede ser negada por cartas como 'Ability Counter' o negaciones genéricas.");

    // Type based reasoning
    if (card.type.includes("gc")) { // Gate Cards
        vulnerabilities.push("Puede ser destruida por 'Magma Fuse'.");
        vulnerabilities.push("Los efectos de las Cartas Portal pueden ser cancelados por 'Wall Lock'.");
    }

    // Effect based reasoning
    if (desc.includes("niega") || desc.includes("cancela")) {
        whenToUse = "Mantén esta carta en tu mano hasta que el oponente juegue una estrategia crítica o una habilidad de alto poder que amenace tu condición de victoria. Actúa como una carta de triunfo defensiva.";
        counters.push("Cualquier Carta de Habilidad ofensiva fuerte.");
        counters.push("Efectos que cambian atributos o aumentan drásticamente el Poder G.");
    } else if (desc.includes("gana") || desc.includes("+")) {
        whenToUse = "Juégala para inclinar la diferencia de Poder G a tu favor durante una batalla crucial, especialmente cuando estás ligeramente en desventaja y necesitas una ventaja para ganar la Carta Portal.";
        vulnerabilities.push("Cartas que reducen el Poder G a 0 o intercambian el Poder G (ej. 'Final Judgement', 'Supernova').");
    } else if (desc.includes("pierd") || desc.includes("-")) {
        whenToUse = "Úsala para debilitar a los Bakugan de alto nivel del oponente. Muy efectiva contra enemigos con estadísticas abusivas.";
        counters.push("Bakugan oponentes con un Poder G base altísimo.");
        vulnerabilities.push("Cartas que previenen la reducción de Poder G o reflejan efectos.");
    } else if (desc.includes("derrota")) {
        whenToUse = "En situaciones donde el déficit de Poder G es demasiado grande para superarlo por medios normales. Usa condiciones de derrota instantánea para ganar sin importar los puntos.";
        counters.push("Cartas con ventajas abrumadoras de Poder G que se activen primero.");
        vulnerabilities.push("Efectos de resurrección como 'Revive' o 'Androstatis'.");
    } else if (desc.includes("revive")) {
        whenToUse = "Cuando esperas perder una batalla pero quieres preservar tu Bakugan para turnos futuros. Una excelente red de seguridad.";
        counters.push("Efectos de derrota instantánea o 'Doom Card' que previene revivir.");
        vulnerabilities.push("Doom Card desactiva completamente esta estrategia.");
    } else if (desc.includes("cambia") && (desc.includes("atributo") || desc.includes("aquos") || desc.includes("pyrus") || desc.includes("darkus") || desc.includes("haos") || desc.includes("subterra") || desc.includes("ventus"))) {
        whenToUse = "Úsala para interrumpir los bonus específicos de atributo del oponente o para habilitar tus propias habilidades bloqueadas por atributo.";
        counters.push("Cartas Portal de atributo y Habilidades Específicas (ej. Hazard Cards).");
        vulnerabilities.push("Cartas como 'Switchback' desharán completamente este efecto.");
    } else if (desc.includes("intercambia")) {
        whenToUse = "Juégala cuando el oponente mejore enormemente a su Bakugan, volviendo su propio poder en su contra.";
        counters.push("Jugadas del oponente que dependan de ganar por poco Poder G.");
    }

    // Specific Cards (Overrides based on unique cards)
    if (name === "doom card") {
        whenToUse = "Úsala al principio si tu mazo depende de eliminaciones permanentes. Excelente contra equipos que dependen de revivir a sus Bakugan más fuertes.";
        counters.push("Estrategias basadas en revivir (ej. Androstatis).");
        vulnerabilities = ["Cartas que cierran/destruyen Cartas Portal temprano (ej. Magma Fuse)."];
    } else if (name === "wall lock") {
        whenToUse = "Úsala cuando no puedas ganar la batalla bajo las condiciones actuales del campo y necesites limpiar el estado de la partida.";
        counters.push("Todos los aumentos de Poder G y Cartas de Habilidad previas jugadas en la cadena.");
    } else if (name === "magma fuse") {
        whenToUse = "Úsala después de haber asegurado tus propias Cartas Portal, para negar al oponente cualquier ventaja en el campo.";
        counters.push("Cartas Portal Comando cruciales del oponente.");
    } else if (name === "switchback") {
        whenToUse = "Cuando tu atributo ha sido cambiado a la fuerza, bloqueando tus cartas de habilidad.";
        counters.push("Efectos que cambian atributos (Aqua Merge, Hazard cards).");
    } else if (name === "ability counter") {
        whenToUse = "Como jugador de Haos, reserva esto para detener la habilidad más devastadora del oponente que apunte a tu Bakugan o a la Carta Portal.";
    }

    return {
        howItWorks, // will translate description at UI level or leave English if complex, but translating in App is better
        whenToUse,
        counters,
        vulnerabilities
    };
}
