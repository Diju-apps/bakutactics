import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { CardData } from '../utils/cardLogic';
import cardsData from '../data/cards_es.json';
import { getOptimizedImageUrl } from '../utils/imageOptimization';

const getCardImageUrl = (card: CardData) => {
    const type = card.type.toLowerCase();
    const name = card.name.toLowerCase().replace(/[\s,:]+/g, "-");
    let url = '';

    if (["nac", "sac", "cac", "fac", "hac"].includes(type)) {
        url = `https://bloxugan.info/images/${type}/${name}.png`;
    } else if (type === "chgc") {
        const chgcName = name.replace(/-character$/, "");
        url = `https://bloxugan.info/images/gc/chgc/${chgcName}.png`;
    } else if (["agc", "cogc"].includes(type)) {
        url = `https://bloxugan.info/images/gc/${type}.png`;
    } else {
        url = `https://bloxugan.info/images/card-back.png`;
    }

    // Para la tierlist usamos miniaturas mucho más pequeñas (120px) y calidad 30
    return getOptimizedImageUrl(url, 120, 30);
};

const getTypeName = (type: string) => {
    switch (type) {
        case 'agc': return 'Portal de Atributo';
        case 'cogc': return 'Portal Comando';
        case 'chgc': return 'Portal de Personaje';
        case 'nac': return 'Habilidad Normal';
        case 'sac': return 'Habilidad Especial';
        case 'fac': return 'Habilidad de Fusión';
        case 'cac': return 'Habilidad de Comando';
        case 'hac': return 'Habilidad de Héroe';
        default: return type.toUpperCase();
    }
};

const getTierColor = (pickRatio: number) => {
    if (pickRatio >= 30) return '#FF4D4D'; // S Tier - Red
    if (pickRatio >= 15) return '#FFB84D'; // A Tier - Orange
    if (pickRatio >= 8) return '#2ecc71';  // B Tier - Green
    if (pickRatio >= 3) return '#3498db';  // C Tier - Blue
    return '#95a5a6';                        // D Tier - Gray
};

const getTierLetter = (pickRatio: number) => {
    if (pickRatio >= 30) return 'S';
    if (pickRatio >= 15) return 'A';
    if (pickRatio >= 8) return 'B';
    if (pickRatio >= 3) return 'C';
    return 'D';
};

export default function CardTierlist({ onCardClick }: { onCardClick: (card: CardData) => void }) {
    const [loading, setLoading] = useState(true);
    const [tierlist, setTierlist] = useState<{ card: CardData, pickRatio: number, totalPicks: number }[]>([]);
    const [totalAnalyzedDecks, setTotalAnalyzedDecks] = useState(0);
    const [visibleCount, setVisibleCount] = useState(10);

    useEffect(() => {
        const loadTierlist = async () => {
            setLoading(true);
            try {
                const querySnapshot = await getDocs(collection(db, "user_decks"));
                let totalDecks = 0;

                // Track how many decks each card appears in
                const cardDeckCounts: Record<string, number> = {};

                querySnapshot.forEach((docSnapshot) => {
                    const data = docSnapshot.data();
                    if (data.decks) {
                        data.decks.forEach((deck: any) => {
                            totalDecks++;
                            // Create a set of unique cards in this deck so we count 1 per deck max
                            const uniqueCardsInDeck = new Set<string>();

                            (deck.attributeGates || []).forEach((c: string) => uniqueCardsInDeck.add(c));
                            (deck.commandGates || []).forEach((c: string) => uniqueCardsInDeck.add(c));
                            (deck.characterGates || []).forEach((c: string) => uniqueCardsInDeck.add(c));
                            (deck.abilities || []).forEach((c: string) => uniqueCardsInDeck.add(c));

                            uniqueCardsInDeck.forEach(cardName => {
                                cardDeckCounts[cardName] = (cardDeckCounts[cardName] || 0) + 1;
                            });
                        });
                    }
                });

                setTotalAnalyzedDecks(totalDecks);

                if (totalDecks > 0) {
                    const sortedList = (cardsData as CardData[])
                        .map(card => {
                            const count = cardDeckCounts[card.name] || 0;
                            return {
                                card,
                                totalPicks: count,
                                pickRatio: (count / totalDecks) * 100
                            };
                        })
                        .filter(item => item.totalPicks > 0)
                        .sort((a, b) => b.pickRatio - a.pickRatio); // Sort descending

                    setTierlist(sortedList);
                }
            } catch (e) {
                console.error("Error loading tierlist:", e);
            }
            setLoading(false);
        };

        loadTierlist();
    }, []);

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>Analizando todos los mazos para calcular la Tierlist...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '4rem' }}>
            <section className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 800 }}>Tierlist de Cartas</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '0', fontSize: '1.1rem', maxWidth: '700px' }}>
                    Clasificación de las cartas de Bloxugan basada en su popularidad real. Hemos analizado <strong style={{ color: '#fff' }}>{totalAnalyzedDecks} mazos</strong> creados por la comunidad (públicos y privados). El <strong>Pick Ratio</strong> indica el porcentaje de los mazos que incluyen al menos una copia de la carta.
                </p>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                    {['S', 'A', 'B', 'C', 'D'].map((t, i) => (
                        <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                            <span style={{ display: 'inline-block', width: '20px', height: '20px', borderRadius: '4px', background: getTierColor(i === 0 ? 30 : i === 1 ? 15 : i === 2 ? 8 : i === 3 ? 3 : 0), color: '#111', fontWeight: 'bold', textAlign: 'center', lineHeight: '20px' }}>{t}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{i === 0 ? '+30%' : i === 1 ? '+15%' : i === 2 ? '+8%' : i === 3 ? '+3%' : '<3%'}</span>
                        </div>
                    ))}
                </div>
            </section>

            {tierlist.length === 0 ? (
                <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>No hay suficientes datos de mazos para mostrar una tierlist todavía.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {tierlist.slice(0, visibleCount).map((item, index) => {
                        const tierColor = getTierColor(item.pickRatio);
                        const tierLetter = getTierLetter(item.pickRatio);

                        return (
                            <div
                                key={item.card.name}
                                className="glass-panel"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1.5rem',
                                    padding: '1rem',
                                    borderLeft: `4px solid ${tierColor}`,
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                                onClick={() => onCardClick(item.card)}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                            >
                                {/* Background faint pick ratio bar */}
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${item.pickRatio}%`, background: `${tierColor}`, opacity: 0.1, pointerEvents: 'none' }}></div>

                                {/* Rank & Tier */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '50px', flexShrink: 0 }}>
                                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>#{index + 1}</span>
                                    <span style={{ fontSize: '1.4rem', fontWeight: 900, color: tierColor, textShadow: `0 0 10px ${tierColor}60` }}>{tierLetter}</span>
                                </div>

                                {/* Image thumbnail */}
                                <img
                                    src={getCardImageUrl(item.card)}
                                    alt={item.card.name}
                                    style={{ width: '60px', height: 'auto', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
                                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://bloxugan.info/images/card-back.png' }}
                                />

                                {/* Name & Type */}
                                <div style={{ flex: 1, minWidth: '150px' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{item.card.name}</h3>
                                    <span className={`card-badge type-${item.card.type}`} style={{ display: 'inline-block', marginTop: '0.4rem', fontSize: '0.75rem' }}>
                                        {getTypeName(item.card.type)}
                                    </span>
                                </div>

                                {/* Pick Ratio Stats */}
                                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: '100px' }}>
                                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: tierColor }}>{item.pickRatio.toFixed(1)}%</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Picks: <strong>{item.totalPicks}</strong> mazos</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {tierlist.length > visibleCount && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem' }}>
                    <button 
                        className="btn-primary" 
                        onClick={() => setVisibleCount(prev => prev + 20)}
                        style={{ padding: '0.8rem 2rem', fontSize: '1rem', fontWeight: 'bold' }}
                    >
                        Ver más cartas ({tierlist.length - visibleCount} restantes)
                    </button>
                </div>
            )}
        </div>
    );
}
