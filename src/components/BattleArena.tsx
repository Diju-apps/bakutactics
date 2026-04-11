import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, setDoc, getDoc, collection, Timestamp } from 'firebase/firestore';
import { Trophy, Shield, X } from 'lucide-react';
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
    isPublic?: boolean;
}

interface ScoreSet {
    winner: string | null;
}

interface BattleData {
    id: string;
    player1: string;
    player2: string;
    status: 'deck_selection' | 'playing' | 'completed';
    player1Deck?: Deck;
    player2Deck?: Deck;
    sets: {
        set1: ScoreSet;
        set2: ScoreSet;
        set3: ScoreSet;
    };
    winner?: string | null;
    createdAt?: any;
}

export default function BattleArena({ battleId, currentUser, onCancel }: { battleId: string, currentUser: string, onCancel: () => void }) {
    const [battle, setBattle] = useState<BattleData | null>(null);
    const [loading, setLoading] = useState(true);
    const [myDecks, setMyDecks] = useState<Deck[]>([]);
    const [selectedDeckId, setSelectedDeckId] = useState<string>('');
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        if (!battleId) return;

        const battleRef = doc(db, 'battles', battleId);
        const unsubscribe = onSnapshot(battleRef, (docSnap) => {
            if (docSnap.exists()) {
                setBattle(docSnap.data() as BattleData);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [battleId]);

    useEffect(() => {
        const fetchDecks = async () => {
            try {
                const deckDocRef = doc(db, 'user_decks', currentUser.toLowerCase());
                const deckSnap = await getDoc(deckDocRef);
                if (deckSnap.exists() && deckSnap.data().decks) {
                    setMyDecks(deckSnap.data().decks as Deck[]);
                }
            } catch (error) {
                console.error("Error fetching decks", error);
            }
        };
        fetchDecks();
    }, [currentUser]);

    const handleSelectDeck = async () => {
        if (!battle || !selectedDeckId) return;
        setIsUpdating(true);

        const deck = myDecks.find(d => d.id === selectedDeckId);
        if (!deck) return;

        const battleRef = doc(db, 'battles', battleId);
        const isPlayer1 = battle.player1.toLowerCase() === currentUser.toLowerCase();

        try {
            const updateObj: any = {};
            if (isPlayer1) {
                updateObj.player1Deck = deck;
            } else {
                updateObj.player2Deck = deck;
            }

            // Check if both decks are selected to change status
            const otherDeck = isPlayer1 ? battle.player2Deck : battle.player1Deck;
            if (otherDeck) {
                updateObj.status = 'playing';
            }

            await updateDoc(battleRef, updateObj);
        } catch (error) {
            console.error("Error updating deck", error);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleSetWinner = async (setKey: 'set1' | 'set2' | 'set3', winner: string | null) => {
        if (!battle || isUpdating) return;
        setIsUpdating(true);

        const battleRef = doc(db, 'battles', battleId);
        const newSets = { ...battle.sets };
        newSets[setKey].winner = winner;

        // Calculate Winner
        const p1 = battle.player1;
        const p2 = battle.player2;
        let p1Wins = 0;
        let p2Wins = 0;

        [newSets.set1, newSets.set2, newSets.set3].forEach(s => {
            if (s.winner === p1) p1Wins++;
            if (s.winner === p2) p2Wins++;
        });

        let battleWinner: string | null = null;
        let status = battle.status;

        if (p1Wins >= 2) {
            battleWinner = p1;
            status = 'completed';
        } else if (p2Wins >= 2) {
            battleWinner = p2;
            status = 'completed';
        }

        try {
            const updateObj: any = { sets: newSets, status };
            if (battleWinner) {
                updateObj.winner = battleWinner;
            } else {
                updateObj.winner = null; // Reset if someone changes it
            }
            await updateDoc(battleRef, updateObj);

            // If completed, save to history collection for easy reading
            if (battleWinner) {
                const historyRef = doc(collection(db, 'battle_history'));
                await setDoc(historyRef, {
                    player1: battle.player1,
                    player2: battle.player2,
                    player1Deck: battle.player1Deck,
                    player2Deck: battle.player2Deck,
                    sets: newSets,
                    winner: battleWinner,
                    createdAt: Timestamp.now()
                });
            }

        } catch (error) {
            console.error("Error setting set winner", error);
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando Campo de Batalla...</div>;
    if (!battle) return <div style={{ textAlign: 'center', padding: '3rem' }}>Combate no encontrado.</div>;

    const isPlayer1 = battle.player1.toLowerCase() === currentUser.toLowerCase();
    const myDeckSelected = isPlayer1 ? battle.player1Deck : battle.player2Deck;
    const opponentDeckSelected = isPlayer1 ? battle.player2Deck : battle.player1Deck;
    const opponent = isPlayer1 ? battle.player2 : battle.player1;

    return (
        <div className="animate-fade-in" style={{ padding: '2rem', maxWidth: '650px', width: '100%', margin: 'auto', background: '#0a0a0f', borderRadius: '16px', border: '1px solid var(--accent-color)', boxShadow: '0 0 30px rgba(0,0,0,0.9)', position: 'relative' }}>
            <button onClick={onCancel} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
            
            <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--accent-color)', fontSize: '2.5rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
                {battle.status === 'completed' ? 'Combate Finalizado' : 'Campo de Batalla'}
            </h1>

            {/* Players Comparison */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', flexWrap: 'wrap', gap: '2rem' }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ border: '4px solid var(--accent-color)', borderRadius: '50%', padding: '4px', display: 'inline-block' }}>
                        <UserAvatar username={battle.player1} size={80} />
                    </div>
                    <h3 style={{ marginTop: '0.5rem', fontSize: '1.2rem' }}>@{battle.player1}</h3>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {battle.player1Deck ? `Deck: ${battle.player1Deck.name}` : 'Eligiendo Deck...'}
                    </div>
                </div>

                <div style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-color)' }}>
                    VS
                </div>

                <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ border: '4px solid #ef4444', borderRadius: '50%', padding: '4px', display: 'inline-block' }}>
                        <UserAvatar username={battle.player2} size={80} />
                    </div>
                    <h3 style={{ marginTop: '0.5rem', fontSize: '1.2rem' }}>@{battle.player2}</h3>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {battle.player2Deck ? `Deck: ${battle.player2Deck.name}` : 'Eligiendo Deck...'}
                    </div>
                </div>
            </div>

            {battle.status === 'deck_selection' && !myDeckSelected && (
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1.5rem' }}>Selecciona tu Estrategia</h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', maxHeight: '280px', overflowY: 'auto', padding: '0.5rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {myDecks.length === 0 && (
                            <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                No tienes mazos creados o guardados aún.<br />Ve al <strong>Deck Builder</strong> para diseñar uno.
                            </div>
                        )}
                        {myDecks.map(deck => {
                             const aceBakugan = deck.bakugans.reduce((prev, current) => {
                                 const prevG = prev?.gpower ? Number(prev.gpower) : 0;
                                 const currG = current?.gpower ? Number(current.gpower) : 0;
                                 return (currG > prevG) ? current : prev;
                             }, deck.bakugans[0]);
                             const aceImage = aceBakugan?.imageUrl || null;
                             const colorAttr = aceBakugan?.attribute ? `var(--attr-${aceBakugan.attribute.toLowerCase()})` : 'var(--accent-color)';

                             return (
                                 <div 
                                      key={deck.id} 
                                      onClick={() => setSelectedDeckId(deck.id)}
                                      style={{ 
                                          background: 'rgba(255,255,255,0.03)', 
                                          borderRadius: '10px', 
                                          padding: '1rem', 
                                          border: selectedDeckId === deck.id ? `2px solid ${colorAttr}` : '1px solid rgba(255,255,255,0.08)', 
                                          cursor: 'pointer',
                                          position: 'relative',
                                          overflow: 'hidden',
                                          boxShadow: selectedDeckId === deck.id ? `0 0 12px ${colorAttr}50` : 'none',
                                          transform: selectedDeckId === deck.id ? 'scale(1.02)' : 'none',
                                          transition: 'all 0.2s',
                                          textAlign: 'left'
                                      }}
                                 >
                                      {aceImage && (
                                           <div style={{
                                               position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                               backgroundImage: `linear-gradient(to right, rgba(10, 10, 15, 0.9) 40%, rgba(10, 10, 15, 0.5) 100%), url(${getOptimizedImageUrl(aceImage, 300, 40)})`,
                                               backgroundSize: 'cover', backgroundPosition: 'center right',
                                               opacity: 0.7, zIndex: 0
                                           }} />
                                      )}
                                      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
                                           <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                                {deck.name || 'Sin nombre'}
                                           </div>
                                           <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.5rem' }}>
                                                {Array.from(new Set(deck.bakugans.filter(b => b.name).map(b => b.attribute.toLowerCase()))).map(attr => (
                                                    <span key={attr} className={`attr-${attr}`} style={{ fontSize: '0.65rem', fontWeight: 'bold', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(0,0,0,0.6)', textTransform: 'uppercase' }}>
                                                        {attr}
                                                    </span>
                                                ))}
                                           </div>
                                      </div>
                                 </div>
                             );
                        })}
                    </div>

                    <button className="btn-primary" style={{ width: '100%', padding: '0.8rem', fontSize: '1rem' }} onClick={handleSelectDeck} disabled={!selectedDeckId || isUpdating}>
                        {isUpdating ? 'Registrando...' : 'Confirmar Deck'}
                    </button>
                </div>
            )}

            {battle.status === 'deck_selection' && myDeckSelected && !opponentDeckSelected && (
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', marginBottom: '2rem', color: 'var(--text-secondary)' }}>
                    Esperando a que @{opponent} seleccione su deck...
                </div>
            )}

            {(battle.status === 'playing' || battle.status === 'completed') && (
                <div className="glass-panel" style={{ padding: '2rem', borderRadius: '12px' }}>
                    <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Shield /> Marcador (Al mejor de 3)
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {['set1', 'set2', 'set3'].map((setKey, index) => {
                            const setType = setKey as 'set1' | 'set2' | 'set3';
                            const winner = battle.sets[setType].winner;
                            
                            // Check if set is locked (e.g. if previous set has no winner)
                            const isLocked = index > 0 && !battle.sets[`set${index}` as 'set1' | 'set2'].winner;

                            return (
                                <div key={setKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', opacity: isLocked ? 0.5 : 1 }}>
                                    <div style={{ fontWeight: 'bold' }}>Set {index + 1}</div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button 
                                            className={`btn-secondary ${winner === battle.player1 ? 'active' : ''}`}
                                            style={{ 
                                                padding: '0.5rem 1rem', 
                                                fontSize: '0.85rem',
                                                background: winner === battle.player1 ? 'var(--accent-color)' : '',
                                                color: winner === battle.player1 ? '#000' : '#fff'
                                            }}
                                            disabled={isLocked || battle.status === 'completed' || isUpdating}
                                            onClick={() => handleSetWinner(setType, winner === battle.player1 ? null : battle.player1)}
                                        >
                                            Gana @{battle.player1}
                                        </button>
                                        <button 
                                            className={`btn-secondary ${winner === battle.player2 ? 'active' : ''}`}
                                            style={{ 
                                                padding: '0.5rem 1rem', 
                                                fontSize: '0.85rem',
                                                background: winner === battle.player2 ? '#ef4444' : '',
                                                color: winner === battle.player2 ? '#fff' : '#fff'
                                            }}
                                            disabled={isLocked || battle.status === 'completed' || isUpdating}
                                            onClick={() => handleSetWinner(setType, winner === battle.player2 ? null : battle.player2)}
                                        >
                                            Gana @{battle.player2}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {battle.status === 'completed' && (
                        <div style={{ marginTop: '2rem', textAlign: 'center', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '8px' }}>
                            <Trophy size={32} color="#10b981" style={{ margin: '0 auto 0.5rem auto' }} />
                            <h2 style={{ color: '#10b981' }}>Ganador: @{battle.winner}</h2>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
