import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { Shield, Ban, CheckCircle, ShieldAlert, ShieldCheck } from 'lucide-react';
import UserAvatar from './UserAvatar';

interface UserData {
    username: string;
    attribute?: string;
    avatar?: string;
    role?: 'user' | 'admin';
    banned?: boolean;
}

export default function SuperAdminPanel({ currentUser }: { currentUser: string }) {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            const usersData: UserData[] = [];
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                usersData.push({
                    username: docSnap.id,
                    attribute: data.attribute,
                    avatar: data.avatar,
                    role: data.role || 'user',
                    banned: data.banned || false,
                });
            });
            // Ordenar alfabéticamente
            usersData.sort((a, b) => a.username.localeCompare(b.username));
            setUsers(usersData);
        } catch (error) {
            console.error("Error fetching users", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const toggleRole = async (user: UserData) => {
        if (user.username.toLowerCase() === currentUser.toLowerCase()) {
            alert("No puedes cambiar tu propio rol.");
            return;
        }
        const newRole = user.role === 'admin' ? 'user' : 'admin';
        try {
            const userRef = doc(db, 'users', user.username.toLowerCase());
            await updateDoc(userRef, { role: newRole });
            setUsers(prev => prev.map(u => u.username === user.username ? { ...u, role: newRole } : u));
        } catch (e) {
            console.error(e);
            alert("Error al actualizar el rol.");
        }
    };

    const toggleBan = async (user: UserData) => {
        if (user.username.toLowerCase() === currentUser.toLowerCase()) {
            alert("No puedes banearte a ti mismo.");
            return;
        }
        const newBanState = !user.banned;
        if (newBanState) {
            if (!window.confirm(`¿Seguro que deseas BANEAR a @${user.username}? No podrá iniciar sesión.`)) return;
        } else {
            if (!window.confirm(`¿Deseas quitarle el BAN a @${user.username}?`)) return;
        }

        try {
            const userRef = doc(db, 'users', user.username.toLowerCase());
            await updateDoc(userRef, { banned: newBanState });
            setUsers(prev => prev.map(u => u.username === user.username ? { ...u, banned: newBanState } : u));
        } catch (e) {
            console.error(e);
            alert("Error al actualizar el estado de baneo.");
        }
    };

    return (
        <div className="container animate-fade-in" style={{ paddingBottom: '4rem' }}>
            <section className="glass-panel main-section" style={{ marginBottom: '2rem' }}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#ff4d4d' }}>
                    <ShieldAlert size={32} />
                    Panel de Superadministrador
                </h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    Gestiona los usuarios de la comunidad. Asigna permisos o restringe accesos.
                </p>

                {loading ? (
                    <p style={{ color: 'var(--text-secondary)' }}>Cargando usuarios...</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    <th style={{ padding: '1rem 0.5rem' }}>Usuario</th>
                                    <th style={{ padding: '1rem 0.5rem' }}>Atributo</th>
                                    <th style={{ padding: '1rem 0.5rem' }}>Estado</th>
                                    <th style={{ padding: '1rem 0.5rem' }}>Rol</th>
                                    <th style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>Acciones Técnicas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => {
                                    const attrColor = u.attribute ? `var(--attr-${u.attribute.toLowerCase()})` : 'var(--accent-color)';
                                    return (
                                        <tr key={u.username} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s', background: 'rgba(255,255,255,0.01)' }}>
                                            <td style={{ padding: '1rem 0.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <div style={{ border: `2px solid ${attrColor}`, borderRadius: '50%', padding: '2px' }}>
                                                        <UserAvatar username={u.username} size={36} overrideAvatar={u.avatar} />
                                                    </div>
                                                    <span style={{ fontWeight: 'bold', color: '#fff' }}>@{u.username}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 0.5rem' }}>
                                                <span style={{ color: attrColor, fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                                                    {u.attribute || 'NINGUNO'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem 0.5rem' }}>
                                                {u.banned ? (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ff4d4d', fontWeight: 'bold', fontSize: '0.9rem', background: 'rgba(255, 77, 77, 0.1)', padding: '0.3rem 0.8rem', borderRadius: '999px', width: 'max-content' }}>
                                                        <Ban size={14} /> BANEADO
                                                    </span>
                                                ) : (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#2ecc71', fontWeight: 'bold', fontSize: '0.9rem', background: 'rgba(46, 204, 113, 0.1)', padding: '0.3rem 0.8rem', borderRadius: '999px', width: 'max-content' }}>
                                                        <CheckCircle size={14} /> ACTIVO
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '1rem 0.5rem' }}>
                                                {u.role === 'admin' ? (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64C8FF', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                        <ShieldCheck size={16} /> ADMIN
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>USUARIO</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                    {/* Admin Toggle */}
                                                    <button
                                                        onClick={() => toggleRole(u)}
                                                        style={{
                                                            padding: '0.5rem 1rem',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontWeight: 'bold',
                                                            fontSize: '0.85rem',
                                                            background: u.role === 'admin' ? 'rgba(255,255,255,0.1)' : 'rgba(100, 200, 255, 0.2)',
                                                            color: u.role === 'admin' ? 'var(--text-secondary)' : '#64C8FF',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.4rem',
                                                            transition: 'all 0.2s',
                                                            opacity: u.username.toLowerCase() === currentUser.toLowerCase() ? 0.5 : 1
                                                        }}
                                                        disabled={u.username.toLowerCase() === currentUser.toLowerCase()}
                                                    >
                                                        <Shield size={14} /> {u.role === 'admin' ? 'Quitar Admin' : 'Hacer Admin'}
                                                    </button>
                                                    {/* Ban Toggle */}
                                                    <button
                                                        onClick={() => toggleBan(u)}
                                                        style={{
                                                            padding: '0.5rem 1rem',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontWeight: 'bold',
                                                            fontSize: '0.85rem',
                                                            background: u.banned ? 'rgba(255,255,255,0.1)' : 'rgba(255, 77, 77, 0.2)',
                                                            color: u.banned ? 'var(--text-secondary)' : '#ff4d4d',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.4rem',
                                                            transition: 'all 0.2s',
                                                            opacity: u.username.toLowerCase() === currentUser.toLowerCase() ? 0.5 : 1
                                                        }}
                                                        disabled={u.username.toLowerCase() === currentUser.toLowerCase()}
                                                    >
                                                        <Ban size={14} /> {u.banned ? 'Desbanear' : 'Banear'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
