import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, getDocs, updateDoc, setDoc } from 'firebase/firestore';
import { Shield, Ban, CheckCircle, ShieldAlert, ShieldCheck, Download, Upload, Database, AlertCircle } from 'lucide-react';
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

    const exportData = async () => {
        if (!window.confirm("¿Deseas exportar una copia de seguridad de toda la base de datos?")) return;
        setLoading(true);
        try {
            const collections = ['users', 'user_decks', 'bloxugans', 'bakugan_comments', 'cards', 'matches', 'battle_history'];
            const backup: any = {};

            for (const colName of collections) {
                const querySnapshot = await getDocs(collection(db, colName));
                backup[colName] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }

            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bakutactics_backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error exporting data", error);
            alert("Error al exportar los datos.");
        }
        setLoading(false);
    };

    const importData = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!window.confirm("¡ATENCIÓN! Esto sobrescribirá los datos existentes. ¿Estás seguro?")) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const backup = JSON.parse(e.target?.result as string);
                const collections = Object.keys(backup);

                for (const colName of collections) {
                    const data = backup[colName];
                    for (const item of data) {
                        const { id, ...docData } = item;
                        await setDoc(doc(db, colName, id), docData);
                    }
                }
                alert("¡Importación completada con éxito!");
                fetchUsers();
            } catch (error) {
                console.error("Error importing data", error);
                alert("Error al importar el archivo. Formato no válido.");
            }
            setLoading(false);
        };
        reader.readAsText(file);
    };

    return (
        <div className="container animate-fade-in" style={{ paddingBottom: '4rem' }}>
            {/* Sección de Backups */}
            <section className="glass-panel main-section" style={{ marginBottom: '2rem', border: '1px solid rgba(100, 200, 255, 0.2)' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#64C8FF', marginBottom: '1rem' }}>
                    <Database size={24} /> 
                    Gestión de Base de Datos y Backups
                </h2>
                <div style={{ background: 'rgba(100, 200, 255, 0.05)', padding: '1rem', borderRadius: '12px', borderLeft: '4px solid #64C8FF', marginBottom: '2rem' }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={16} /> 
                        Usa estas herramientas para asegurar tus datos. Descarga una copia local regularmente.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button 
                        className="btn-primary" 
                        onClick={exportData}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#2ecc71', boxShadow: '0 4px 15px rgba(46, 204, 113, 0.2)' }}
                    >
                        <Download size={18} /> Exportar Copia de Seguridad (JSON)
                    </button>
                    
                    <label className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: 'rgba(255,255,255,0.05)' }}>
                        <Upload size={18} /> Importar Datos desde Archivo
                        <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }} />
                    </label>
                </div>
            </section>

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
