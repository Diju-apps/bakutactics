import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, getDocs, query, where } from 'firebase/firestore';
import { Search, Eye, X, Heart, UserPlus, Trophy, Skull, BarChart3, History, Target } from 'lucide-react';
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
    description?: string;
    ownerAttribute?: string;
    ownerAvatar?: string;
}

interface UserProfile {
    username: string;
    attribute?: string;
    avatar?: string;
}

interface Match {
    id: string;
    username: string;
    myDeck: string;
    opponentAttr: string;
    result: 'Victoria' | 'Derrota';
    notes?: string;
    createdAt: any;
    displayDate: string;
}

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

    return getOptimizedImageUrl(url, 300); // Optimizamos a 300px
};

export default function Community({ currentUser, onCardClick }: { currentUser: string | null, onCardClick?: (card: CardData) => void }) {
    const [searchUser, setSearchUser] = useState('');
    const [foundDecks, setFoundDecks] = useState<Deck[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [loading, setLoading] = useState(false);
    const [viewingDeck, setViewingDeck] = useState<Deck | null>(null);

    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
    const [selectedUserDecks, setSelectedUserDecks] = useState<Deck[]>([]);
    const [loadingUserDecks, setLoadingUserDecks] = useState(false);
    const [selectedUserMatches, setSelectedUserMatches] = useState<Match[]>([]);
    const [profileTab, setProfileTab] = useState<'decks' | 'matches'>('decks');

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'users'));
                const usersData: UserProfile[] = [];
                querySnapshot.forEach((doc) => {
                    usersData.push({
                        username: doc.id,
                        attribute: doc.data().attribute,
                        avatar: doc.data().avatar
                    });
                });
                // Optional: sort alphabetically or randomize
                usersData.sort((a, b) => a.username.localeCompare(b.username));
                setAllUsers(usersData);
            } catch (error) {
                console.error("Error fetching users", error);
            }
        };
        fetchUsers();
    }, []);

    const getCardDescription = (name: string) => {
        const card = (cardsData as CardData[]).find(c => c.name === name);
        return card ? card.description : '';
    };

    const handleSearch = async () => {
        const query = searchUser.trim().toLowerCase();
        if (!query) return;
        setLoading(true);
        try {
            const docRef = doc(db, 'user_decks', query);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().decks) {
                const data = docSnap.data();
                const publicDecks = (data.decks as Deck[]).filter(d => d.isPublic).map(d => ({
                    ...d,
                    ownerAttribute: data.userAttribute, // This is stored in user_decks doc
                    ownerAvatar: data.userAvatar
                }));
                setFoundDecks(publicDecks);
            } else {
                setFoundDecks([]);
            }
        } catch (e) {
            console.error(e);
            setFoundDecks([]);
        }
        setHasSearched(true);
        setLoading(false);
    };

    const handleLikeDeck = async (targetOwner: string, deckId: string) => {
        if (!currentUser) return alert('Debes iniciar sesión para dar me gusta a un mazo.');

        try {
            const docRef = doc(db, 'user_decks', targetOwner);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) return;

            const data = docSnap.data();
            let deckFound = false;
            const updatedDecks = data.decks.map((d: Deck) => {
                if (d.id === deckId) {
                    deckFound = true;
                    const currentLikes = d.likes || [];
                    const hasLiked = currentLikes.some((u: string) => u.toLowerCase() === currentUser.toLowerCase());
                    const newLikes = hasLiked ? currentLikes.filter((u: string) => u.toLowerCase() !== currentUser.toLowerCase()) : [...currentLikes, currentUser.toLowerCase()];
                    return { ...d, likes: newLikes };
                }
                return d;
            });

            if (deckFound) {
                await setDoc(docRef, { decks: updatedDecks }, { merge: true });
                setFoundDecks((prev) => prev.map(d => {
                    if (d.id === deckId) {
                        const currentLikes = d.likes || [];
                        const hasLiked = currentLikes.some((u: string) => u.toLowerCase() === currentUser.toLowerCase());
                        const newLikes = hasLiked ? currentLikes.filter((u: string) => u.toLowerCase() !== currentUser.toLowerCase()) : [...currentLikes, currentUser.toLowerCase()];
                        return { ...d, likes: newLikes };
                    }
                    return d;
                }));
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

    const handleUserClick = async (user: UserProfile) => {
        setSelectedUserProfile(user);
        setLoadingUserDecks(true);
        setProfileTab('decks');
        try {
            // Fetch Decks
            const deckDocRef = doc(db, 'user_decks', user.username.toLowerCase());
            const deckSnap = await getDoc(deckDocRef);
            if (deckSnap.exists() && deckSnap.data().decks) {
                const data = deckSnap.data();
                const publicDecks = (data.decks as Deck[]).filter(d => d.isPublic).map(d => ({
                    ...d,
                    ownerAttribute: data.userAttribute,
                    ownerAvatar: data.userAvatar
                }));
                setSelectedUserDecks(publicDecks);
            } else {
                setSelectedUserDecks([]);
            }

            // Fetch Matches (Public part)
            const matchesQuery = query(
                collection(db, "matches"),
                where("username", "==", user.username)
            );
            const matchesSnap = await getDocs(matchesQuery);
            const matchesData: Match[] = [];
            matchesSnap.forEach((doc) => {
                const data = doc.data();
                matchesData.push({
                    id: doc.id,
                    username: data.username,
                    myDeck: data.myDeck,
                    opponentAttr: data.opponentAttr,
                    result: data.result,
                    // We don't include notes here if it's for the public view
                    createdAt: data.createdAt,
                    displayDate: data.displayDate
                } as Match);
            });

            // Client side sort
            matchesData.sort((a, b) => {
                const getMs = (ts: any) => {
                    if (!ts) return 0;
                    if (typeof ts.toMillis === 'function') return ts.toMillis();
                    if (ts instanceof Date) return ts.getTime();
                    return 0;
                };
                return getMs(b.createdAt) - getMs(a.createdAt);
            });

            setSelectedUserMatches(matchesData);

        } catch (error) {
            console.error("Error fetching user data", error);
            setSelectedUserDecks([]);
            setSelectedUserMatches([]);
        }
        setLoadingUserDecks(false);
    };

    const renderDeckViewer = () => {
        if (!viewingDeck) return null;

        const allGates = [...viewingDeck.attributeGates, ...viewingDeck.commandGates, ...viewingDeck.characterGates];

        return (
            <div className="modal-overlay" onClick={() => setViewingDeck(null)} style={{ zIndex: 10001 }}>
                <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ background: '#111116', border: '1px solid var(--accent-color)', borderRadius: '16px', padding: '2rem', maxWidth: '900px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                    <button className="modal-close" onClick={() => setViewingDeck(null)}><X size={24} /></button>
                    <h2 style={{ marginBottom: '1.5rem', textAlign: 'center', color: 'var(--accent-color)', fontSize: '2rem' }}>{viewingDeck.name || 'Mazo sin nombre'}</h2>

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
                    </div>
                </div>
            </div>
        );
    };

    const renderUserProfileModal = () => {
        if (!selectedUserProfile) return null;

        const userColor = selectedUserProfile.attribute ? `var(--attr-${selectedUserProfile.attribute.toLowerCase()})` : 'var(--accent-color)';

        return (
            <div className="modal-overlay animate-fade-in" onClick={() => setSelectedUserProfile(null)} style={{ zIndex: 10000 }}>
                <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ background: '#111116', border: '1px solid var(--accent-color)', borderRadius: '16px', padding: '2rem', maxWidth: '800px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                    <button className="modal-close" onClick={() => setSelectedUserProfile(null)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}><X size={24} /></button>
                    
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '2rem', flexWrap: 'wrap' }}>
                        <div style={{ border: `4px solid ${userColor}`, borderRadius: '50%', padding: '4px' }}>
                            <UserAvatar username={selectedUserProfile.username} size={100} overrideAvatar={selectedUserProfile.avatar} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '2.5rem', margin: 0, color: '#fff' }}>@{selectedUserProfile.username}</h2>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.4rem 1rem', borderRadius: '999px', fontSize: '0.9rem', color: userColor, fontWeight: 'bold', textTransform: 'uppercase' }}>
                                    Afinidad: {selectedUserProfile.attribute || 'Ninguna'}
                                </span>
                                {currentUser?.toLowerCase() !== selectedUserProfile.username.toLowerCase() && (
                                    <button className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '999px' }} onClick={() => handleAddFriend(selectedUserProfile.username)}>
                                        <UserPlus size={16} /> Añadir Amigo
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tabs Navigation */}
                    <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <button 
                            onClick={() => setProfileTab('decks')}
                            style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                padding: '1rem 0.5rem', 
                                color: profileTab === 'decks' ? userColor : 'var(--text-secondary)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                borderBottom: profileTab === 'decks' ? `2px solid ${userColor}` : '2px solid transparent',
                                transition: 'all 0.3s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.6rem'
                            }}
                        >
                            <Target size={18} /> Mazos Públicos
                        </button>
                        <button 
                            onClick={() => setProfileTab('matches')}
                            style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                padding: '1rem 0.5rem', 
                                color: profileTab === 'matches' ? userColor : 'var(--text-secondary)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                borderBottom: profileTab === 'matches' ? `2px solid ${userColor}` : '2px solid transparent',
                                transition: 'all 0.3s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.6rem'
                            }}
                        >
                            <History size={18} /> Historial de Combate
                        </button>
                    </div>

                    {/* Content Section */}
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                        {loadingUserDecks ? (
                            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>Consultando archivos del brawler...</p>
                        ) : profileTab === 'decks' ? (
                            <>
                                <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>Estrategias Compartidas ({selectedUserDecks.length})</h3>
                                {selectedUserDecks.length === 0 ? (
                                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>Este usuario no ha compartido estrategias públicas aún.</p>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                        {selectedUserDecks.map(deck => {
                                            const aceBakugan = deck.bakugans.reduce((prev, current) => {
                                                const prevG = prev?.gpower ? Number(prev.gpower) : 0;
                                                const currG = current?.gpower ? Number(current.gpower) : 0;
                                                return (currG > prevG) ? current : prev;
                                            }, deck.bakugans[0]);
                                            const aceImage = aceBakugan?.imageUrl || null;

                                            return (
                                            <div key={deck.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1.5rem', borderTop: `2px solid ${userColor}`, position: 'relative', overflow: 'hidden' }}>
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
                                                    <h4 style={{ margin: '0 0 1rem 0', color: '#fff', fontSize: '1.3rem', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{deck.name || 'Sin nombre'}</h4>
                                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                                                        {Array.from(new Set(deck.bakugans.filter(b => b.name).map(b => b.attribute.toLowerCase()))).map(attr => (
                                                            <span key={attr} className={`attr-${attr}`} style={{ fontSize: '0.8rem', fontWeight: 'bold', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' }}>
                                                                {attr}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <button className="btn-secondary" style={{ width: '100%', fontSize: '0.9rem', padding: '0.6rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', color: 'var(--accent-color)', textShadow: 'none' }} onClick={() => setViewingDeck(deck)}>
                                                        <Eye size={18} /> Ver Estrategia
                                                    </button>
                                                </div>
                                            </div>
                                        )})}
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                {/* Stats Summary for Matches */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                                    <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                                        <Trophy size={20} color="#10b981" style={{ marginBottom: '0.5rem' }} />
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Victorias</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>{selectedUserMatches.filter(m => m.result === 'Victoria').length}</div>
                                    </div>
                                    <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                                        <Skull size={20} color="#ef4444" style={{ marginBottom: '0.5rem' }} />
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Derrotas</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>{selectedUserMatches.filter(m => m.result === 'Derrota').length}</div>
                                    </div>
                                    <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderBottom: `2px solid ${userColor}` }}>
                                        <BarChart3 size={20} color={userColor} style={{ marginBottom: '0.5rem' }} />
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Win Rate</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                                            {selectedUserMatches.length > 0 ? ((selectedUserMatches.filter(m => m.result === 'Victoria').length / selectedUserMatches.length) * 100).toFixed(1) : 0}%
                                        </div>
                                    </div>
                                </div>

                                <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)' }}>Últimos Combates ({selectedUserMatches.length})</h3>
                                {selectedUserMatches.length === 0 ? (
                                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>Este brawler aún no ha registrado combates en BakuTracker.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                        {selectedUserMatches.map(match => (
                                            <div key={match.id} style={{ 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center', 
                                                padding: '1rem 1.5rem', 
                                                background: 'rgba(255,255,255,0.03)', 
                                                borderRadius: '10px',
                                                borderLeft: `4px solid ${match.result === 'Victoria' ? '#10b981' : '#ef4444'}`
                                            }}>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.2rem' }}>
                                                        {match.myDeck} <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>VS</span> <span style={{ color: `var(--attr-${match.opponentAttr.toLowerCase()})` }}>{match.opponentAttr}</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{match.displayDate}</div>
                                                </div>
                                                <div style={{ 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: 900, 
                                                    color: match.result === 'Victoria' ? '#10b981' : '#ef4444',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {match.result}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="animate-fade-in" style={{ paddingBottom: '4rem' }}>
                <section className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 800 }}>Comunidad de Peleadores</h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.1rem', maxWidth: '600px' }}>
                        Busca a otros peleadores por su nombre de usuario y explora los mazos que han hecho públicos.
                    </p>

                    <div className="search-container" style={{ position: 'relative', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, position: 'relative', minWidth: '250px' }}>
                            <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                className="search-bar"
                                placeholder="Buscar usuario..."
                                style={{ paddingLeft: '3rem', marginBottom: '0', width: '100%' }}
                                value={searchUser}
                                onChange={(e) => setSearchUser(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <button className="btn-primary" onClick={handleSearch} disabled={loading}>
                            {loading ? 'Buscando...' : 'Buscar Alianzas'}
                        </button>
                    </div>
                </section>

                {hasSearched && !loading && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                        {foundDecks.length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)', gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }} className="glass-panel">
                                No se encontraron mazos públicos para "{searchUser}". Asegúrate de escribir bien el usuario o dile que los haga públicos.
                            </p>
                        ) : (
                            <>
                                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                        {foundDecks.length > 0 && <UserAvatar username={searchUser.trim()} size={40} overrideAvatar={foundDecks[0].ownerAvatar} />}
                                        <h2 style={{ fontSize: '1.2rem', margin: 0, color: '#fff' }}>Resultados de <span style={{ color: 'var(--accent-color)' }}>@{searchUser}</span></h2>
                                    </div>
                                    {currentUser?.toLowerCase() !== searchUser.trim().toLowerCase() && (
                                        <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem' }} onClick={() => handleAddFriend(searchUser.trim())}>
                                            <UserPlus size={16} /> Añadir a Amigos
                                        </button>
                                    )}
                                </div>
                                {foundDecks.map(deck => {
                                    const deckColor = deck.ownerAttribute ? `var(--attr-${deck.ownerAttribute.toLowerCase()})` : 'var(--accent-color)';
                                    const aceBakugan = deck.bakugans.reduce((prev, current) => {
                                        const prevG = prev?.gpower ? Number(prev.gpower) : 0;
                                        const currG = current?.gpower ? Number(current.gpower) : 0;
                                        return (currG > prevG) ? current : prev;
                                    }, deck.bakugans[0]);
                                    const aceImage = aceBakugan?.imageUrl || null;

                                    return (
                                        <div key={deck.id} className="glass-panel" style={{ padding: '1.5rem', borderTop: `2px solid ${deckColor}`, position: 'relative', overflow: 'hidden' }}>
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
                                                <div style={{ position: 'absolute', top: '-1.5rem', left: '-1.5rem', right: '-1.5rem', height: '5rem', background: `linear-gradient(to bottom, ${deckColor}20, transparent)`, pointerEvents: 'none', zIndex: -1 }} />
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', position: 'relative' }}>
                                                    <h3 style={{ color: 'var(--text-main)', flex: 1, margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{deck.name || 'Mazo sin nombre'}</h3>
                                                    <button
                                                        onClick={() => handleLikeDeck(searchUser.trim().toLowerCase(), deck.id)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: deck.likes?.some(u => u.toLowerCase() === (currentUser || '').toLowerCase()) ? '#FF4D4D' : 'var(--text-secondary)' }}
                                                    >
                                                        <Heart size={18} fill={deck.likes?.some(u => u.toLowerCase() === (currentUser || '').toLowerCase()) ? '#FF4D4D' : 'none'} />
                                                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{deck.likes?.length || 0}</span>
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
                                    );
                                })}
                            </>
                        )}
                    </div>
                )}

                {/* Grid de todos los usuarios registrados */}
                <h2 style={{ marginTop: '3rem', marginBottom: '1.5rem', paddingLeft: '0.5rem' }}>Directorio de Peleadores ({allUsers.length})</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
                    {allUsers.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>Cargando peleadores...</p>}
                    {allUsers.map(user => {
                        const attrColor = user.attribute ? `var(--attr-${user.attribute.toLowerCase()})` : 'var(--accent-color)';
                        return (
                            <div
                                key={user.username}
                                onClick={() => handleUserClick(user)}
                                className="glass-panel"
                                style={{
                                    padding: '1.5rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    borderTop: `4px solid ${attrColor}`,
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-5px)';
                                    e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.4)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <div style={{ border: `3px solid ${attrColor}`, borderRadius: '50%', padding: '3px', marginBottom: '1rem' }}>
                                    <UserAvatar username={user.username} size={70} overrideAvatar={user.avatar} />
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', textAlign: 'center', color: '#fff' }}>@{user.username}</h3>
                                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.8rem', borderRadius: '12px', fontSize: '0.8rem', color: attrColor, marginTop: '0.5rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                    {user.attribute ? `${user.attribute} Brawler` : 'Peleador Novato'}
                                </div>
                            </div>
                        );
                    })}
                </div>

            </div>
            {renderUserProfileModal()}
            {renderDeckViewer()}
        </>
    );
}
