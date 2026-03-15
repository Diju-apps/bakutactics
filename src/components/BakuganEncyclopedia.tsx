import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, query, where, orderBy, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Shield, Search, Info, Edit2, MessageCircle, Heart, X, Trash2 } from 'lucide-react';
import UserAvatar from './UserAvatar';
import type { BloxuganData } from './BloxuganRegistration';
import { getOptimizedImageUrl } from '../utils/imageOptimization';

interface CommentData {
    id: string;
    bloxuganId: string;
    user: string;
    text: string;
    timestamp: any;
    likes: string[];
}

interface MetaDataProps {
    currentUser: string | null;
    currentUserRole: string | null;
}

export default function BakuganEncyclopedia({ currentUser, currentUserRole }: MetaDataProps) {
    const [bloxugans, setBloxugans] = useState<BloxuganData[]>([]);
    
    // Filtros
    const [search, setSearch] = useState('');
    const [filterAttribute, setFilterAttribute] = useState('Todos');
    const [filterTier, setFilterTier] = useState('Todos');

    // Modal
    const [selectedBakugan, setSelectedBakugan] = useState<BloxuganData | null>(null);

    // Edición Admin
    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [editedDesc, setEditedDesc] = useState('');

    // Comentarios
    const [comments, setComments] = useState<CommentData[]>([]);
    const [newComment, setNewComment] = useState('');
    const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

    useEffect(() => {
        const colRef = collection(db, 'bloxugans');
        const unsubscribe = onSnapshot(colRef, (snapshot) => {
            const bList: BloxuganData[] = [];
            snapshot.forEach(docSnap => {
                bList.push({ id: docSnap.id, ...docSnap.data() } as BloxuganData);
            });
            bList.sort((a, b) => a.name.localeCompare(b.name));
            setBloxugans(bList);
            
            // Actualización segura en tiempo real del modal abierto sin corromper el hook
            setSelectedBakugan(prev => {
                if (!prev) return prev;
                const updated = bList.find(b => b.id === prev.id);
                // Solo si encontramos una actualización y es diferente, cambiamos la referencia
                if (updated && JSON.stringify(prev) !== JSON.stringify(updated)) {
                    return updated;
                }
                return prev;
            });
        });
        
        // Dependencia vacía [] para que el listener se declare UNA SOLA VEZ y no haga loop
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!selectedBakugan) return;

        const q = query(
            collection(db, 'bakugan_comments'),
            where('bloxuganId', '==', selectedBakugan.id),
            orderBy('timestamp', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const cList: CommentData[] = [];
            snapshot.forEach(docSnap => {
                cList.push({ id: docSnap.id, ...docSnap.data() } as CommentData);
            });
            setComments(cList);
        });

        return () => unsubscribe();
    }, [selectedBakugan]);

    const getAttrColor = (attr: string) => {
        switch (attr.toLowerCase()) {
            case 'pyrus': return 'var(--attr-pyrus)';
            case 'aquos': return 'var(--attr-aquos)';
            case 'ventus': return 'var(--attr-ventus)';
            case 'subterra': return 'var(--attr-subterra)';
            case 'haos': return 'var(--attr-haos)';
            case 'darkus': return 'var(--attr-darkus)';
            default: return '#fff';
        }
    };

    const handleSaveDescription = async () => {
        if (!selectedBakugan) return;
        try {
            await updateDoc(doc(db, 'bloxugans', selectedBakugan.id), {
                description: editedDesc
            });
            setIsEditingDesc(false);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !currentUser || !selectedBakugan) return;

        try {
            const commentText = newComment.trim();
            // Limpia el input inmediatamente para mejor UX
            setNewComment('');

            const docRef = await addDoc(collection(db, 'bakugan_comments'), {
                bloxuganId: selectedBakugan.id,
                user: currentUser,
                text: commentText,
                timestamp: serverTimestamp(),
                likes: []
            });

            // Actualización optimista del estado local para feedback instantáneo
            const newCommentObj: CommentData = {
                id: docRef.id,
                bloxuganId: selectedBakugan.id,
                user: currentUser,
                text: commentText,
                timestamp: new Date(), // Timestamp local temporal
                likes: []
            };

            setComments(prev => [newCommentObj, ...prev]);

        } catch (err) {
            console.error(err);
        }
    };

    const handleLikeComment = async (commentId: string, currentLikes: string[]) => {
        if (!currentUser) return; // Puede pedir logueo

        const userLower = currentUser.toLowerCase();
        let newLikes = [...currentLikes];
        if (newLikes.includes(userLower)) {
            newLikes = newLikes.filter(u => u !== userLower);
        } else {
            newLikes.push(userLower);
        }

        try {
            await updateDoc(doc(db, 'bakugan_comments', commentId), {
                likes: newLikes
            });
        } catch (err) {
            console.error(err);
        }
    };

    const confirmDeleteComment = async () => {
        if (!commentToDelete) return;
        try {
            await deleteDoc(doc(db, 'bakugan_comments', commentToDelete));
            setComments(prev => prev.filter(c => c.id !== commentToDelete));
            setCommentToDelete(null);
        } catch (err) {
            console.error(err);
        }
    };

    const openModal = (b: BloxuganData) => {
        setSelectedBakugan(b);
        setEditedDesc((b as any).description || '');
        setIsEditingDesc(false);
    };

    const closeModal = () => {
        setSelectedBakugan(null);
    };

    return (
        <>
            <div className="container animate-fade-in" style={{ paddingBottom: '4rem' }}>
                <section className="glass-panel main-section" style={{ marginBottom: '2rem' }}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0 0 1.5rem 0' }}>
                    <Info color="var(--accent-color)" size={32} />
                    Catálogo de Bakugans
                </h1>

                <div className="search-container" style={{ position: 'relative', marginBottom: '1.5rem' }}>
                    <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input
                        type="text"
                        className="search-bar"
                        placeholder="Buscar por nombre..."
                        style={{ paddingLeft: '3rem', marginBottom: 0 }}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Atributo:</span>
                        <select
                            className="search-bar"
                            style={{ padding: '0.6rem 1rem', marginBottom: 0, appearance: 'auto', minWidth: '150px' }}
                            value={filterAttribute}
                            onChange={e => setFilterAttribute(e.target.value)}
                        >
                            <option value="Todos">Todos</option>
                            <option value="Pyrus">Pyrus</option>
                            <option value="Aquos">Aquos</option>
                            <option value="Ventus">Ventus</option>
                            <option value="Subterra">Subterra</option>
                            <option value="Haos">Haos</option>
                            <option value="Darkus">Darkus</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Tier:</span>
                        <select
                            className="search-bar"
                            style={{ padding: '0.6rem 1rem', marginBottom: 0, appearance: 'auto', minWidth: '120px' }}
                            value={filterTier}
                            onChange={e => setFilterTier(e.target.value)}
                        >
                            <option value="Todos">Todos</option>
                            <option value="A">Tier A</option>
                            <option value="B">Tier B</option>
                            <option value="C">Tier C</option>
                        </select>
                    </div>
                </div>
            </section>

            <div className="cards-grid">
                {bloxugans.filter(b => {
                    const searchMatch = b.name.toLowerCase().includes(search.toLowerCase());
                    const attributeMatch = filterAttribute === 'Todos' || b.attribute.toLowerCase() === filterAttribute.toLowerCase();
                    const tierMatch = filterTier === 'Todos' || (b.tier || 'A') === filterTier;
                    return searchMatch && attributeMatch && tierMatch;
                }).map(b => {
                    const attrColor = getAttrColor(b.attribute);
                    return (
                        <div 
                            key={b.id} 
                            className="glass-panel meta-card" 
                            style={{ borderTop: `4px solid ${attrColor}`, cursor: 'pointer', transition: 'transform 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}
                            onClick={() => openModal(b)}
                        >
                            {b.image ? (
                                <img src={getOptimizedImageUrl(b.image, 250)} alt={b.name} style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '50%', border: `3px solid ${attrColor}` }} />
                            ) : (
                                <div style={{ width: '100px', height: '100px', borderRadius: '50%', border: `3px solid ${attrColor}`, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)' }}>
                                    <Shield size={36} color={attrColor} />
                                </div>
                            )}
                            <div style={{ textAlign: 'center' }}>
                                <h3 style={{ fontSize: '1.4rem', margin: '0 0 0.5rem 0' }}>{b.name}</h3>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                    <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: attrColor, fontSize: '0.8rem', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>{b.attribute}</span>
                                    <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.8rem', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 'bold' }}>Tier {b.tier || 'A'}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            </div>

            {selectedBakugan && (
                <div className="modal-overlay" onClick={closeModal} style={{ zIndex: 10005 }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: '#111116', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxWidth: '1000px', width: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                        <button className="modal-close" onClick={closeModal}><X size={24} /></button>
                        
                        <div style={{ padding: '2rem', flex: 1, overflowY: 'auto' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                                
                                {/* Columna Izquierda: Detalles del Bakugan */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                        {selectedBakugan.image ? (
                                            <img src={getOptimizedImageUrl(selectedBakugan.image, 400)} alt={selectedBakugan.name} style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '16px', border: `4px solid ${getAttrColor(selectedBakugan.attribute)}`, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }} />
                                        ) : (
                                            <div style={{ width: '150px', height: '150px', borderRadius: '16px', border: `4px solid ${getAttrColor(selectedBakugan.attribute)}`, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                                                <Shield size={64} color={getAttrColor(selectedBakugan.attribute)} />
                                            </div>
                                        )}
                                        
                                        <div>
                                            <h2 style={{ fontSize: '2.5rem', margin: '0 0 0.5rem 0' }}>{selectedBakugan.name}</h2>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                                                <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: getAttrColor(selectedBakugan.attribute), padding: '0.3rem 0.8rem', borderRadius: '8px', fontWeight: 'bold' }}>{selectedBakugan.attribute.toUpperCase()}</span>
                                                <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', padding: '0.3rem 0.8rem', borderRadius: '8px', fontWeight: 'bold' }}>TIER {selectedBakugan.tier || 'A'}</span>
                                                <span style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: '#FFD700', padding: '0.3rem 0.8rem', borderRadius: '8px', fontWeight: 'bold' }}>{selectedBakugan.poderG} G</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--accent-color)' }}>Descripción del Bakugan</h3>
                                            {currentUserRole === 'admin' && !isEditingDesc && (
                                                <button 
                                                    onClick={() => setIsEditingDesc(true)}
                                                    style={{ background: 'none', border: 'none', color: '#64C8FF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem' }}
                                                >
                                                    <Edit2 size={14} /> Editar
                                                </button>
                                            )}
                                        </div>
                                        
                                        {isEditingDesc ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                <textarea
                                                    className="search-bar"
                                                    style={{ width: '100%', minHeight: '150px', padding: '1rem', marginBottom: 0, resize: 'vertical' }}
                                                    value={editedDesc}
                                                    onChange={e => setEditedDesc(e.target.value)}
                                                    placeholder="Añade la lore y detalles de este Bakugan..."
                                                />
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                    <button className="btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={() => { setIsEditingDesc(false); setEditedDesc((selectedBakugan as any).description || ''); }}>Cancelar</button>
                                                    <button className="btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={handleSaveDescription}>Guardar</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p style={{ lineHeight: '1.6', color: 'var(--text-main)', whiteSpace: 'pre-wrap', margin: 0 }}>
                                                {(selectedBakugan as any).description || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No hay descripción disponible.</span>}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Columna Derecha: Comentarios */}
                                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '2rem' }}>
                                    <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <MessageCircle size={20} color="var(--accent-color)" />
                                        Comentarios de la Comunidad ({comments.length})
                                    </h3>

                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '0.5rem', marginBottom: '1.5rem' }}>
                                        {comments.map(c => {
                                            const hasLiked = currentUser && c.likes?.includes(currentUser.toLowerCase());
                                            
                                            // Handle Firestore Timestamp formatting
                                            const dateObj = c.timestamp?.toDate ? c.timestamp.toDate() : new Date();
                                            const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' });

                                            return (
                                                <div key={c.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <UserAvatar username={c.user} size={28} />
                                                            <div>
                                                                <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '0.95rem', display: 'block' }}>@{c.user}</span>
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{dateStr}</span>
                                                            </div>
                                                        </div>
                                                        
                                                        {currentUserRole === 'admin' || (currentUser && currentUser.toLowerCase() === c.user.toLowerCase()) ? (
                                                            <button onClick={() => setCommentToDelete(c.id)} style={{ background: 'none', border: 'none', color: '#FF4D4D', cursor: 'pointer', padding: '0.2rem' }} title="Eliminar">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                    
                                                    <p style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', whiteSpace: 'pre-wrap', color: '#eaeaea' }}>
                                                        {c.text}
                                                    </p>

                                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                        <button 
                                                            onClick={() => handleLikeComment(c.id, c.likes || [])}
                                                            style={{ 
                                                                background: hasLiked ? 'rgba(255, 77, 77, 0.1)' : 'rgba(255,255,255,0.05)', 
                                                                border: 'none', 
                                                                cursor: currentUser ? 'pointer' : 'not-allowed', 
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                gap: '0.4rem', 
                                                                padding: '0.4rem 0.8rem',
                                                                borderRadius: '20px',
                                                                color: hasLiked ? '#FF4D4D' : 'var(--text-secondary)',
                                                                transition: 'all 0.2s',
                                                                opacity: currentUser ? 1 : 0.5
                                                            }}
                                                            title={currentUser ? "Dar corazón" : "Inicia sesión para interactuar"}
                                                        >
                                                            <Heart size={14} fill={hasLiked ? '#FF4D4D' : 'none'} color={hasLiked ? '#FF4D4D' : 'currentColor'} />
                                                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{c.likes?.length || 0}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {comments.length === 0 && (
                                            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-secondary)' }}>
                                                <MessageCircle size={32} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                                                <p style={{ margin: 0 }}>Nadie ha comentado sobre este Bakugan aún.</p>
                                            </div>
                                        )}
                                    </div>

                                    {currentUser ? (
                                        <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                            <input
                                                type="text"
                                                className="search-bar"
                                                style={{ marginBottom: 0, flex: 1 }}
                                                placeholder="Añade tu opinión o táctica..."
                                                value={newComment}
                                                onChange={e => setNewComment(e.target.value)}
                                            />
                                            <button type="submit" className="btn-primary" style={{ padding: '0 1.2rem', whiteSpace: 'nowrap' }} disabled={!newComment.trim()}>
                                                Comentar
                                            </button>
                                        </form>
                                    ) : (
                                        <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'center', marginTop: 'auto' }}>
                                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Inicia sesión para dejar un comentario.</p>
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Confirmación Eliminar Comentario */}
            {commentToDelete && (
                <div className="modal-overlay" onClick={() => setCommentToDelete(null)} style={{ zIndex: 10010 }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: '#111116', border: '1px solid rgba(255, 77, 77, 0.3)', borderRadius: '16px', padding: '2rem', maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 8px 32px rgba(255, 77, 77, 0.15)' }}>
                        <h3 style={{ marginBottom: '1rem', color: '#eaeaea', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <Trash2 size={24} color="#FF4D4D" />
                            Eliminar Comentario
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                            ¿Estás seguro que deseas eliminar esta táctica? <br />
                            <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>Esta acción no se puede deshacer.</span>
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button className="btn-secondary" style={{ padding: '0.6rem 1.5rem', flex: 1 }} onClick={() => setCommentToDelete(null)}>Cancelar</button>
                            <button className="btn-primary" style={{ padding: '0.6rem 1.5rem', flex: 1, background: 'rgba(255, 77, 77, 0.15)', color: '#FF4D4D', border: '1px solid rgba(255, 77, 77, 0.3)', fontWeight: 'bold' }} onClick={confirmDeleteComment}>Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
