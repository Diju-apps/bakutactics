import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { X, Save, Lock, User, Palette, Camera } from 'lucide-react';
import { compressImage } from '../utils/imageOptimization';

interface ProfileEditorProps {
    currentUser: string;
    onClose: () => void;
}

const ATTRIBUTES = [
    { name: 'Pyrus', color: 'var(--attr-pyrus)', value: 'pyrus' },
    { name: 'Aquos', color: 'var(--attr-aquos)', value: 'aquos' },
    { name: 'Ventus', color: 'var(--attr-ventus)', value: 'ventus' },
    { name: 'Subterra', color: 'var(--attr-subterra)', value: 'subterra' },
    { name: 'Haos', color: 'var(--attr-haos)', value: 'haos' },
    { name: 'Darkus', color: 'var(--attr-darkus)', value: 'darkus' },
];

export default function ProfileEditor({ currentUser, onClose }: ProfileEditorProps) {
    const [loading, setLoading] = useState(true);
    const [password, setPassword] = useState('');
    const [attribute, setAttribute] = useState('');
    const [avatar, setAvatar] = useState<string | null>(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const userRef = doc(db, 'users', currentUser.toLowerCase());
                const docSnap = await getDoc(userRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setPassword(data.pass || '');
                    setAttribute(data.attribute || '');
                    setAvatar(data.avatar || null);
                }
            } catch (e) {
                console.error(e);
            }
            setLoading(false);
        };
        fetchProfile();
    }, [currentUser]);

    const handleSave = async () => {
        if (!password.trim()) {
            setMessage('La contraseña no puede estar vacía.');
            return;
        }

        setMessage('');
        try {
            const userRef = doc(db, 'users', currentUser.toLowerCase());
            await updateDoc(userRef, {
                pass: password,
                attribute: attribute,
                avatar: avatar,
            });

            // Update userAttribute and avatar in user_decks for public display
            const decksRef = doc(db, 'user_decks', currentUser.toLowerCase());
            const decksSnap = await getDoc(decksRef);
            if (decksSnap.exists()) {
                await updateDoc(decksRef, {
                    userAttribute: attribute,
                    userAvatar: avatar || null
                });
            } else {
                await setDoc(decksRef, { userAttribute: attribute, userAvatar: avatar || null, decks: [] });
            }

            setMessage('¡Perfil actualizado con éxito!');
            setTimeout(() => {
                setMessage('');
                onClose();
            }, 1500);
        } catch (e) {
            console.error(e);
            setMessage('Error al guardar el perfil.');
        }
    };

    if (loading) return null;

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10005, padding: '1rem' }}>
            <div className="glass-panel animate-fade-in" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '400px', padding: '2rem', borderRadius: '16px', position: 'relative' }}>
                <button className="modal-close" onClick={onClose}><X size={20} /></button>
                <h2 style={{ marginBottom: '1.5rem', textAlign: 'center', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <User size={24} color="var(--accent-color)" /> Mi Perfil
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '50%', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '2rem', fontWeight: 'bold' }}>
                            {avatar ? <img src={avatar} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : currentUser.charAt(0).toUpperCase()}
                            <label style={{ position: 'absolute', bottom: 0, right: 0, background: '#111', color: '#fff', borderRadius: '50%', padding: '0.3rem', cursor: 'pointer', border: '2px solid var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Cambiar foto de perfil">
                                <Camera size={16} />
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    try {
                                        // Optimizamos el avatar: 120px es suficiente para círculos pequeños
                                        const optimizedBase64 = await compressImage(file, 120, 0.4);
                                        setAvatar(optimizedBase64);
                                    } catch (err) {
                                        console.error(err);
                                        setMessage('Error al procesar la imagen.');
                                    }
                                }} />
                            </label>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            <User size={16} /> Alias
                        </label>
                        <input
                            type="text"
                            className="search-bar"
                            value={"@" + currentUser}
                            disabled
                            style={{ marginBottom: 0, opacity: 0.7, cursor: 'not-allowed' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            <Lock size={16} /> Contraseña
                        </label>
                        <input
                            type="text"
                            className="search-bar"
                            placeholder="Nueva contraseña..."
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ marginBottom: 0 }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            <Palette size={16} /> Atributo Principal
                        </label>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Este atributo definirá tu color de perfil frente a los demás en la comunidad y cambiará la estética de tu interfaz.</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.8rem' }}>
                            {ATTRIBUTES.map(attr => (
                                <button
                                    key={attr.value}
                                    onClick={() => setAttribute(attr.value)}
                                    style={{
                                        background: attribute === attr.value ? attr.color : 'rgba(255,255,255,0.05)',
                                        color: attribute === attr.value ? '#111' : '#fff',
                                        border: `1px solid ${attr.color}`,
                                        padding: '0.6rem',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        transition: 'all 0.2s ease',
                                        textShadow: attribute === attr.value ? 'none' : '0 2px 4px rgba(0,0,0,0.5)',
                                    }}
                                >
                                    {attr.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {message && (
                        <div style={{ padding: '0.8rem', borderRadius: '8px', background: message.includes('Error') ? 'rgba(255, 77, 77, 0.2)' : 'rgba(46, 204, 113, 0.2)', color: message.includes('Error') ? '#FF4D4D' : '#2ecc71', textAlign: 'center', fontSize: '0.9rem', border: `1px solid ${message.includes('Error') ? '#FF4D4D' : '#2ecc71'}` }}>
                            {message}
                        </div>
                    )}

                    <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }} onClick={handleSave}>
                        <Save size={18} /> Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
}
