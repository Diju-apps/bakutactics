import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
    collection, 
    addDoc, 
    query, 
    where, 
    onSnapshot, 
    deleteDoc, 
    doc, 
    getDocs, 
    serverTimestamp,
    updateDoc 
} from 'firebase/firestore';
import { Trophy, Skull, BarChart3, TrendingUp, Plus, Filter, Save, AlertCircle, Trash2, Edit2 } from 'lucide-react';

interface Match {
    id: string;
    username: string;
    myDeck: string;
    opponentAttr: string;
    result: 'Victoria' | 'Derrota';
    notes: string;
    createdAt: any;
    displayDate: string;
}

const ATTRIBUTES = ['Pyrus', 'Haos', 'Aquos', 'Subterra', 'Ventus', 'Darkus', 'Mixtos'];

export default function BakuTracker({ currentUser }: { currentUser: string | null }) {
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentFilter, setCurrentFilter] = useState('Todos');
    
    // Form state
    const [myDeck, setMyDeck] = useState('');
    const [opponentAttr, setOpponentAttr] = useState('');
    const [isWin, setIsWin] = useState(true);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

    const startEdit = (match: Match) => {
        setEditingMatchId(match.id);
        setMyDeck(match.myDeck);
        setOpponentAttr(match.opponentAttr);
        setIsWin(match.result === 'Victoria');
        setNotes(match.notes || '');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingMatchId(null);
        setMyDeck('');
        setOpponentAttr('');
        setIsWin(true);
        setNotes('');
    };

    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, "matches"), 
            where("username", "==", currentUser)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const matchesData: Match[] = [];
            snapshot.forEach((doc) => {
                matchesData.push({ id: doc.id, ...doc.data() } as Match);
            });
            
            // Ordenamos en el cliente. Usamos Date.now() como fallback para registros locales pendientes de sincronizar
            matchesData.sort((a, b) => {
                const getMs = (ts: any) => {
                    if (!ts) return Date.now();
                    if (typeof ts.toMillis === 'function') return ts.toMillis();
                    if (ts instanceof Date) return ts.getTime();
                    return 0;
                };
                return getMs(b.createdAt) - getMs(a.createdAt);
            });

            setMatches(matchesData);
            setLoading(false);
        }, (error) => {
            console.error("Firestore Error detail:", error);
            // Si hay un error de permisos o índice, al menos dejamos de mostrar "Sincronizando..."
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const handleSaveMatch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !opponentAttr || !myDeck.trim()) return;

        setSaving(true);
        try {
            if (editingMatchId) {
                const matchRef = doc(db, "matches", editingMatchId);
                await updateDoc(matchRef, {
                    myDeck: myDeck.trim(),
                    opponentAttr,
                    result: isWin ? 'Victoria' : 'Derrota',
                    notes: notes.trim(),
                });
                setEditingMatchId(null);
            } else {
                await addDoc(collection(db, "matches"), {
                    username: currentUser,
                    myDeck: myDeck.trim(),
                    opponentAttr,
                    result: isWin ? 'Victoria' : 'Derrota',
                    notes: notes.trim(),
                    createdAt: serverTimestamp(),
                    displayDate: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            }
            
            // Reset form
            setMyDeck('');
            setOpponentAttr('');
            setIsWin(true);
            setNotes('');
        } catch (error) {
            console.error("Error saving match:", error);
            alert("Error al guardar la partida.");
        } finally {
            setSaving(false);
        }
    };

    const deleteSingleMatch = async (matchId: string) => {
        if (window.confirm("¿Borrar esta partida?")) {
            try {
                await deleteDoc(doc(db, "matches", matchId));
            } catch (error) {
                console.error("Error deleting match:", error);
            }
        }
    };

    const [showConfirmClear, setShowConfirmClear] = useState(false);

    const clearHistory = async () => {
        if (!currentUser || matches.length === 0) return;
        
        try {
            const q = query(collection(db, "matches"), where("username", "==", currentUser));
            const querySnapshot = await getDocs(q);
            const deletePromises = querySnapshot.docs.map(item => deleteDoc(doc(db, "matches", item.id)));
            await Promise.all(deletePromises);
            setShowConfirmClear(false);
        } catch (error) {
            console.error("Error clearing history:", error);
            alert("Error al limpiar el historial.");
        }
    };

    const filteredMatches = currentFilter === 'Todos' 
        ? matches 
        : matches.filter(m => m.opponentAttr === currentFilter);

    // Stats calculations
    const stats = {
        total: filteredMatches.length,
        wins: filteredMatches.filter(m => m.result === 'Victoria').length,
        losses: filteredMatches.filter(m => m.result === 'Derrota').length,
    };
    
    const winRate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : "0";
    const lossRate = stats.total > 0 ? ((stats.losses / stats.total) * 100).toFixed(1) : "0";

    if (!currentUser) {
        return (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem', marginTop: '2rem' }}>
                <h2 style={{ color: 'var(--accent-color)', marginBottom: '1rem' }}>Sincronización requerida</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Inicia sesión en BakuTactics para empezar a registrar tus partidas y ver tus estadísticas personalizadas.</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '4rem' }}>
            <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
                <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                    Baku<span style={{ color: 'var(--accent-color)' }}>Tracker</span>
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', letterSpacing: '2px', textTransform: 'uppercase' }}>
                    Registro de Combate y Análisis Estratégico
                </p>
            </header>

            {/* Stats Panel */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                gap: '1.5rem', 
                marginBottom: '3rem' 
            }}>
                <div className="glass-panel" style={{ textAlign: 'center', padding: '1.5rem', borderBottom: '3px solid var(--accent-color)' }}>
                    <BarChart3 size={24} style={{ marginBottom: '0.5rem', color: 'var(--accent-color)' }} />
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Partidas</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{stats.total}</div>
                </div>
                <div className="glass-panel" style={{ textAlign: 'center', padding: '1.5rem', borderBottom: '3px solid #10b981' }}>
                    <Trophy size={24} style={{ marginBottom: '0.5rem', color: '#10b981' }} />
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Victorias</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#10b981' }}>{stats.wins}</div>
                </div>
                <div className="glass-panel" style={{ textAlign: 'center', padding: '1.5rem', borderBottom: '3px solid #ef4444' }}>
                    <Skull size={24} style={{ marginBottom: '0.5rem', color: '#ef4444' }} />
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Derrotas</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ef4444' }}>{stats.losses}</div>
                </div>
                <div className="glass-panel" style={{ textAlign: 'center', padding: '1.5rem', borderBottom: '3px solid #3b82f6' }}>
                    <TrendingUp size={24} style={{ marginBottom: '0.5rem', color: '#3b82f6' }} />
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Win Rate</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#3b82f6' }}>{winRate}%</div>
                </div>
                <div className="glass-panel" style={{ textAlign: 'center', padding: '1.5rem', borderBottom: '3px solid #a78bfa' }}>
                    <TrendingUp size={24} style={{ marginBottom: '0.5rem', color: '#a78bfa', transform: 'scaleY(-1)' }} />
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Loss Rate</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#a78bfa' }}>{lossRate}%</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 400px) 1fr', gap: '2.5rem' }}>
                
                {/* Form Column */}
                <div style={{ position: 'sticky', top: '2rem' }}>
                    <div className="glass-panel" style={{ padding: '2rem' }}>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                             {editingMatchId ? <Edit2 size={20} color="var(--accent-color)" /> : <Plus size={20} color="var(--accent-color)" />} 
                             {editingMatchId ? 'Editar Combate' : 'Registrar Combate'}
                        </h2>
                        
                        <form onSubmit={handleSaveMatch} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Mi Mazo / Estrategia</label>
                                <input 
                                    type="text" 
                                    className="search-bar" 
                                    style={{ marginBottom: 0, paddingLeft: '1rem' }}
                                    placeholder="Ej: Darkus Aggro Control"
                                    required
                                    value={myDeck}
                                    onChange={(e) => setMyDeck(e.target.value)}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Atributo del Rival</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {ATTRIBUTES.map(attr => (
                                        <button
                                            key={attr}
                                            type="button"
                                            onClick={() => setOpponentAttr(attr)}
                                            style={{
                                                padding: '0.5rem 0.8rem',
                                                borderRadius: '8px',
                                                border: '1px solid var(--border-color)',
                                                background: opponentAttr === attr ? `var(--attr-${attr.toLowerCase()})` : 'rgba(255,255,255,0.05)',
                                                color: opponentAttr === attr ? (attr === 'Haos' ? '#111' : '#fff') : 'var(--text-secondary)',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                textTransform: 'uppercase'
                                            }}
                                        >
                                            {attr}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Resultado</label>
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '1.5rem', 
                                    background: 'rgba(0,0,0,0.2)', 
                                    padding: '1rem', 
                                    borderRadius: '12px',
                                    justifyContent: 'center',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.8rem', opacity: isWin ? 0.3 : 1 }}>DERROTA</span>
                                    <label style={{ 
                                        position: 'relative', 
                                        display: 'inline-block', 
                                        width: '60px', 
                                        height: '30px',
                                        cursor: 'pointer'
                                    }}>
                                        <input 
                                            type="checkbox" 
                                            checked={isWin} 
                                            onChange={(e) => setIsWin(e.target.checked)} 
                                            style={{ opacity: 0, width: 0, height: 0 }}
                                        />
                                        <span style={{ 
                                            position: 'absolute', 
                                            top: 0, left: 0, right: 0, bottom: 0, 
                                            background: isWin ? '#10b981' : '#ef4444', 
                                            transition: '0.4s', 
                                            borderRadius: '34px' 
                                        }}></span>
                                        <span style={{ 
                                            position: 'absolute', 
                                            height: '22px', width: '22px', 
                                            left: isWin ? '34px' : '4px', 
                                            bottom: '4px', 
                                            background: '#fff', 
                                            transition: '0.4s', 
                                            borderRadius: '50%' 
                                        }}></span>
                                    </label>
                                    <span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.8rem', opacity: isWin ? 1 : 0.3 }}>VICTORIA</span>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Notas (Opcional)</label>
                                <textarea 
                                    className="search-bar" 
                                    style={{ width: '100%', minHeight: '80px', padding: '1rem', resize: 'vertical', marginBottom: 0 }}
                                    placeholder="Estrategia usada, cartas clave del rival..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                {editingMatchId && (
                                    <button 
                                        type="button" 
                                        className="btn-secondary" 
                                        style={{ flex: 1 }}
                                        onClick={cancelEdit}
                                    >
                                        Cancelar
                                    </button>
                                )}
                                <button 
                                    type="submit" 
                                    className="btn-primary" 
                                    disabled={saving}
                                    style={{ 
                                        flex: editingMatchId ? 2 : 1,
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        gap: '0.5rem',
                                        width: editingMatchId ? 'auto' : '100%'
                                    }}
                                >
                                    <Save size={18} /> {saving ? 'Guardando...' : editingMatchId ? 'Actualizar' : 'Guardar Partida'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* History Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Filter size={20} color="var(--accent-color)" /> Historial 
                            {currentFilter !== 'Todos' && <span style={{ fontSize: '0.9rem', color: 'var(--accent-color)' }}>({currentFilter})</span>}
                        </h2>
                        <button 
                            onClick={() => setShowConfirmClear(true)}
                            className="btn-secondary"
                            style={{ 
                                padding: '0.5rem 1rem', 
                                fontSize: '0.8rem', 
                                borderColor: 'rgba(255, 77, 77, 0.3)',
                                color: 'rgba(255, 77, 77, 0.9)'
                            }}
                        >
                            <Trash2 size={16} /> Limpiar Historial
                        </button>
                    </div>

                    {/* Filter Bar */}
                    <div className="glass-panel" style={{ padding: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)' }}>
                        {['Todos', ...ATTRIBUTES].map(f => (
                            <button
                                key={f}
                                onClick={() => setCurrentFilter(f)}
                                style={{
                                    padding: '0.4rem 1rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: currentFilter === f ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)',
                                    color: currentFilter === f ? '#fff' : 'var(--text-secondary)',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {f}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '3rem' }}>Sincronizando registros...</p>
                    ) : filteredMatches.length === 0 ? (
                        <div style={{ 
                            textAlign: 'center', 
                            padding: '5rem 2rem', 
                            color: 'var(--text-secondary)', 
                            border: '2px dashed var(--border-color)', 
                            borderRadius: '20px',
                            background: 'rgba(255,255,255,0.01)'
                        }}>
                            {currentFilter === 'Todos' 
                                ? 'No tienes partidas registradas. ¡Registra tu primera victoria hoy!' 
                                : `No hay partidas registradas contra el atributo ${currentFilter}.`}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {filteredMatches.map(match => (
                                <div 
                                    key={match.id} 
                                    className="glass-panel" 
                                    style={{ 
                                        padding: '1.5rem', 
                                        display: 'grid', 
                                        gridTemplateColumns: '1fr auto', 
                                        alignItems: 'center', 
                                        gap: '1rem',
                                        borderLeft: `5px solid ${match.result === 'Victoria' ? '#10b981' : '#ef4444'}`
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {match.myDeck} 
                                            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>VS</span> 
                                            <span style={{ 
                                                fontSize: '0.85rem', 
                                                color: `var(--attr-${match.opponentAttr.toLowerCase()})`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                background: 'rgba(0,0,0,0.3)',
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '6px'
                                            }}>
                                                <span style={{ 
                                                    width: '8px', 
                                                    height: '8px', 
                                                    borderRadius: '50%', 
                                                    background: `var(--attr-${match.opponentAttr.toLowerCase()})`,
                                                    boxShadow: `0 0 8px var(--attr-${match.opponentAttr.toLowerCase()})`
                                                }}></span>
                                                {match.opponentAttr.toUpperCase()}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span>{match.displayDate}</span>
                                        </div>
                                        {match.notes && (
                                            <div style={{ 
                                                marginTop: '1rem', 
                                                fontSize: '0.9rem', 
                                                color: 'var(--text-secondary)', 
                                                padding: '0.75rem 1rem', 
                                                background: 'rgba(0,0,0,0.2)', 
                                                borderRadius: '8px',
                                                borderLeft: '2px solid var(--accent-color)',
                                                lineHeight: 1.5
                                            }}>
                                                {match.notes}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ 
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.5rem',
                                        alignItems: 'flex-end'
                                    }}>
                                        <div style={{ 
                                            padding: '0.5rem 1rem', 
                                            borderRadius: '10px', 
                                            fontWeight: 900, 
                                            fontSize: '0.8rem', 
                                            background: match.result === 'Victoria' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            color: match.result === 'Victoria' ? '#10b981' : '#ef4444',
                                            textTransform: 'uppercase'
                                        }}>
                                            {match.result}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button 
                                                onClick={() => startEdit(match)}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.2rem', transition: 'color 0.2s' }}
                                                title="Editar"
                                                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-color)'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button 
                                                onClick={() => deleteSingleMatch(match.id)}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.2rem', transition: 'color 0.2s' }}
                                                title="Eliminar"
                                                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Premium Confirmation Modal */}
            {showConfirmClear && (
                <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowConfirmClear(false)}>
                    <div 
                        className="modal-content glass-panel" 
                        style={{ maxWidth: '450px', padding: '2.5rem', textAlign: 'center' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ 
                            width: '60px', 
                            height: '60px', 
                            borderRadius: '50%', 
                            background: 'rgba(255, 77, 77, 0.1)', 
                            display: 'grid', 
                            placeItems: 'center', 
                            margin: '0 auto 1.5rem',
                            border: '1px solid rgba(255, 77, 77, 0.2)'
                        }}>
                             <AlertCircle size={32} color="#FF4D4D" />
                        </div>
                        
                        <h2 style={{ marginBottom: '1rem' }}>¿Borrar historial?</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem', lineHeight: 1.6 }}>
                            Esta acción eliminará permanentemente todas tus partidas registradas de la base de datos de BakuTactics.
                        </p>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button 
                                className="btn-secondary" 
                                style={{ flex: 1 }} 
                                onClick={() => setShowConfirmClear(false)}
                            >
                                Cancelar
                            </button>
                            <button 
                                className="btn-primary" 
                                style={{ flex: 1, background: 'linear-gradient(135deg, #FF4D4D, #B32D2D)', boxShadow: '0 4px 15px rgba(255, 77, 77, 0.3)' }} 
                                onClick={clearHistory}
                            >
                                Borrar Todo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
