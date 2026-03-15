import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Eye, X, Heart, UserPlus, Send, MessageSquare } from 'lucide-react';
import type { CardData } from '../utils/cardLogic';
import cardsData from '../data/cards_es.json';
import UserAvatar from './UserAvatar';
import { getOptimizedImageUrl } from '../utils/imageOptimization';

interface Bakugan {
    name: string;
    attribute: string;
    gpower: number | '';
    imageUrl?: string;
}

interface Deck {
    id: string;
    name: string;
    bakugans: Bakugan[];
    attributeGates: string[];
    commandGates: string[];
    characterGates: string[];
    abilities: string[];
    isPublic?: boolean;
    likes?: string[];
    owner?: string;
    description?: string;
    comments?: {
        id: string;
        user: string;
        text: string;
        date: string;
    }[];
    ownerAttribute?: string;
    ownerAvatar?: string;
}

const getAttrColor = (attr?: string) => {
    if (!attr) return 'var(--accent-color)';
    return `var(--attr-${attr.toLowerCase()})`;
};

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

export default function MetaDecks({ currentUser, onCardClick }: { currentUser: string | null, onCardClick?: (card: CardData) => void }) {
    const [publicDecks, setPublicDecks] = useState<Deck[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewingDeck, setViewingDeck] = useState<Deck | null>(null);
    const [commentText, setCommentText] = useState('');

    const getCardDescription = (name: string) => {
        const card = (cardsData as CardData[]).find(c => c.name === name);
        return card ? card.description : '';
    };

    const loadAllPublicDecks = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "user_decks"));
            const allDecks: Deck[] = [];

            querySnapshot.forEach((docSnapshot) => {
                const data = docSnapshot.data();
                if (data.decks) {
                    data.decks.forEach((d: Deck) => {
                        if (d.isPublic) {
                            allDecks.push({ ...d, owner: docSnapshot.id, ownerAttribute: data.userAttribute, ownerAvatar: data.userAvatar });
                        }
                    });
                }
            });

            // Sort by likes
            allDecks.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
            setPublicDecks(allDecks);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadAllPublicDecks();
    }, []);

    const handleLikeDeck = async (deckOwner: string, deckId: string) => {
        if (!currentUser) return alert('Debes iniciar sesión para dar me gusta a un mazo.');

        try {
            const docRef = doc(db, 'user_decks', deckOwner);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) return;

            const data = docSnap.data();
            let deckFound = false;
            const updatedDecks = data.decks.map((d: Deck) => {
                if (d.id === deckId) {
                    deckFound = true;
                    const currentLikes = d.likes || [];
                    const hasLiked = currentLikes.some(u => u.toLowerCase() === currentUser.toLowerCase());
                    const newLikes = hasLiked ? currentLikes.filter(u => u.toLowerCase() !== currentUser.toLowerCase()) : [...currentLikes, currentUser.toLowerCase()];
                    return { ...d, likes: newLikes };
                }
                return d;
            });

            if (deckFound) {
                await setDoc(docRef, { decks: updatedDecks }, { merge: true });
                // Optimistic local update
                setPublicDecks(prev => {
                    const next = prev.map(d => {
                        if (d.id === deckId && d.owner === deckOwner) {
                            const currentLikes = d.likes || [];
                            const hasLiked = currentLikes.some(u => u.toLowerCase() === currentUser.toLowerCase());
                            const newLikes = hasLiked ? currentLikes.filter(u => u.toLowerCase() !== currentUser.toLowerCase()) : [...currentLikes, currentUser.toLowerCase()];
                            return { ...d, likes: newLikes };
                        }
                        return d;
                    });
                    return next.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
                });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleAddFriend = async (targetUsername: string) => {
        if (!currentUser) {
            alert("Debes iniciar sesión para añadir amigos.");
            return;
        }
        if (currentUser.toLowerCase() === targetUsername.toLowerCase()) {
            alert("No puedes añadirte a ti mismo.");
            return;
        }

        try {
            const targetRef = doc(db, 'users', targetUsername.toLowerCase());
            const myRef = doc(db, 'users', currentUser.toLowerCase());

            await updateDoc(targetRef, {
                incomingRequests: arrayUnion(currentUser.toLowerCase())
            });
            await updateDoc(myRef, {
                outgoingRequests: arrayUnion(targetUsername.toLowerCase())
            });

            alert(`Solicitud de amistad enviada a @${targetUsername}`);
        } catch (e) {
            console.error(e);
            alert("Error al enviar solicitud.");
        }
    };

    const handleAddComment = async () => {
        if (!currentUser) return alert('Debes iniciar sesión para comentar.');
        if (!commentText.trim()) return;
        if (!viewingDeck || !viewingDeck.owner) return;

        const newComment = {
            id: Date.now().toString(),
            user: currentUser,
            text: commentText.trim(),
            date: new Date().toISOString()
        };

        try {
            const docRef = doc(db, 'user_decks', viewingDeck.owner);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) return;

            const data = docSnap.data();
            let deckFound = false;
            const updatedDecks = data.decks.map((d: Deck) => {
                if (d.id === viewingDeck.id) {
                    deckFound = true;
                    return { ...d, comments: [...(d.comments || []), newComment] };
                }
                return d;
            });

            if (deckFound) {
                await setDoc(docRef, { decks: updatedDecks }, { merge: true });
                setCommentText('');
                // update local viewing state
                setViewingDeck({ ...viewingDeck, comments: [...(viewingDeck.comments || []), newComment] });
                // update local public decks list
                setPublicDecks(prev => prev.map(d => {
                    if (d.id === viewingDeck.id && d.owner === viewingDeck.owner) {
                        return { ...d, comments: [...(d.comments || []), newComment] };
                    }
                    return d;
                }));
            }
        } catch (e) {
            console.error(e);
        }
    };

    const renderDeckViewer = () => {
        if (!viewingDeck) return null;

        const allGates = [...viewingDeck.attributeGates, ...viewingDeck.commandGates, ...viewingDeck.characterGates];

        return (
            <div className="modal-overlay" onClick={() => setViewingDeck(null)} style={{ zIndex: 10001 }}>
                <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ background: '#111116', border: '1px solid var(--accent-color)', borderRadius: '16px', padding: '2rem', maxWidth: '900px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                    <button className="modal-close" onClick={() => setViewingDeck(null)}><X size={24} /></button>
                    <h2 style={{ marginBottom: '0.5rem', textAlign: 'center', color: 'var(--accent-color)', fontSize: '2rem' }}>{viewingDeck.name || 'Mazo sin nombre'}</h2>
                    {viewingDeck.owner && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>por</span>
                            <UserAvatar username={viewingDeck.owner} size={28} overrideAvatar={viewingDeck.ownerAvatar} />
                            <span style={{ color: getAttrColor(viewingDeck.ownerAttribute), fontWeight: 'bold', textShadow: `0 0 8px ${getAttrColor(viewingDeck.ownerAttribute)}40` }}>@{viewingDeck.owner}</span>
                        </div>
                    )}

                    {viewingDeck.description && (
                        <div className="analysis-block" style={{ marginBottom: '2rem', borderLeftColor: 'var(--accent-color)' }}>
                            <h4 style={{ color: 'var(--accent-color)' }}>Estrategia del Mazo</h4>
                            <p style={{ whiteSpace: 'pre-wrap', color: '#fff' }}>{viewingDeck.description}</p>
                        </div>
                    )}

                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                        {/* Bakugans */}
                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Bakugans ({viewingDeck.bakugans.filter(b => b.name).length}/3)</h3>
                            <div className="deck-baku-grid">
                                {viewingDeck.bakugans.map((bk, i) => bk.name && (
                                    <div key={i} className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px', textAlign: 'center', background: 'linear-gradient(145deg, rgba(20,20,28,0.8) 0%, rgba(30,30,40,0.8) 100%)' }}>
                                        {bk.imageUrl && (
                                            <img src={getOptimizedImageUrl(bk.imageUrl, 150)} alt={bk.name} className="w-20 h-20 object-cover rounded-md mx-auto mb-2" style={{ width: '5rem', height: '5rem', objectFit: 'cover', borderRadius: '0.375rem', margin: '0 auto 0.5rem auto' }} />
                                        )}
                                        <div style={{ fontWeight: '800', fontSize: '1.3rem', marginBottom: '0.5rem' }}>{bk.name}</div>
                                        <div className={`attr-${bk.attribute.toLowerCase()}`} style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>{bk.attribute.toUpperCase()}</div>
                                        {bk.gpower && <div style={{ color: '#FFF', background: 'rgba(0,0,0,0.5)', display: 'inline-block', padding: '0.3rem 0.8rem', borderRadius: '999px', fontWeight: 'bold' }}>{bk.gpower} G</div>}
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
                                                src={cardInfo ? getCardImageUrl(cardInfo) : 'https://bloxugan.info/images/card-back.png'}
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
                                                src={cardInfo ? getCardImageUrl(cardInfo) : 'https://bloxugan.info/images/card-back.png'}
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

                        {/* Comentarios */}
                        <div style={{ marginTop: '3rem', borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
                            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MessageSquare size={20} /> Comentarios ({viewingDeck.comments?.length || 0})</h3>

                            {/* Input Form */}
                            {currentUser ? (
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                                    <UserAvatar username={currentUser} size={40} />
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <textarea
                                            className="search-bar"
                                            style={{ marginBottom: 0, padding: '0.8rem 1rem', resize: 'vertical', minHeight: '60px' }}
                                            placeholder="Deja un comentario o consejo sobre este mazo..."
                                            value={commentText}
                                            onChange={e => setCommentText(e.target.value)}
                                        />
                                        <button className="btn-primary" style={{ alignSelf: 'flex-end', padding: '0.5rem 1rem' }} onClick={handleAddComment}>
                                            <Send size={16} /> Comentar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center', marginBottom: '2rem', color: 'var(--text-secondary)' }}>
                                    Inicia sesión para dejar un comentario.
                                </div>
                            )}

                            {/* Comment List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {!(viewingDeck.comments && viewingDeck.comments.length > 0) ? (
                                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>Aún no hay comentarios. ¡Sé el primero en opinar!</p>
                                ) : (
                                    [...viewingDeck.comments].reverse().map(c => (
                                        <div key={c.id} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <UserAvatar username={c.user} size={24} />
                                                    <span style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>@{c.user}</span>
                                                </div>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(c.date).toLocaleDateString()}</span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.95rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{c.text}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="animate-fade-in" style={{ paddingBottom: '4rem' }}>
                <section className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 800 }}>Decks del Meta</h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '0', fontSize: '1.1rem', maxWidth: '600px' }}>
                        Explora los mazos más populares compartidos por la comunidad. Los mejores mazos votados aparecerán aquí arriba.
                    </p>
                </section>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>Cargando estrategias...</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                        {publicDecks.length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)', gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }} className="glass-panel">
                                Aún no hay mazos públicos.
                            </p>
                        ) : (
                            publicDecks.map(deck => {
                                const aceBakugan = deck.bakugans.reduce((prev, current) => {
                                    const prevG = prev?.gpower ? Number(prev.gpower) : 0;
                                    const currG = current?.gpower ? Number(current.gpower) : 0;
                                    return (currG > prevG) ? current : prev;
                                }, deck.bakugans[0]);
                                const aceImage = aceBakugan?.imageUrl || null;

                                return (
                                <div key={deck.id} className="glass-panel" style={{ padding: '1.5rem', borderTop: `2px solid ${getAttrColor(deck.ownerAttribute)}`, position: 'relative', overflow: 'hidden' }}>
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
                                        <div style={{ position: 'absolute', top: '-1.5rem', left: '-1.5rem', right: '-1.5rem', height: '5rem', background: `linear-gradient(to bottom, ${getAttrColor(deck.ownerAttribute)}20, transparent)`, pointerEvents: 'none', zIndex: -1 }} />
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem', position: 'relative' }}>
                                            <h3 style={{ color: 'var(--text-main)', flex: 1, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{deck.name || 'Mazo sin nombre'}</h3>
                                            <button
                                                onClick={() => handleLikeDeck(deck.owner!, deck.id)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: deck.likes?.some(u => u.toLowerCase() === (currentUser || '').toLowerCase()) ? '#FF4D4D' : 'var(--text-secondary)' }}
                                            >
                                                <Heart size={18} fill={deck.likes?.some(u => u.toLowerCase() === (currentUser || '').toLowerCase()) ? '#FF4D4D' : 'none'} />
                                                <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{deck.likes?.length || 0}</span>
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', position: 'relative' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                                                Por:
                                                <UserAvatar username={deck.owner || ''} size={20} overrideAvatar={deck.ownerAvatar} />
                                                <span style={{ color: getAttrColor(deck.ownerAttribute), fontWeight: 'bold' }}>@{deck.owner}</span>
                                            </div>
                                            <button onClick={() => deck.owner && handleAddFriend(deck.owner)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = getAttrColor(deck.ownerAttribute)} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'} title="Añadir a amigos">
                                                <UserPlus size={16} />
                                            </button>
                                        </div>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                                            <p>• {deck.bakugans.filter(b => b.name).length}/3 Bakugans</p>
                                            <p>• {deck.attributeGates.length + deck.commandGates.length + deck.characterGates.length}/6 Cartas Portal</p>
                                            <p>• {deck.abilities.length}/10 Cartas de Habilidad</p>
                                        </div>
                                        <button className="btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem', color: '#64C8FF', textShadow: 'none' }} onClick={() => setViewingDeck(deck)}>
                                            <Eye size={18} /> Ver Estrategia
                                        </button>
                                    </div>
                                </div>
                            )})
                        )}
                    </div>
                )}
            </div>
            {renderDeckViewer()}
        </>
    );
}
