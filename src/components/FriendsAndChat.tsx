import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { Check, X, MessageSquare, Send, BookDown, UserPlus } from 'lucide-react';
import UserAvatar from './UserAvatar';

interface FriendsAndChatProps {
    currentUser: string;
    onClose: () => void;
}

export default function FriendsAndChat({ currentUser, onClose }: FriendsAndChatProps) {
    const [friends, setFriends] = useState<string[]>([]);
    const [friendAttributes, setFriendAttributes] = useState<Record<string, string>>({});
    const [incomingRequests, setIncomingRequests] = useState<string[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<string[]>([]);

    const [activeChat, setActiveChat] = useState<string | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');

    const [addFriendInput, setAddFriendInput] = useState('');
    const [addError, setAddError] = useState('');

    const [myDecks, setMyDecks] = useState<any[]>([]);
    const [showDeckPicker, setShowDeckPicker] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Listen to current user document
        const userRef = doc(db, 'users', currentUser.toLowerCase());
        const unsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setFriends(data.friends || []);
                setIncomingRequests(data.incomingRequests || []);
                setOutgoingRequests(data.outgoingRequests || []);
            }
        });

        // Load user decks for sharing
        getDoc(doc(db, 'user_decks', currentUser.toLowerCase())).then(docSnap => {
            if (docSnap.exists() && docSnap.data().decks) {
                setMyDecks(docSnap.data().decks);
            }
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Fetch friend attributes for coloring
    useEffect(() => {
        if (friends.length === 0) return;

        const fetchAttrs = async () => {
            const newAttrs: Record<string, string> = {};
            for (const f of friends) {
                try {
                    const uRef = doc(db, 'users', f.toLowerCase());
                    const uSnap = await getDoc(uRef);
                    if (uSnap.exists()) {
                        newAttrs[f.toLowerCase()] = uSnap.data().attribute || '';
                    }
                } catch (e) { console.error(e); }
            }
            setFriendAttributes(newAttrs);
        };
        fetchAttrs();
    }, [friends]);

    const getAttrColor = (attr?: string) => {
        if (!attr) return 'var(--accent-color)';
        return `var(--attr-${attr.toLowerCase()})`;
    };

    useEffect(() => {
        if (!activeChat) {
            setMessages([]);
            return;
        }

        const chatId = [currentUser.toLowerCase(), activeChat.toLowerCase()].sort().join('_');
        const chatRef = doc(db, 'chats', chatId);

        const unsubscribe = onSnapshot(chatRef, (docSnap) => {
            if (docSnap.exists()) {
                setMessages(docSnap.data().messages || []);
            } else {
                setMessages([]);
            }
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });

        return () => unsubscribe();
    }, [activeChat, currentUser]);

    const handleSendFriendRequest = async () => {
        setAddError('');
        const target = addFriendInput.trim().toLowerCase();

        if (!target) return;
        if (target === currentUser.toLowerCase()) {
            setAddError('No puedes enviarte una solicitud a ti mismo.');
            return;
        }
        if (friends.includes(target)) {
            setAddError('Ya son amigos.');
            return;
        }
        if (outgoingRequests.includes(target)) {
            setAddError('Ya enviaste una solicitud a este usuario.');
            return;
        }

        try {
            const targetRef = doc(db, 'users', target);
            const targetSnap = await getDoc(targetRef);

            if (!targetSnap.exists()) {
                setAddError('Usuario no encontrado.');
                return;
            }

            // Target receives incoming
            await updateDoc(targetRef, {
                incomingRequests: arrayUnion(currentUser.toLowerCase())
            });

            // Current sends outgoing
            await updateDoc(doc(db, 'users', currentUser.toLowerCase()), {
                outgoingRequests: arrayUnion(target)
            });

            setAddFriendInput('');
            setAddError('Solicitud enviada!');
            setTimeout(() => setAddError(''), 3000);
        } catch (e) {
            console.error(e);
            setAddError('Error al enviar la solicitud.');
        }
    };

    const handleAcceptRequest = async (target: string) => {
        try {
            const myRef = doc(db, 'users', currentUser.toLowerCase());
            const targetRef = doc(db, 'users', target);

            await updateDoc(myRef, {
                incomingRequests: arrayRemove(target),
                friends: arrayUnion(target)
            });

            await updateDoc(targetRef, {
                outgoingRequests: arrayRemove(currentUser.toLowerCase()),
                friends: arrayUnion(currentUser.toLowerCase())
            });

        } catch (e) { console.error(e); }
    };

    const handleDeclineRequest = async (target: string) => {
        try {
            const myRef = doc(db, 'users', currentUser.toLowerCase());
            const targetRef = doc(db, 'users', target);

            await updateDoc(myRef, {
                incomingRequests: arrayRemove(target)
            });

            await updateDoc(targetRef, {
                outgoingRequests: arrayRemove(currentUser.toLowerCase())
            });
        } catch (e) { console.error(e); }
    };

    const handleSendMessage = async (text: string, deckData?: any) => {
        if (!text.trim() && !deckData) return;
        if (!activeChat) return;

        const chatId = [currentUser.toLowerCase(), activeChat.toLowerCase()].sort().join('_');
        const chatRef = doc(db, 'chats', chatId);

        const newMsg = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            sender: currentUser.toLowerCase(),
            text: text.trim(),
            timestamp: new Date().toISOString(),
            isDeckCard: !!deckData,
            deckData: deckData || null
        };

        try {
            const docSnap = await getDoc(chatRef);
            if (docSnap.exists()) {
                await updateDoc(chatRef, {
                    messages: arrayUnion(newMsg)
                });
            } else {
                await setDoc(chatRef, {
                    messages: [newMsg],
                    participants: [currentUser.toLowerCase(), activeChat.toLowerCase()]
                });
            }
            setNewMessage('');
            setShowDeckPicker(false);
        } catch (e) { console.error(e); }
    };

    const handleCopyDeck = async (deckToCopy: any) => {
        if (!window.confirm(`¿Quieres guardar el mazo "${deckToCopy.name}" en tu colección?`)) return;

        try {
            const newDeck = { ...deckToCopy, id: Date.now().toString(), isPublic: false };
            const myDecksRef = doc(db, 'user_decks', currentUser.toLowerCase());
            const myDecksSnap = await getDoc(myDecksRef);

            let currentDecks = [];
            if (myDecksSnap.exists() && myDecksSnap.data().decks) {
                currentDecks = myDecksSnap.data().decks;
            }

            await setDoc(myDecksRef, { decks: [...currentDecks, newDeck] }, { merge: true });
            alert('¡Mazo copiado con éxito! Revisalo en tu Creador de Mazos.');

            // Reload local decks state
            setMyDecks([...currentDecks, newDeck]);
        } catch (e) {
            console.error(e);
            alert('Error al copiar el mazo.');
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10005, justifyContent: 'flex-end', padding: 0 }}>
            <div className="glass-panel animate-fade-in" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '400px', height: '100vh', borderRadius: '0', display: 'flex', flexDirection: 'column', padding: '0', background: '#0a0a0f', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                {/* Header */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)' }}>
                    <h2 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {activeChat ? (
                            <>
                                <button onClick={() => setActiveChat(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '0.2rem', display: 'flex' }}>
                                    ←
                                </button>
                                <UserAvatar username={activeChat} size={24} />
                                <span style={{ color: getAttrColor(friendAttributes[activeChat.toLowerCase()]), fontWeight: 'bold' }}>@{activeChat}</span>
                            </>
                        ) : (
                            <>Panel Social</>
                        )}
                    </h2>
                    <button className="modal-close" onClick={onClose} style={{ position: 'relative', top: 0, right: 0 }}><X size={20} /></button>
                </div>

                {activeChat ? (
                    /* Chat View */
                    <>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {messages.map(m => {
                                const isMe = m.sender === currentUser.toLowerCase();
                                return (
                                    <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                                        {m.isDeckCard ? (
                                            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '12px', background: isMe ? 'linear-gradient(145deg, rgba(123, 97, 255, 0.2) 0%, rgba(30,30,40,0.9) 100%)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isMe ? 'var(--accent-color)' : 'var(--border-color)'}` }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: isMe ? '#fff' : 'var(--text-secondary)' }}>
                                                    <BookDown size={14} /> Mazo Compartido {isMe ? 'por ti' : ''}
                                                </div>
                                                <h4 style={{ color: isMe ? 'var(--accent-color)' : getAttrColor(friendAttributes[activeChat.toLowerCase()]), marginBottom: '0.5rem' }}>{m.deckData.name || 'Mazo sin nombre'}</h4>
                                                <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', paddingLeft: '1rem' }}>
                                                    <li>{m.deckData.bakugans?.filter((b: any) => b.name).length || 0} Bakugans</li>
                                                    <li>{(m.deckData.attributeGates?.length || 0) + (m.deckData.commandGates?.length || 0) + (m.deckData.characterGates?.length || 0)} Cartas Portal</li>
                                                    <li>{m.deckData.abilities?.length || 0} Cartas de Habilidad</li>
                                                </ul>
                                                {!isMe && (
                                                    <button className="btn-primary" style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem' }} onClick={() => handleCopyDeck(m.deckData)}>
                                                        Copiar a mi colección
                                                    </button>
                                                )}
                                                {m.text && <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>{m.text}</p>}
                                            </div>
                                        ) : (
                                            <div style={{ padding: '0.8rem 1rem', borderRadius: '12px', background: isMe ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)', borderLeft: !isMe ? `3px solid ${getAttrColor(friendAttributes[activeChat.toLowerCase()])}` : 'none', color: '#fff', fontSize: '0.95rem', wordBreak: 'break-word' }}>
                                                {m.text}
                                            </div>
                                        )}
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: isMe ? 'right' : 'left', marginTop: '0.2rem' }}>
                                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                );
                            })}
                            {messages.length === 0 && (
                                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem', fontSize: '0.9rem' }}>Comienza la conversación enviando un mensaje o compartiendo una estrategia.</p>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {showDeckPicker && (
                            <div style={{ borderTop: '1px solid var(--border-color)', padding: '1rem', background: 'rgba(0,0,0,0.5)', maxHeight: '200px', overflowY: 'auto' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Elige un mazo para enviar</h4>
                                    <button onClick={() => setShowDeckPicker(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={16} /></button>
                                </div>
                                {myDecks.length === 0 ? (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No tienes mazos en tu colección.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {myDecks.map(d => (
                                            <button key={d.id} className="btn-secondary" style={{ textAlign: 'left', padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => handleSendMessage('', d)}>
                                                {d.name || 'Mazo sin nombre'} {!d.isPublic && '(Privado)'}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
                            <button onClick={() => setShowDeckPicker(!showDeckPicker)} style={{ background: 'var(--accent-color)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', flexShrink: 0 }} title="Compartir Mazo">
                                <BookDown size={16} />
                            </button>
                            <input
                                type="text"
                                className="search-bar"
                                style={{ marginBottom: 0, borderRadius: '20px', padding: '0.5rem 1rem', height: '40px' }}
                                placeholder="Escribe un mensaje..."
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSendMessage(newMessage)}
                            />
                            <button className="btn-primary" style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} onClick={() => handleSendMessage(newMessage)}>
                                <Send size={16} />
                            </button>
                        </div>
                    </>
                ) : (
                    /* Main Friends View */
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

                        {/* Section: Incoming Requests */}
                        {incomingRequests.length > 0 && (
                            <div style={{ marginBottom: '2rem' }}>
                                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ width: '8px', height: '8px', background: 'var(--accent-color)', borderRadius: '50%', display: 'inline-block' }}></span>
                                    Solicitudes Pendientes ({incomingRequests.length})
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {incomingRequests.map(req => (
                                        <div key={req} className="glass-panel" style={{ padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 'bold' }}>@{req}</span>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button onClick={() => handleAcceptRequest(req)} style={{ background: 'rgba(46, 204, 113, 0.2)', border: '1px solid #2ecc71', color: '#2ecc71', borderRadius: '8px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Aceptar"><Check size={16} /></button>
                                                <button onClick={() => handleDeclineRequest(req)} style={{ background: 'rgba(255, 77, 77, 0.2)', border: '1px solid #FF4D4D', color: '#FF4D4D', borderRadius: '8px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Rechazar"><X size={16} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Section: Add Friend */}
                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>
                                Enviar Solicitud
                            </h3>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    className="search-bar"
                                    style={{ marginBottom: 0 }}
                                    placeholder="Nombre de usuario..."
                                    value={addFriendInput}
                                    onChange={e => setAddFriendInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSendFriendRequest()}
                                />
                                <button className="btn-primary" style={{ padding: '0 1rem' }} onClick={handleSendFriendRequest}>
                                    <UserPlus size={18} />
                                </button>
                            </div>
                            {addError && (
                                <p style={{ fontSize: '0.8rem', color: addError.includes('enviada') ? '#2ecc71' : '#FF4D4D', marginTop: '0.5rem' }}>{addError}</p>
                            )}
                        </div>

                        {/* Section: Friends List */}
                        <div>
                            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>
                                Mis Amigos ({friends.length})
                            </h3>
                            {friends.length === 0 ? (
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Aún no tienes amigos en tu lista.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {friends.map(friend => (
                                        <div key={friend} className="glass-panel" style={{ padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s ease', border: '1px solid transparent' }} onClick={() => setActiveChat(friend)} onMouseEnter={e => e.currentTarget.style.borderColor = getAttrColor(friendAttributes[friend.toLowerCase()])} onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                                <UserAvatar username={friend} size={36} />
                                                <span style={{ fontWeight: 'bold' }}>@{friend}</span>
                                            </div>
                                            <MessageSquare size={18} color={getAttrColor(friendAttributes[friend.toLowerCase()])} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}
