import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import cardsData from '../data/cards_es.json';
import { Plus, Save, Trash2, Edit2, Search, X, ArrowLeft, Globe, Lock } from 'lucide-react';
import type { CardData } from '../utils/cardLogic';
import { getOptimizedImageUrl, getOptimizedThumbnailUrl, usePreloadImages } from '../utils/imageOptimization';

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

    return getOptimizedImageUrl(url, 300);
};

interface Bakugan {
    name: string;
    attribute: string;
    gpower: number | '';
    imageUrl?: string;
    tier?: string;
}

interface Deck {
    id: string;
    name: string;
    bakugans: Bakugan[];
    attributeGates: string[]; // Card Names
    commandGates: string[];
    characterGates: string[];
    abilities: string[]; // Normal or Special
    isPublic?: boolean;
    description?: string;
}

interface Props {
    currentUser: string | null;
    onCardClick?: (card: CardData) => void;
}

const LazyImage = ({ src, alt, style, onError }: any) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(!src);

    return (
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', width: style?.width || '100%', height: style?.height || '100%', borderRadius: style?.borderRadius, marginBottom: style?.marginBottom, border: style?.border, flexShrink: 0, overflow: 'hidden' }}>
            {hasError ? (
                <div style={{ width: '100%', height: '100%', backgroundColor: '#1F2937', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'rgba(255,255,255,0.4)', padding: '0.5rem', textAlign: 'center', borderRadius: style?.borderRadius || '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Imagen no<br/>disponible</span>
                </div>
            ) : (
                <>
                    {!isLoaded && (
                        <div className="animate-pulse" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: style?.borderRadius || '8px', zIndex: 1 }} />
                    )}
                    <img 
                        src={src} 
                        alt={alt} 
                        style={{ width: '100%', height: '100%', objectFit: style?.objectFit, borderRadius: style?.borderRadius, opacity: isLoaded ? 1 : 0, transition: 'opacity 300ms ease-in-out' }}
                        loading="lazy"
                        decoding="async"
                        onLoad={() => setIsLoaded(true)}
                        onError={(e) => {
                            setIsLoaded(true);
                            setHasError(true);
                            if (onError) onError(e);
                        }}
                    />
                </>
            )}
        </div>
    );
};


export default function DeckBuilder({ currentUser, onCardClick }: Props) {
    const [decks, setDecks] = useState<Deck[]>([]);
    const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
    const [viewingDeck, setViewingDeck] = useState<Deck | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewState, setViewState] = useState<'list' | 'editing'>('list'); // Added viewState

    // Card selector states
    const [cardSearch, setCardSearch] = useState('');
    const [cardFilterAttr, setCardFilterAttr] = useState('Todos');
    const [selectorType, setSelectorType] = useState<'attribute' | 'command' | 'character' | 'ability' | 'bakugan' | 'gate' | null>(null); // Added 'bakugan' and 'gate'
    const [selectedCardForQuantity, setSelectedCardForQuantity] = useState<{ card: CardData, max: number } | null>(null);
    const [quantityToAdd, setQuantityToAdd] = useState(1);

    const [loadedBloxugans, setLoadedBloxugans] = useState<any[]>([]);
    const [selectingBakuganSlot, setSelectingBakuganSlot] = useState<number | null>(null);

    // Filters for Bakugans Modal
    const [bakuganFilterSearch, setBakuganFilterSearch] = useState('');
    const [bakuganFilterAttr, setBakuganFilterAttr] = useState('Todos');
    const [bakuganFilterTier, setBakuganFilterTier] = useState('Todos');

    // Prepare URLs for silent pre-fetch
    const allCardUrlsToPreload = useMemo(() => {
        return (cardsData as CardData[]).map(card => getOptimizedThumbnailUrl(getCardImageUrl(card)));
    }, []);

    const allBakuganUrlsToPreload = useMemo(() => {
        return loadedBloxugans.map(b => b.image ? getOptimizedThumbnailUrl(b.image) : '').filter(url => url !== '');
    }, [loadedBloxugans]);

    // Lanza la pre-carga en segundo plano apenas se abre el componente o se cargan los Bakugans
    usePreloadImages(allCardUrlsToPreload);
    usePreloadImages(allBakuganUrlsToPreload);

    const getCardDescription = (name: string) => {
        const card = (cardsData as CardData[]).find(c => c.name === name);
        return card ? card.description : '';
    };

    useEffect(() => {
        if (currentUser) {
            loadUserDecks(currentUser);
        } else {
            const localDecks = localStorage.getItem('local_decks');
            setDecks(localDecks ? JSON.parse(localDecks) : []);
            setLoading(false);
        }

        const fetchBaks = async () => {
            if (loadedBloxugans.length > 0) return;
            try {
                const snap = await getDocs(collection(db, 'bloxugans'));
                const baks: any[] = [];
                snap.forEach(d => baks.push({ id: d.id, ...d.data() }));
                baks.sort((a, b) => a.name.localeCompare(b.name));
                setLoadedBloxugans(baks);
            } catch (e) { console.error(e) }
        };
        fetchBaks();
    }, [currentUser]);

    const loadUserDecks = async (user: string) => {
        setLoading(true);
        try {
            const docRef = doc(db, 'user_decks', user.toLowerCase());
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().decks) {
                setDecks(docSnap.data().decks);
            } else {
                setDecks([]);
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const saveDeckToDB = async (updatedDecks: Deck[]) => {
        setDecks(updatedDecks);
        if (currentUser) {
            try {
                const docRef = doc(db, 'user_decks', currentUser.toLowerCase());
                await setDoc(docRef, { decks: updatedDecks }, { merge: true });
            } catch (e) {
                console.error(e);
            }
        } else {
            localStorage.setItem('local_decks', JSON.stringify(updatedDecks));
        }
    };

    const createNewDeck = () => {
        const newDeck: Deck = {
            id: Date.now().toString(),
            name: 'Nuevo Mazo de Bloxugan',
            bakugans: [
                { name: '', attribute: 'Pyrus', gpower: '' },
                { name: '', attribute: 'Pyrus', gpower: '' },
                { name: '', attribute: 'Pyrus', gpower: '' },
            ],
            attributeGates: [],
            commandGates: [],
            characterGates: [],
            abilities: [],
            isPublic: false,
            description: '',
        };
        setEditingDeck(newDeck);
        setViewState('editing'); // Set viewState to editing
    };

    const saveEditingDeck = () => {
        if (!editingDeck) return;
        const existingIndex = decks.findIndex(d => d.id === editingDeck.id);
        let updated: Deck[];
        if (existingIndex >= 0) {
            updated = [...decks];
            updated[existingIndex] = editingDeck;
        } else {
            updated = [...decks, editingDeck];
        }
        saveDeckToDB(updated);
        setEditingDeck(null);
        setViewState('list'); // Return to list view
    };

    const deleteDeck = (id: string) => {
        if (window.confirm('¿Seguro que deseas eliminar este mazo?')) {
            const updated = decks.filter(d => d.id !== id);
            saveDeckToDB(updated);
        }
    };



    const removeCard = (type: 'attributeGates' | 'commandGates' | 'characterGates' | 'abilities', name: string) => {
        if (!editingDeck) return;
        const list = [...editingDeck[type]];
        const i = list.indexOf(name);
        if (i > -1) list.splice(i, 1);
        setEditingDeck({ ...editingDeck, [type]: list });
    };

    // Placeholder for removeBakugan and updateBgpower
    const removeBakugan = (index: number) => {
        if (!editingDeck) return;
        const updatedBakugans = editingDeck.bakugans.map((b, i) => i === index ? { name: '', attribute: 'Pyrus', gpower: '' as "" | number } : b);
        setEditingDeck({ ...editingDeck, bakugans: updatedBakugans });
    };

    const handleLoadedBakuganSelect = (index: number, b: any) => {
        if (!editingDeck) return;
        const buks = [...editingDeck.bakugans];
        buks[index] = { 
            name: b.name, 
            attribute: b.attribute, 
            gpower: b.poderG || 0,
            imageUrl: b.image,
            tier: b.tier || 'A'
        };
        setEditingDeck({ ...editingDeck, bakugans: buks });
    };

    const handleSelectCard = (card: CardData) => {
        if (!editingDeck || !selectorType) return;

        let targetList: 'attributeGates' | 'commandGates' | 'characterGates' | 'abilities';
        let max = 0;
        const cType = card.type.toLowerCase();

        if (selectorType === 'attribute' || (selectorType === 'gate' && cType === 'agc')) { targetList = 'attributeGates'; max = 2; }
        else if (selectorType === 'command' || (selectorType === 'gate' && cType === 'cogc')) { targetList = 'commandGates'; max = 2; }
        else if (selectorType === 'character' || (selectorType === 'gate' && cType === 'chgc')) { targetList = 'characterGates'; max = 2; }
        else { targetList = 'abilities'; max = 10; }

        const list = [...editingDeck[targetList]];

        const existingCopies = list.filter(n => n === card.name).length;
        const availableSlots = max - list.length;
        const cardLimit = Number(card.limit) || 3;
        const remainingLimit = cardLimit - existingCopies;

        const absoluteMaxToAdd = Math.min(availableSlots, remainingLimit);

        if (absoluteMaxToAdd <= 0) {
            if (remainingLimit <= 0) {
                alert(`Has alcanzado el límite de copias permitidas para la carta "${card.name}" (${cardLimit}).`);
            } else {
                alert(`Límite de categoría alcanzado (Máximo ${max}).`);
            }
            return;
        }

        if (absoluteMaxToAdd > 1) {
            setSelectedCardForQuantity({ card, max: absoluteMaxToAdd });
            setQuantityToAdd(1);
        } else {
            finalizeAddCard(card, 1, targetList);
        }
    };

    const finalizeAddCard = (card: CardData, quantity: number, targetList: 'attributeGates' | 'commandGates' | 'characterGates' | 'abilities') => {
        if (!editingDeck) return;
        const list = [...editingDeck[targetList]];
        for (let i = 0; i < quantity; i++) {
            list.push(card.name);
        }
        setEditingDeck({ ...editingDeck, [targetList]: list });
        setSelectedCardForQuantity(null);
        setSelectorType(null); // Close selector
        setCardSearch('');
    };

    const renderCardSelector = () => {
        if (!selectorType) return null;

        // Filter database
        const allCards = cardsData as CardData[];
        const filtered = allCards.filter(c => {
            if (!c || !c.type || !c.name) return false;

            // Type matching
            let isCorrectType = false;
            const t = c.type.toLowerCase();

            if (selectorType === 'attribute' && t === 'agc') isCorrectType = true;
            if (selectorType === 'command' && t === 'cogc') isCorrectType = true;
            if (selectorType === 'character' && t === 'chgc') isCorrectType = true;
            if (selectorType === 'ability' && ['nac', 'sac', 'cac', 'fac', 'hac'].includes(t)) isCorrectType = true;
            // For 'gate' selector, it should include all gate types
            if (selectorType === 'gate' && (t === 'agc' || t === 'cogc' || t === 'chgc')) isCorrectType = true;
            // For 'bakugan' selector, this component doesn't handle Bakugan selection directly from cardsData,
            // but if it were to, it would need a specific type. For now, we'll assume it's handled elsewhere or is a placeholder.
            if (selectorType === 'bakugan') { /* Logic for bakugan selection if needed */ }


            // Search matching
            const matchesSearch = c.name.toLowerCase().includes(cardSearch.toLowerCase());

            let matchAttr = true;
            if (cardFilterAttr !== 'Todos') {
                matchAttr = c.name.toLowerCase().includes(cardFilterAttr.toLowerCase());
            }

            return isCorrectType && matchesSearch && matchAttr;
        });

        return (
            <div className="modal-overlay" onClick={() => { setSelectorType(null); setSelectedCardForQuantity(null); setCardFilterAttr('Todos'); }} style={{ zIndex: 10001 }}>
                <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: '#111116', border: '1px solid var(--accent-color)', borderRadius: '16px', padding: '2rem', maxWidth: '600px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                    {selectedCardForQuantity ? (
                        <div style={{ padding: '1rem', textAlign: 'center' }}>
                            <h2 style={{ marginBottom: '1rem', color: 'var(--accent-color)' }}>{selectedCardForQuantity.card.name}</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>¿Cuántas copias deseas agregar? (Límite: {selectedCardForQuantity.max})</p>

                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem', userSelect: 'none' }}>
                                <button className="btn-secondary" style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setQuantityToAdd(Math.max(1, quantityToAdd - 1))}>-</button>
                                <span style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{quantityToAdd}</span>
                                <button className="btn-secondary" style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setQuantityToAdd(Math.min(selectedCardForQuantity.max, quantityToAdd + 1))}>+</button>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                <button className="btn-secondary" onClick={() => setSelectedCardForQuantity(null)}>Volver</button>
                                <button className="btn-primary" onClick={() => {
                                    let targetList: 'attributeGates' | 'commandGates' | 'characterGates' | 'abilities';
                                    if (selectorType === 'attribute' || (selectorType === 'gate' && selectedCardForQuantity.card.type.toLowerCase() === 'agc')) {
                                        targetList = 'attributeGates';
                                    } else if (selectorType === 'command' || (selectorType === 'gate' && selectedCardForQuantity.card.type.toLowerCase() === 'cogc')) {
                                        targetList = 'commandGates';
                                    } else if (selectorType === 'character' || (selectorType === 'gate' && selectedCardForQuantity.card.type.toLowerCase() === 'chgc')) {
                                        targetList = 'characterGates';
                                    } else {
                                        targetList = 'abilities';
                                    }
                                    finalizeAddCard(selectedCardForQuantity.card, quantityToAdd, targetList);
                                }}>Aceptar</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h2>Seleccionar Carta</h2>
                            <div className="search-container" style={{ position: 'relative', marginTop: '1rem', marginBottom: '1rem' }}>
                                <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input
                                    type="text"
                                    className="search-bar"
                                    placeholder="Buscar..."
                                    value={cardSearch}
                                    onChange={(e) => setCardSearch(e.target.value)}
                                    style={{ paddingLeft: '3rem', width: '100%', marginBottom: 0 }}
                                />
                            </div>

                            {(selectorType === 'attribute' || selectorType === 'ability') && (
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem', justifyContent: 'center' }}>
                                    {['Todos', 'Pyrus', 'Aquos', 'Ventus', 'Subterra', 'Haos', 'Darkus'].map(attr => (
                                        <button
                                            key={attr}
                                            onClick={() => setCardFilterAttr(attr)}
                                            style={{
                                                padding: '0.4rem 0.8rem',
                                                borderRadius: '20px',
                                                border: cardFilterAttr === attr ? '2px solid var(--accent-color)' : '1px solid rgba(255,255,255,0.1)',
                                                background: cardFilterAttr === attr ? 'rgba(123, 97, 255, 0.2)' : 'rgba(0,0,0,0.3)',
                                                color: cardFilterAttr === attr ? '#fff' : 'var(--text-secondary)',
                                                fontSize: '0.85rem',
                                                fontWeight: cardFilterAttr === attr ? 'bold' : 'normal',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                            }}
                                            className={attr !== 'Todos' ? `attr-${attr.toLowerCase()}` : ''}
                                        >
                                            {attr}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', paddingRight: '0.5rem' }}>
                                {filtered.slice(0, 30).map((card, idx) => {
                                    let gradient = 'linear-gradient(135deg, rgba(30,30,40,0.8), rgba(20,20,28,0.8))';
                                    const n = card.name.toLowerCase();
                                    if (n.includes('pyrus')) gradient = 'linear-gradient(135deg, rgba(220,38,38,0.3), rgba(20,20,28,0.8))';
                                    else if (n.includes('aquos')) gradient = 'linear-gradient(135deg, rgba(37,99,235,0.3), rgba(20,20,28,0.8))';
                                    else if (n.includes('ventus')) gradient = 'linear-gradient(135deg, rgba(5,150,105,0.3), rgba(20,20,28,0.8))';
                                    else if (n.includes('subterra')) gradient = 'linear-gradient(135deg, rgba(180,83,9,0.3), rgba(20,20,28,0.8))';
                                    else if (n.includes('haos')) gradient = 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(20,20,28,0.8))';
                                    else if (n.includes('darkus')) gradient = 'linear-gradient(135deg, rgba(126,34,206,0.3), rgba(20,20,28,0.8))';

                                    return (
                                        <div 
                                            key={idx} 
                                            className="relative overflow-hidden h-40 rounded-lg cursor-pointer transition-all duration-200"
                                            style={{ 
                                                position: 'relative',
                                                overflow: 'hidden',
                                                height: '10rem',
                                                borderRadius: '0.5rem',
                                                border: '2px solid transparent',
                                                background: gradient,
                                                boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                                            }}
                                            onClick={() => handleSelectCard(card)}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                        >
                                            <div className="absolute inset-0 w-full h-full" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' }}>
                                                <LazyImage 
                                                    src={getCardImageUrl(card)} 
                                                    alt={card.name} 
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                />
                                            </div>
                                            
                                            <div className="absolute bottom-0 w-full bg-black/90 text-white text-xs text-center py-1.5 font-bold z-10" style={{ position: 'absolute', bottom: 0, width: '100%', background: 'rgba(0,0,0,0.9)', color: 'white', fontSize: '0.75rem', textAlign: 'center', padding: '0.375rem 0', fontWeight: 'bold', zIndex: 10, backdropFilter: 'blur(4px)', borderTop: '1px solid rgba(255,255,255,0.1)', lineHeight: 1.2 }}>
                                                {card.name}
                                            </div>
                                        </div>
                                    )
                                })}
                                {filtered.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', gridColumn: '1 / -1', marginTop: '1rem' }}>No se encontraron cartas.</p>}
                            </div>
                            <button className="btn-secondary" style={{ marginTop: '1.5rem' }} onClick={() => { setSelectorType(null); setCardFilterAttr('Todos'); }}>Cancelar</button>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const renderDeckViewer = () => {
        if (!viewingDeck) return null;

        const allGates = [...viewingDeck.attributeGates, ...viewingDeck.commandGates, ...viewingDeck.characterGates];

        return (
            <div className="modal-overlay" onClick={() => setViewingDeck(null)} style={{ zIndex: 10001, padding: '2rem' }}>
                <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ background: '#111116', border: '1px solid var(--accent-color)', borderRadius: '16px', padding: 0, maxWidth: '1000px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                    {/* Header Pinned */}
                    <div style={{ padding: '2rem 2rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                        <button className="modal-close" onClick={() => setViewingDeck(null)}><X size={24} /></button>
                        <h2 style={{ margin: 0, textAlign: 'center', color: 'var(--accent-color)', fontSize: '2rem' }}>{viewingDeck.name || 'Mazo sin nombre'}</h2>
                        {viewingDeck.description && (
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', marginTop: '1rem', borderLeft: '3px solid var(--accent-color)' }}>
                                <h4 style={{ color: 'var(--accent-color)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Estrategia del Mazo</h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0, lineHeight: 1.5 }}>
                                    {viewingDeck.description}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Scrollable Content Container */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem 2rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                        {/* Bakugans */}

                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Bakugans ({viewingDeck.bakugans.filter(b => b.name).length}/3)</h3>
                            <div className="deck-baku-grid">
                                {viewingDeck.bakugans.map((bk, i) => bk.name && (
                                    <div key={i} className="glass-panel" style={{ padding: '1rem', borderRadius: '12px', textAlign: 'center', background: 'linear-gradient(145deg, rgba(20,20,28,0.8) 0%, rgba(30,30,40,0.8) 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        {bk.imageUrl && (
                                            <img src={getOptimizedImageUrl(bk.imageUrl, 200)} alt={bk.name} className="w-20 h-20 object-cover rounded-md mx-auto mb-2" style={{ width: '5rem', height: '5rem', objectFit: 'cover', borderRadius: '0.375rem', margin: '0 auto 0.5rem auto' }} />
                                        )}
                                        <div style={{ fontWeight: '800', fontSize: '1.2rem', marginBottom: '0.2rem' }}>{bk.name}</div>
                                        <div className={`attr-${bk.attribute.toLowerCase()}`} style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>{bk.attribute.toUpperCase()}</div>
                                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.4rem', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold' }}>{bk.gpower || 0} G</div>
                                    </div>
                                ))}
                                {viewingDeck.bakugans.filter(b => b.name).length === 0 && <p style={{ color: 'var(--text-secondary)' }}>Sin Bakugans</p>}
                            </div>
                        </div>

                        {/* Cartas Portal */}
                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Cartas Portal ({allGates.length}/6)</h3>
                            <div className="deck-cards-grid">
                                {allGates.map((cardName, idx) => {
                                    const cardInfo = (cardsData as CardData[]).find(c => c.name === cardName);
                                    return (
                                        <div key={idx} className="tooltip-container" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => { if (cardInfo && onCardClick) onCardClick(cardInfo); }}>
                                            <img
                                                src={getOptimizedThumbnailUrl(cardInfo ? getCardImageUrl(cardInfo) : 'https://bloxugan.info/images/card-back.png')}
                                                alt={cardName}
                                                style={{ width: '100%', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                                                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://bloxugan.info/images/card-back.png' }}
                                            />
                                            <div style={{ marginTop: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>{cardName}</div>
                                            <div className="tooltip-text" style={{ textAlign: 'left', fontWeight: 'normal', zIndex: 100 }}>
                                                <strong style={{ color: 'var(--accent-color)' }}>{cardName}</strong><br />
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>{getCardDescription(cardName)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {allGates.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>Sin Cartas Portal</p>}
                            </div>
                        </div>

                        {/* Habilidades */}
                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Cartas de Habilidad ({viewingDeck.abilities.length}/10)</h3>
                            <div className="deck-cards-grid">
                                {viewingDeck.abilities.map((cardName, idx) => {
                                    const cardInfo = (cardsData as CardData[]).find(c => c.name === cardName);
                                    return (
                                        <div key={idx} className="tooltip-container" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => { if (cardInfo && onCardClick) onCardClick(cardInfo); }}>
                                            <img
                                                src={getOptimizedThumbnailUrl(cardInfo ? getCardImageUrl(cardInfo) : 'https://bloxugan.info/images/card-back.png')}
                                                alt={cardName}
                                                style={{ width: '100%', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                                                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://bloxugan.info/images/card-back.png' }}
                                            />
                                            <div style={{ marginTop: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>{cardName}</div>
                                            <div className="tooltip-text" style={{ textAlign: 'left', fontWeight: 'normal', zIndex: 100 }}>
                                                <strong style={{ color: 'var(--accent-color)' }}>{cardName}</strong><br />
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>{getCardDescription(cardName)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {viewingDeck.abilities.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>Sin Cartas de Habilidad</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderBakuganSelector = () => {
        if (selectingBakuganSlot === null) return null;

        const filteredBloxugans = loadedBloxugans.filter(b => {
            const matchSearch = b.name.toLowerCase().includes(bakuganFilterSearch.toLowerCase());
            const matchAttr = bakuganFilterAttr === 'Todos' || b.attribute.toLowerCase() === bakuganFilterAttr.toLowerCase();
            const matchTier = bakuganFilterTier === 'Todos' || (b.tier || 'A') === bakuganFilterTier;
            return matchSearch && matchAttr && matchTier;
        });

        return (
            <div className="modal-overlay" onClick={() => setSelectingBakuganSlot(null)} style={{ zIndex: 10001 }}>
                <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ background: '#111116', border: '1px solid var(--accent-color)', borderRadius: '16px', padding: '2rem', maxWidth: '700px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Seleccionar Bakugan Cargado</h2>
                        <button className="modal-close" style={{ position: 'relative', top: '0', right: '0' }} onClick={() => setSelectingBakuganSlot(null)}><X size={24} /></button>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: '1 1 200px' }}>
                            <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} size={18} />
                            <input
                                type="text"
                                className="search-bar"
                                placeholder="Buscar por nombre..."
                                style={{ paddingLeft: '2.5rem', marginBottom: 0, width: '100%' }}
                                value={bakuganFilterSearch}
                                onChange={(e) => setBakuganFilterSearch(e.target.value)}
                            />
                        </div>

                        <select
                            className="search-bar"
                            style={{ padding: '0.6rem 1rem', marginBottom: 0, appearance: 'auto', flex: '1 1 120px' }}
                            value={bakuganFilterAttr}
                            onChange={e => setBakuganFilterAttr(e.target.value)}
                        >
                            <option value="Todos">Todos Atributos</option>
                            <option value="Pyrus">Pyrus</option>
                            <option value="Aquos">Aquos</option>
                            <option value="Ventus">Ventus</option>
                            <option value="Subterra">Subterra</option>
                            <option value="Haos">Haos</option>
                            <option value="Darkus">Darkus</option>
                        </select>

                        <select
                            className="search-bar"
                            style={{ padding: '0.6rem 1rem', marginBottom: 0, appearance: 'auto', flex: '1 1 120px' }}
                            value={bakuganFilterTier}
                            onChange={e => setBakuganFilterTier(e.target.value)}
                        >
                            <option value="Todos">Todos Tiers</option>
                            <option value="A">Tier A</option>
                            <option value="B">Tier B</option>
                            <option value="C">Tier C</option>
                        </select>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingRight: '0.5rem' }}>
                        {filteredBloxugans.length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '1rem' }}>No se encontraron Bakugans con esos filtros.</p>
                        ) : (
                            filteredBloxugans.map(b => (
                                <div key={b.id} className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', borderLeft: '3px solid transparent', transition: 'all 0.2s' }} 
                                     onMouseEnter={e => e.currentTarget.style.borderLeftColor = 'var(--accent-color)'}
                                     onMouseLeave={e => e.currentTarget.style.borderLeftColor = 'transparent'}
                                     onClick={() => {
                                        handleLoadedBakuganSelect(selectingBakuganSlot, b);
                                        setSelectingBakuganSlot(null);
                                     }}>
                                        {b.image ? (
                                            <img src={getOptimizedImageUrl(b.image, 80)} alt={b.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)' }}>B</div>
                                        )}
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 'bold' }}>{b.name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                {b.attribute.toUpperCase()} | TIER {b.tier || 'A'}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: '800', color: '#FFD700' }}>{b.poderG || 0} G</div>
                                        </div>
                                    </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando mazos...</div>;

    return (
        <>
            <div className="deck-builder animate-fade-in" style={{ paddingBottom: '4rem' }}>
                <section className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', fontWeight: 800 }}>Generador de Estrategias</h1>
                            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1.1rem' }}>Crea, edita y comparte tus mejores mazos para dominar el torneo.</p>
                        </div>
                        {viewState === 'list' && (
                            <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => createNewDeck()}>
                                <Plus size={20} /> Nueva Estrategia
                            </button>
                        )}
                        {viewState !== 'list' && (
                            <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => { setViewState('list'); setEditingDeck(null); }}>
                                <ArrowLeft size={20} /> Volver a mi arsenal
                            </button>
                        )}
                    </div>
                </section>

                {viewState === 'list' ? (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            {decks.length === 0 ? (
                                <p style={{ color: 'var(--text-secondary)', gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }} className="glass-panel">
                                    No tienes estrategias creadas. ¡Comienza diseñando tu primer mazo!
                                </p>
                            ) : (
                                decks.map(deck => {
                                    const aceBakugan = deck.bakugans.reduce((prev, current) => {
                                        const prevG = prev?.gpower ? Number(prev.gpower) : 0;
                                        const currG = current?.gpower ? Number(current.gpower) : 0;
                                        return (currG > prevG) ? current : prev;
                                    }, deck.bakugans[0]);
                                    const aceImage = aceBakugan?.imageUrl || null;

                                    return (
                                    <div key={deck.id} className="glass-panel" style={{ padding: '1.5rem', borderTop: '2px solid var(--accent-color)', position: 'relative', overflow: 'hidden' }}>
                                        {aceImage && (
                                            <div style={{
                                                position: 'absolute',
                                                top: 0, left: 0, right: 0, bottom: 0,
                                                backgroundImage: `linear-gradient(to right, rgba(19, 17, 28, 1) 40%, rgba(19, 17, 28, 0.2) 100%), url(${getOptimizedImageUrl(aceImage, 400, 30)})`,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center right',
                                                zIndex: 0,
                                                opacity: 0.8
                                            }} />
                                        )}
                                        <div style={{ position: 'relative', zIndex: 10 }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                                <h3 style={{ margin: 0, color: 'var(--text-main)', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{deck.name || 'Sin nombre'}</h3>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button onClick={() => { setEditingDeck(deck); setViewState('editing'); }} style={{ background: 'none', border: 'none', color: '#64C8FF', cursor: 'pointer', padding: '0.5rem' }} title="Editar">
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button onClick={() => deleteDeck(deck.id)} style={{ background: 'none', border: 'none', color: '#FF4D4D', cursor: 'pointer', padding: '0.5rem' }} title="Borrar">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                            {deck.isPublic !== undefined && (
                                                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: deck.isPublic ? '#A38CFF' : 'var(--text-secondary)' }}>
                                                    {deck.isPublic ? <Globe size={14} /> : <Lock size={14} />}
                                                    <span style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{deck.isPublic ? 'Estrategia Pública' : 'Estrategia Privada'}</span>
                                                </div>
                                            )}
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                                                <p>• {deck.bakugans.filter(b => b.name).length}/3 Bakugans</p>
                                                <p>• {deck.attributeGates.length + deck.commandGates.length + deck.characterGates.length}/6 Cartas Portal</p>
                                                <p>• {deck.abilities.length}/10 Cartas de Habilidad</p>
                                            </div>
                                            <button className="btn-secondary" style={{ width: '100%', textShadow: 'none' }} onClick={() => setViewingDeck(deck)}>
                                                Inspeccionar Mazo
                                            </button>
                                        </div>
                                    </div>
                                )})
                            )}
                        </div>
                    </div>
                ) : editingDeck !== null ? (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Deck Info & Actions */}
                        <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent-color)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                                    <div style={{ flex: 1, minWidth: '250px' }}>
                                        <input
                                            type="text"
                                            className="search-bar"
                                            style={{ marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}
                                            placeholder="Nombre de tu estrategia..."
                                            value={editingDeck.name}
                                            onChange={(e) => setEditingDeck({ ...editingDeck, name: e.target.value })}
                                            maxLength={30}
                                        />
                                        <label 
                                            style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: '1rem', marginTop: '0.5rem', opacity: 0.9, transition: 'opacity 0.2s' }} 
                                            onMouseEnter={e => e.currentTarget.style.opacity = '1'} 
                                            onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
                                        >
                                            {/* Input nativo oculto para accesibilidad y estado */}
                                            <input
                                                type="checkbox"
                                                id="isPublic"
                                                checked={editingDeck.isPublic || false}
                                                onChange={(e) => setEditingDeck({ ...editingDeck, isPublic: e.target.checked })}
                                                style={{ opacity: 0, position: 'absolute', zIndex: -1 }} 
                                            />
                                            
                                            {/* Track (Cuerpo del interruptor) */}
                                            <div 
                                                style={{ 
                                                    width: '48px', 
                                                    height: '26px', 
                                                    backgroundColor: (editingDeck.isPublic || false) ? 'var(--accent-color)' : '#2D2B3B',
                                                    borderRadius: '9999px',
                                                    position: 'relative',
                                                    transition: 'background-color 0.2s ease-in-out',
                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
                                                }}
                                            >
                                                {/* Thumb (Perilla) */}
                                                <div 
                                                    style={{
                                                        position: 'absolute',
                                                        top: '2px',
                                                        left: '2px',
                                                        width: '20px',
                                                        height: '20px',
                                                        backgroundColor: (editingDeck.isPublic || false) ? '#ffffff' : '#e2e8f0',
                                                        borderRadius: '50%',
                                                        transition: 'transform 0.2s ease-in-out, background-color 0.2s ease-in-out',
                                                        transform: (editingDeck.isPublic || false) ? 'translateX(22px)' : 'translateX(0)',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                                                    }}
                                                />
                                            </div>
                                            
                                            {/* Texto descriptivo */}
                                            <span style={{ fontSize: '0.95rem', color: (editingDeck.isPublic || false) ? '#ffffff' : 'var(--text-secondary)', transition: 'color 0.2s ease-in-out', fontWeight: '500' }}>
                                                Hacer pública esta táctica
                                            </span>
                                        </label>
                                    </div>
                                    <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={saveEditingDeck}>
                                        <Save size={18} /> Guardar Cambios
                                    </button>
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Estrategia del Mazo (Opcional):</label>
                                    <textarea
                                        className="search-bar"
                                        style={{ width: '100%', minHeight: '80px', marginBottom: 0, resize: 'vertical' }}
                                        placeholder="Describe cómo se juega este mazo, mejores combos, tácticas recomendadas..."
                                        value={editingDeck.description || ''}
                                        onChange={(e) => setEditingDeck({ ...editingDeck, description: e.target.value })}
                                        maxLength={1000}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Bakugans Selection */}
                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <h3 style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                Equipo Bakugan
                                <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>{editingDeck.bakugans.filter(b => b.name).length}/3</span>
                            </h3>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
                                {[0, 1, 2].map(i => {
                                    const bk = editingDeck.bakugans[i];
                                    return (
                                        <div 
                                            key={i} 
                                            style={{ 
                                                background: bk.name ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.2)', 
                                                border: bk.name ? '1px solid rgba(255,255,255,0.1)' : '2px dashed rgba(255,255,255,0.2)', 
                                                borderRadius: '12px', 
                                                padding: '1.5rem', 
                                                position: 'relative', 
                                                display: 'flex', 
                                                flexDirection: 'column', 
                                                justifyContent: 'center', 
                                                alignItems: 'center', 
                                                minHeight: '200px',
                                                cursor: bk.name ? 'default' : 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                            onClick={() => { if (!bk.name) setSelectingBakuganSlot(i); }}
                                            onMouseEnter={e => { if (!bk.name) e.currentTarget.style.borderColor = 'var(--accent-color)' }}
                                            onMouseLeave={e => { if (!bk.name) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
                                        >
                                            {bk.name ? (
                                                <>
                                                    {bk.imageUrl ? (
                                                        <LazyImage src={getOptimizedThumbnailUrl(bk.imageUrl)} alt={bk.name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '1rem', border: `2px solid var(--accent-color)` }} />
                                                    ) : (
                                                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 'bold' }}>B</div>
                                                    )}
                                                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', textAlign: 'center' }}>{bk.name}</h4>
                                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                        <span className={`attr-${bk.attribute.toLowerCase()}`} style={{ fontWeight: 'bold', fontSize: '0.85rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(0,0,0,0.3)' }}>{bk.attribute.toUpperCase()}</span>
                                                        <span style={{ fontWeight: 'bold', fontSize: '0.85rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(0,0,0,0.3)' }}>TIER {bk.tier || 'A'}</span>
                                                        <span style={{ fontWeight: '800', color: '#FFD700', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(0,0,0,0.3)' }}>{bk.gpower || 0} G</span>
                                                    </div>
                                                    <button onClick={(e) => { e.stopPropagation(); removeBakugan(i); }} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(255,0,0,0.2)', color: '#FF4D4D', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }} title="Quitar Bakugan">
                                                        <X size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%' }}>
                                                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
                                                        <Plus size={24} />
                                                    </div>
                                                    <button 
                                                        className="btn-secondary" 
                                                        style={{ 
                                                            padding: '0.5rem 1.2rem', 
                                                            border: '1px solid var(--accent-color)', 
                                                            color: 'var(--accent-color)', 
                                                            background: 'rgba(123, 97, 255, 0.1)', 
                                                            fontWeight: 'bold',
                                                            pointerEvents: 'none' // Para que el click del contenedor superior sea el que lo capture todo
                                                        }} 
                                                    >
                                                        + Seleccionar
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>


                        {/* Cartas Portal */}
                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    Cartas Portal ({editingDeck.attributeGates.length + editingDeck.commandGates.length + editingDeck.characterGates.length}/6)
                                </h3>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
                                {[0, 1, 2, 3, 4, 5].map(i => {
                                    const gateSlotsDef = [
                                        { type: 'attribute', label: 'Atributo' },
                                        { type: 'attribute', label: 'Atributo' },
                                        { type: 'command', label: 'Comando' },
                                        { type: 'command', label: 'Comando' },
                                        { type: 'character', label: 'Personaje' },
                                        { type: 'character', label: 'Personaje' }
                                    ] as const;
                                    const slotDef = gateSlotsDef[i];
                                    
                                    let c: string | undefined;
                                    if (slotDef.type === 'attribute') c = editingDeck.attributeGates[i];
                                    else if (slotDef.type === 'command') c = editingDeck.commandGates[i - 2];
                                    else c = editingDeck.characterGates[i - 4];

                                    if (c) {
                                        const cardInfo = (cardsData as CardData[]).find(card => card.name === c);
                                        return (
                                            <div 
                                                key={i} 
                                                className="glass-panel tooltip-container"
                                                style={{ 
                                                    aspectRatio: '2.5/3.5',
                                                    borderRadius: '8px', 
                                                    display: 'flex', 
                                                    justifyContent: 'center', 
                                                    alignItems: 'center', 
                                                    position: 'relative',
                                                    overflow: 'visible',
                                                    padding: 0
                                                }}
                                            >
                                                <LazyImage 
                                                    src={getOptimizedThumbnailUrl(cardInfo ? getCardImageUrl(cardInfo) : 'https://bloxugan.info/images/card-back.png')} 
                                                    alt={c} 
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} 
                                                    onError={(e: any) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://bloxugan.info/images/card-back.png' }}
                                                />
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation(); 
                                                        const targetList = slotDef.type + 'Gates' as 'attributeGates' | 'commandGates' | 'characterGates';
                                                        removeCard(targetList, c!);
                                                    }} 
                                                    style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#FF4D4D', color: '#fff', border: '2px solid #111116', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }} 
                                                    title="Quitar Carta"
                                                >
                                                    <X size={16} />
                                                </button>
                                                <div className="tooltip-text" style={{ textAlign: 'left', fontWeight: 'normal', zIndex: 100 }}>
                                                    <strong style={{ color: 'var(--accent-color)' }}>{c}</strong><br />
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>{getCardDescription(c)}</span>
                                                </div>
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <div 
                                                key={i} 
                                                className="glass-panel"
                                                style={{ 
                                                    aspectRatio: '2.5/3.5',
                                                    background: 'rgba(0,0,0,0.2)', 
                                                    border: '2px dashed rgba(255,255,255,0.2)', 
                                                    borderRadius: '8px', 
                                                    display: 'flex', 
                                                    justifyContent: 'center', 
                                                    alignItems: 'center', 
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    position: 'relative',
                                                    flexDirection: 'column',
                                                    gap: '0.5rem'
                                                }}
                                                onClick={() => { setSelectorType(slotDef.type); setCardFilterAttr('Todos'); }}
                                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-color)'}
                                                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
                                            >
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
                                                    <Plus size={20} />
                                                </div>
                                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                                    + {slotDef.label}
                                                </span>
                                            </div>
                                        );
                                    }
                                })}
                            </div>
                        </div>

                        {/* Cartas de Habilidad Selection */}
                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    Cartas de Habilidad ({editingDeck.abilities.length}/10)
                                </h3>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => {
                                    const c = editingDeck.abilities[i];

                                    if (c) {
                                        const cardInfo = (cardsData as CardData[]).find(card => card.name === c);
                                        return (
                                            <div 
                                                key={i} 
                                                className="glass-panel tooltip-container"
                                                style={{ 
                                                    aspectRatio: '2.5/3.5',
                                                    borderRadius: '8px', 
                                                    display: 'flex', 
                                                    justifyContent: 'center', 
                                                    alignItems: 'center', 
                                                    position: 'relative',
                                                    overflow: 'visible',
                                                    padding: 0
                                                }}
                                            >
                                                <LazyImage 
                                                    src={getOptimizedThumbnailUrl(cardInfo ? getCardImageUrl(cardInfo) : 'https://bloxugan.info/images/card-back.png')} 
                                                    alt={c} 
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} 
                                                    onError={(e: any) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://bloxugan.info/images/card-back.png' }}
                                                />
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation(); 
                                                        removeCard('abilities', c);
                                                    }} 
                                                    style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#FF4D4D', color: '#fff', border: '2px solid #111116', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }} 
                                                    title="Quitar Carta"
                                                >
                                                    <X size={16} />
                                                </button>
                                                <div className="tooltip-text" style={{ textAlign: 'left', fontWeight: 'normal', zIndex: 100 }}>
                                                    <strong style={{ color: 'var(--accent-color)' }}>{c}</strong><br />
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>{getCardDescription(c)}</span>
                                                </div>
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <div 
                                                key={i} 
                                                className="glass-panel"
                                                style={{ 
                                                    aspectRatio: '2.5/3.5',
                                                    background: 'rgba(0,0,0,0.2)', 
                                                    border: '2px dashed rgba(255,255,255,0.2)', 
                                                    borderRadius: '8px', 
                                                    display: 'flex', 
                                                    justifyContent: 'center', 
                                                    alignItems: 'center', 
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    position: 'relative'
                                                }}
                                                onClick={() => { setSelectorType('ability'); setCardFilterAttr('Todos'); }}
                                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-color)'}
                                                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
                                            >
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
                                                    <Plus size={20} />
                                                </div>
                                            </div>
                                        );
                                    }
                                })}
                            </div>
                        </div>

                    </div>
                ) : null}
            </div >

            {renderBakuganSelector()}
            {renderCardSelector()}
            {renderDeckViewer()}
        </>
    );
}
