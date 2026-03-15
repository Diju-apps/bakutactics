import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { Shield, Trash2, Edit2 } from 'lucide-react';
import { compressImage } from '../utils/imageOptimization';

interface BloxuganRegistrationProps {
    currentUser: string | null;
}

export interface BloxuganData {
    id: string;
    name: string;
    attribute: string;
    tier?: string;
    poderG: number;
    image?: string;
}

export default function BloxuganRegistration({ currentUser }: BloxuganRegistrationProps) {
    const [bloxugans, setBloxugans] = useState<BloxuganData[]>([]);

    // Form state
    const [name, setName] = useState('');
    const [attribute, setAttribute] = useState('Pyrus');
    const [poderG, setPoderG] = useState<number | ''>('');
    const [imageStr, setImageStr] = useState<string>('');
    const [tier, setTier] = useState('A');
    const [editingId, setEditingId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filter states
    const [filterAttribute, setFilterAttribute] = useState('Todos');
    const [filterTier, setFilterTier] = useState('Todos');

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            // Comprimimos al máximo: 250px de ancho y calidad ultra baja (0.3)
            const optimizedBase64 = await compressImage(file, 250, 0.3);
            setImageStr(optimizedBase64);
        } catch (error) {
            console.error("Error al comprimir imagen:", error);
            alert("Error al procesar la imagen");
        }
    };

    useEffect(() => {
        const colRef = collection(db, 'bloxugans');
        const unsubscribe = onSnapshot(colRef, (snapshot) => {
            const bList: BloxuganData[] = [];
            snapshot.forEach(doc => {
                bList.push({ id: doc.id, ...doc.data() } as BloxuganData);
            });
            // Sort by name or date, let's do name for now
            bList.sort((a, b) => a.name.localeCompare(b.name));
            setBloxugans(bList);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || poderG === '') return;

        try {
            if (editingId) {
                const docRef = doc(db, 'bloxugans', editingId);
                await updateDoc(docRef, {
                    name: name.trim(),
                    attribute,
                    poderG: Number(poderG),
                    image: imageStr || null,
                    tier,
                    baseG: deleteField(),
                    currentLevel: deleteField(),
                    prestiges: deleteField(),
                    permitePrestigio: deleteField(),
                    limitePrestigios: deleteField()
                });
                setEditingId(null);
            } else {
                await addDoc(collection(db, 'bloxugans'), {
                    name: name.trim(),
                    attribute,
                    poderG: Number(poderG),
                    image: imageStr || null,
                    tier
                });
            }
            setName('');
            setPoderG('');
            setImageStr('');
            setTier('A');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            // Keep selected attribute or reset it
        } catch (err) {
            console.error("Error registering bloxugan:", err);
            alert("Error al registrar Bloxugan");
        }
    };

    const handleEditClick = (b: BloxuganData) => {
        setEditingId(b.id);
        setName(b.name);
        setAttribute(b.attribute);
        setPoderG(b.poderG || 0);
        setImageStr(b.image || '');
        setTier(b.tier || 'A');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setName('');
        setPoderG('');
        setImageStr('');
        setTier('A');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };


    const handleDelete = async (id: string) => {
        if (window.confirm('¿Seguro que deseas eliminar este Bloxugan?')) {
            try {
                await deleteDoc(doc(db, 'bloxugans', id));
            } catch (err) {
                console.error(err);
            }
        }
    };

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

    return (
        <div className="container animate-fade-in" style={{ paddingBottom: '4rem' }}>
            <section className="glass-panel main-section" style={{ marginBottom: '2rem' }}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Shield color="var(--accent-color)" size={32} />
                    {editingId ? 'Editar Bloxugan' : 'Registro de Bloxugans (Admin)'}
                </h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    {editingId ? 'Modifica los atributos y estadísticas principales de este Bloxugan.' : 'Añade nuevos Bloxugans a la base de datos oficial del juego.'}
                </p>

                <form onSubmit={handleRegister} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Nombre del Bloxugan</label>
                        <input
                            type="text"
                            className="search-bar"
                            style={{ padding: '0.8rem 1rem', marginBottom: 0 }}
                            placeholder="Ej. Dragonoid"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Atributo</label>
                        <select
                            className="search-bar"
                            style={{ padding: '0.8rem 1rem', marginBottom: 0, appearance: 'auto', background: 'var(--panel-bg)' }}
                            value={attribute}
                            onChange={e => setAttribute(e.target.value)}
                        >
                            <option value="Pyrus">Pyrus</option>
                            <option value="Aquos">Aquos</option>
                            <option value="Ventus">Ventus</option>
                            <option value="Subterra">Subterra</option>
                            <option value="Haos">Haos</option>
                            <option value="Darkus">Darkus</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Tier</label>
                        <select
                            className="search-bar"
                            style={{ padding: '0.8rem 1rem', marginBottom: 0, appearance: 'auto', background: 'var(--panel-bg)' }}
                            value={tier}
                            onChange={e => setTier(e.target.value)}
                        >
                            <option value="A">Tier A</option>
                            <option value="B">Tier B</option>
                            <option value="C">Tier C</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Poder G</label>
                        <input
                            type="number"
                            className="search-bar"
                            style={{ padding: '0.8rem 1rem', marginBottom: 0 }}
                            placeholder="Ej. 340"
                            value={poderG}
                            onChange={e => setPoderG(e.target.value ? Number(e.target.value) : '')}
                            required
                            min="0"
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Imagen</label>
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleImageUpload}
                            className="search-bar"
                            style={{ padding: '0.6rem 1rem', marginBottom: 0, cursor: 'pointer', background: 'var(--panel-bg)' }}
                        />
                    </div>
                    {imageStr && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Vista Previa:</span>
                            <img src={imageStr} alt="Preview" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '1rem', alignSelf: 'end' }}>
                        <button type="submit" className="btn-primary" style={{ padding: '0.8rem 1.5rem', height: '42px' }}>
                            {editingId ? "Guardar Cambios" : "Registrar Bloxugan"}
                        </button>
                        {editingId && (
                            <button type="button" className="btn-secondary" style={{ padding: '0.8rem 1.5rem', height: '42px' }} onClick={cancelEdit}>
                                Cancelar
                            </button>
                        )}
                    </div>
                </form>
            </section>

            <section>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <h2 style={{ margin: 0 }}>Inventario de Bloxugans ({bloxugans.length})</h2>
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
                </div>

                <div className="cards-grid">
                    {bloxugans.filter(b => {
                        const attributeMatch = filterAttribute === 'Todos' || b.attribute.toLowerCase() === filterAttribute.toLowerCase();
                        const tierValue = b.tier || 'A';
                        const tierMatch = filterTier === 'Todos' || tierValue === filterTier;
                        return attributeMatch && tierMatch;
                    }).map(b => {
                        const attrColor = getAttrColor(b.attribute);
                        const displayTier = b.tier || 'A';

                        return (
                            <div key={b.id} className="glass-panel meta-card" style={{ borderTop: `4px solid ${attrColor}`, position: 'relative' }}>
                                <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => handleEditClick(b)}
                                        style={{ background: 'none', border: 'none', color: '#64C8FF', cursor: 'pointer', padding: '5px' }}
                                        title="Editar"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(b.id)}
                                        style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', padding: '5px' }}
                                        title="Eliminar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                        {b.image ? (
                                            <img src={b.image} alt={b.name} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '50%', border: `2px solid ${attrColor}` }} />
                                        ) : (
                                            <div style={{ width: '50px', height: '50px', borderRadius: '50%', border: `2px solid ${attrColor}`, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)' }}>
                                                <Shield size={24} color={attrColor} />
                                            </div>
                                        )}
                                        <div>
                                            <h3 style={{ fontSize: '1.3rem', marginBottom: '0.2rem' }}>{b.name}</h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ color: attrColor, fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase' }}>{b.attribute}</span>
                                                <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 'bold' }}>Tier {displayTier}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#fff' }}>{b.poderG} G</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Poder G</div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </section>
        </div>
    );
}
