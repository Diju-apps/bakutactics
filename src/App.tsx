import { useState, useEffect } from 'react';
import cardsData from './data/cards_es.json';
import { analyzeCard, type CardData, type CardAnalysis } from './utils/cardLogic';
import { Search, X, Shield, Sword, AlertTriangle, MessageCircle, LogOut, Trash2, Edit2, Heart, MessageSquare, Menu, ChevronDown } from 'lucide-react';
import { db } from './firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import DeckBuilder from './components/DeckBuilder';
import Community from './components/Community';
import MetaDecks from './components/MetaDecks';
import FriendsAndChat from './components/FriendsAndChat';
import ProfileEditor from './components/ProfileEditor';
import UserAvatar from './components/UserAvatar';
import CardTierlist from './components/CardTierlist';
import BloxuganRegistration from './components/BloxuganRegistration';
import SuperAdminPanel from './components/SuperAdminPanel';
import BakuganEncyclopedia from './components/BakuganEncyclopedia';
import BakuTracker from './components/BakuTracker';
import { getOptimizedImageUrl } from './utils/imageOptimization';

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

// Configuración de donaciones - Reemplazar con tu enlace de PayPal.me o botón de donación
const PAYPAL_DONATION_URL = "https://paypal.me/juanbo795";

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'meta' | 'deckBuilder' | 'community' | 'bloxuganRegistration' | 'superAdminPanel' | 'catalogo' | 'tracker'>('home');
  const [metaTab, setMetaTab] = useState<'cards' | 'decks' | 'tierlist'>('cards');
  const [cards, setCards] = useState<CardData[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [analysis, setAnalysis] = useState<CardAnalysis | null>(null);

  // Auth & Comments State
  const [currentUser, setCurrentUser] = useState<string | null>(localStorage.getItem('currentUser'));
  const [currentUserRole, setCurrentUserRole] = useState<'user'|'admin'>('user');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [comments, setComments] = useState<{ id: string, user: string, text: string, date: string, likes?: string[] }[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Social State
  const [showFriends, setShowFriends] = useState(false);
  const [hasPendingRequests, setHasPendingRequests] = useState(false);

  // Profile State
  const [showProfileEditor, setShowProfileEditor] = useState(false);

  const [visibleCards, setVisibleCards] = useState(24);

  const [showDonationModal, setShowDonationModal] = useState(false);

  useEffect(() => {
    // Attempt loading cards_es. If the script didn't finish, this could error, 
    // so Vite will reload as soon as cards_es.json is properly generated.
    setCards(cardsData as CardData[]);
  }, []);

  // Reset pagination when search or filters change
  useEffect(() => {
    setVisibleCards(24);
  }, [search, filterType]);

  // Load & Sync Comments (Firebase Real-time)
  useEffect(() => {
    if (!selectedCard) {
      setComments([]);
      return;
    }

    const cardRef = doc(db, 'cards', selectedCard.name);

    // Listen for real-time updates directly from Firestore
    const unsubscribe = onSnapshot(cardRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setComments(data.comments || []);
      } else {
        setComments([]);
      }
    });

    return () => unsubscribe();
  }, [selectedCard]);

  // Listen to current user profile for pending requests and attributes
  useEffect(() => {
    if (!currentUser) {
      setHasPendingRequests(false);
      document.body.removeAttribute('data-theme');
      return;
    }
    const userRef = doc(db, 'users', currentUser.toLowerCase());
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.banned) {
          alert('Tu cuenta ha sido baneada y no tienes acceso.');
          localStorage.removeItem('currentUser');
          setCurrentUser(null);
          return;
        }
        
        setCurrentUserRole(data.role || (currentUser.toLowerCase() === 'diju' ? 'admin' : 'user'));
        setHasPendingRequests(data.incomingRequests && data.incomingRequests.length > 0);

        if (data.attribute) {
          document.body.setAttribute('data-theme', data.attribute);
        } else {
          document.body.removeAttribute('data-theme');
        }
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  const handleAuth = async () => {
    setAuthError('');
    const user = usernameInput.trim();
    const pass = passwordInput.trim();
    if (!user || !pass) {
      setAuthError('Llena todos los campos');
      return;
    }

    try {
      const userDocRef = doc(db, 'users', user.toLowerCase());
      const userDoc = await getDoc(userDocRef);

      if (isRegistering) {
        if (userDoc.exists()) {
          setAuthError('El usuario ya existe. Intenta con otro.');
          return;
        }
        await setDoc(userDocRef, { 
            username: user, 
            pass, 
            role: user.toLowerCase() === 'diju' ? 'admin' : 'user', 
            banned: false 
        });
      } else {
        if (!userDoc.exists()) {
          setAuthError('Usuario o contraseña incorrectos.');
          return;
        }
        const data = userDoc.data();
        if (data.pass !== pass) {
          setAuthError('Usuario o contraseña incorrectos.');
          return;
        }
        if (data.banned) {
          setAuthError('Tu cuenta está baneada. No puedes acceder.');
          return;
        }
      }

      localStorage.setItem('currentUser', user);
      setCurrentUser(user);
      setShowAuthModal(false);
      setUsernameInput('');
      setPasswordInput('');
      setIsRegistering(false);
    } catch (e) {
      console.error(e);
      setAuthError('Error conectando a la base de datos.');
    }
  };

  const logout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
  };

  const saveCommentsToDB = async (updatedComments: any[]) => {
    if (selectedCard) {
      // Optimistic local update
      setComments(updatedComments);
      try {
        const cardRef = doc(db, 'cards', selectedCard.name);
        await setDoc(cardRef, { comments: updatedComments }, { merge: true });
      } catch (e) {
        console.error('Error saving comments', e);
      }
    }
  };

  const handleAddComment = () => {
    if (!newComment.trim() || !currentUser || !selectedCard) return;
    const comment = { id: Date.now().toString(), user: currentUser, text: newComment.trim(), date: new Date().toLocaleDateString() };
    saveCommentsToDB([...comments, comment]);
    setNewComment('');
  };

  const handleDeleteComment = (id: string) => {
    if (window.confirm('¿Seguro que quieres borrar tu estrategia?')) {
      const updated = comments.filter(c => c.id !== id);
      saveCommentsToDB(updated);
    }
  };

  const handleLikeComment = (id: string) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    const updated = comments.map(c => {
      if (c.id === id) {
        const currentLikes = c.likes || [];
        const hasLiked = currentLikes.some(u => u.toLowerCase() === currentUser.toLowerCase());
        const newLikes = hasLiked ? currentLikes.filter(u => u.toLowerCase() !== currentUser.toLowerCase()) : [...currentLikes, currentUser.toLowerCase()];
        return { ...c, likes: newLikes };
      }
      return c;
    });
    saveCommentsToDB(updated);
  };

  const startEdit = (c: any) => {
    setEditingCommentId(c.id);
    setEditCommentText(c.text);
  };

  const handleSaveEdit = () => {
    if (!editCommentText.trim()) return;
    const updated = comments.map(c => c.id === editingCommentId ? { ...c, text: editCommentText.trim() } : c);
    saveCommentsToDB(updated);
    setEditingCommentId(null);
    setEditCommentText('');
  };

  const filteredCards = cards.filter(c => {
    const s = search.toLowerCase();
    const matchesSearch = c.name.toLowerCase().includes(s) ||
      (c.description && c.description.toLowerCase().includes(s));
    const matchesType = filterType ? c.type === filterType : true;
    return matchesSearch && matchesType;
  });

  const handleCardClick = (card: CardData) => {
    setSelectedCard(card);
    setAnalysis(analyzeCard(card));
  };

  const closeModal = () => {
    setSelectedCard(null);
    setAnalysis(null);
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'agc': return 'Portal de Atributo';
      case 'cogc': return 'Portal Comando';
      case 'chgc': return 'Portal de Personaje';
      case 'nac': return 'Habilidad Normal';
      case 'sac': return 'Habilidad Especial';
      case 'fac': return 'Habilidad de Fusión';
      case 'cac': return 'Habilidad de Comando';
      case 'hac': return 'Habilidad de Héroe';
      default: return type.toUpperCase();
    }
  };

  return (
    <>
      <div className="container">
        <header className="nav-header">
          <div className="brand" onClick={() => setActiveTab('home')} style={{ cursor: 'pointer' }}>
            <span className="accent-text">Baku</span>Tactics
          </div>

          <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Menu">
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>

          <div className={`mobile-overlay ${isMobileMenuOpen ? 'active' : ''}`} onClick={() => setIsMobileMenuOpen(false)}></div>

          <nav className={`nav-links ${isMobileMenuOpen ? 'open' : ''}`}>
            <div className="nav-dropdown">
              <a href="#" className={activeTab === 'meta' || activeTab === 'catalogo' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('meta'); setIsMobileMenuOpen(false); }}>
                Guía del Meta <ChevronDown size={14} style={{ marginLeft: '4px', verticalAlign: 'middle', marginBottom: '2px' }} />
              </a>
              <div className="dropdown-content">
                <a href="#catalogo-bakugans" className={activeTab === 'catalogo' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('catalogo'); setIsMobileMenuOpen(false); }}>Catálogo de Bakugans</a>
                <a href="#catalogo-cartas" className={activeTab === 'meta' && metaTab === 'cards' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('meta'); setMetaTab('cards'); setIsMobileMenuOpen(false); }}>Catálogo de Cartas</a>
                <a href="#tierlist-cartas" className={activeTab === 'meta' && metaTab === 'tierlist' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('meta'); setMetaTab('tierlist'); setIsMobileMenuOpen(false); }}>Tierlist de Cartas</a>
                <a href="#decks-populares" className={activeTab === 'meta' && metaTab === 'decks' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('meta'); setMetaTab('decks'); setIsMobileMenuOpen(false); }}>Decks Populares</a>
              </div>
            </div>
            <a href="#" className={activeTab === 'tracker' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('tracker'); setIsMobileMenuOpen(false); }}>Registro Partidas</a>
            <a href="#" className={activeTab === 'community' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('community'); setIsMobileMenuOpen(false); }}>Comunidad</a>
            <a href="#" onClick={(e) => { e.preventDefault(); setShowDonationModal(true); setIsMobileMenuOpen(false); }} style={{ color: "var(--accent-color)", fontWeight: "bold", display: "flex", alignItems: "center", gap: "0.2rem" }}>Donar <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent-color)" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></a>
            {currentUserRole === 'admin' && (
              <>
                <a href="#" className={activeTab === 'bloxuganRegistration' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('bloxuganRegistration'); setIsMobileMenuOpen(false); }}>Registro</a>
                <a href="#" className={activeTab === 'superAdminPanel' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('superAdminPanel'); setIsMobileMenuOpen(false); }}>Panel Admin</a>
              </>
            )}
            {currentUser ? (
              <div className="user-actions">
                <button
                  onClick={() => { setShowProfileEditor(true); setIsMobileMenuOpen(false); }}
                  className="btn-profile"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.8rem' }}
                >
                  <UserAvatar username={currentUser} size={24} /> {currentUser}
                </button>

                <button
                  className="btn-secondary btn-friends"
                  onClick={() => { setShowFriends(true); setIsMobileMenuOpen(false); }}
                >
                  <MessageSquare size={18} />
                  <span>Amigos</span>
                  {hasPendingRequests && (
                    <span className="notification-dot"></span>
                  )}
                </button>

                <button className="btn-secondary btn-logout" onClick={() => { logout(); setIsMobileMenuOpen(false); }}>
                  <LogOut size={16} /> <span>Salir</span>
                </button>
              </div>
            ) : (
              <button className="btn-primary" onClick={() => { setShowAuthModal(true); setIsMobileMenuOpen(false); }}>
                Registrarse / Entrar
              </button>
            )}
          </nav>
        </header>

        <main>
          {activeTab === 'home' && (
            <div className="animate-fade-in" style={{ paddingBottom: '2rem' }}>
              <section className="hero-banner">
                <div className="hero-content">
                  <h1 className="hero-title">
                    Bienvenido a <span className="accent-text">BakuTactics</span>
                  </h1>
                  <p className="hero-description">
                    La plataforma definitiva para peleadores. Construye tus mejores mazos, analiza el meta actual, comparte estrategias y domina la arena junto a la comunidad.
                  </p>
                  
                  <div style={{ marginTop: '1.2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button 
                      className="btn-primary" 
                      onClick={() => setActiveTab('deckBuilder')}
                      style={{ padding: '0.6rem 1.2rem', fontSize: '1rem', fontWeight: 'bold' }}
                    >
                      Crear mi primer Mazo
                    </button>
                    <button 
                      className="btn-secondary" 
                      onClick={() => setActiveTab('community')}
                      style={{ padding: '0.6rem 1.2rem', fontSize: '1rem', fontWeight: 'bold' }}
                    >
                      Explorar la Comunidad
                    </button>
                  </div>

                  <p className="hero-credits">
                    Desarrollado por Juanbo (@diju) y gestionado por nuestro equipo de Administradores.
                  </p>
                </div>
                <div className="hero-glow"></div>
              </section>

              {/* Sección de apoyo / Donaciones */}
              <footer className="glass-panel" style={{ marginTop: '2rem', padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.4rem', fontWeight: 'bold' }}>
                  <Heart size={24} className="accent-text" fill="var(--accent-color)" />
                  <span>Apoya a <span className="accent-text">BakuTactics</span></span>
                </div>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', fontSize: '0.95rem', lineHeight: '1.6' }}>
                  Esta plataforma no contiene anuncios y es mantenida por la comunidad. Si valoras nuestro trabajo, considera hacer una donación para cubrir costos de servidores y desarrollo.
                </p>
                <button 
                  className="btn-primary" 
                  style={{ background: '#00457C', boxShadow: '0 4px 15px rgba(0, 69, 124, 0.3)', gap: '0.6rem', padding: '0.75rem 1.5rem', marginTop: '0.5rem' }} 
                  onClick={() => setShowDonationModal(true)}
                >
                  <img src="https://www.paypalobjects.com/webstatic/icon/pp258.png" style={{ width: '18px', height: '18px' }} alt="PayPal" />
                  Donar con PayPal
                </button>
              </footer>
            </div>
          )}

          {activeTab === 'meta' && (
            <div className="animate-fade-in" style={{ paddingBottom: '4rem' }}>
              {metaTab === 'cards' ? (
                <>
                  <section className="glass-panel main-section">
                    <div className="search-container" style={{ position: 'relative' }}>
                      <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                      <input
                        type="text"
                        className="search-bar"
                        placeholder="Buscar cartas por nombre o efecto..."
                        style={{ paddingLeft: '3rem', marginBottom: '1.5rem' }}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>

                    <div className="filters-row">
                      <button className={`filter-btn ${filterType === null ? 'active' : ''}`} onClick={() => setFilterType(null)}>Todas</button>
                      <button className={`filter-btn ${filterType === 'agc' ? 'active' : ''}`} onClick={() => setFilterType('agc')}>Portal de Atributo</button>
                      <button className={`filter-btn ${filterType === 'cogc' ? 'active' : ''}`} onClick={() => setFilterType('cogc')}>Portal Comando</button>
                      <button className={`filter-btn ${filterType === 'chgc' ? 'active' : ''}`} onClick={() => setFilterType('chgc')}>Portal de Personaje</button>
                      <button className={`filter-btn ${filterType === 'nac' ? 'active' : ''}`} onClick={() => setFilterType('nac')}>Habilidad Normal</button>
                      <button className={`filter-btn ${filterType === 'sac' ? 'active' : ''}`} onClick={() => setFilterType('sac')}>Habilidad Especial</button>
                    </div>
                  </section>

                  <div className="cards-grid">
                    {filteredCards.slice(0, visibleCards).map((card, idx) => (
                      <div
                        key={idx}
                        className="glass-panel meta-card"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardClick(card);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', gap: '1rem', pointerEvents: 'none' }}>
                          <img
                            src={getCardImageUrl(card)}
                            alt={card.name}
                            loading="lazy"
                            style={{ width: '80px', height: 'auto', borderRadius: '8px', objectFit: 'cover' }}
                            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://bloxugan.info/images/card-back.png' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div className="card-title" style={{ fontSize: '1.1rem' }}>
                              {card.name}
                            </div>
                            <span className={`card-badge type-${card.type}`} style={{ display: 'inline-block', marginTop: '0.5rem' }}>
                              {getTypeName(card.type)}
                            </span>
                            {card.attribute && (
                              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginTop: '0.25rem' }} className={`attr-${card.attribute.toLowerCase()}`}>
                                ATRIBUTO {card.attribute.toUpperCase()}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="card-desc" style={{ pointerEvents: 'none' }}>
                          {card.description}
                        </div>

                        <div className="card-footer" style={{ pointerEvents: 'none' }}>
                          <span>{card.hsp || 'N/A'}</span>
                          <span>Límite: {card.limit || 'N/A'}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {visibleCards < filteredCards.length && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem' }}>
                      <button className="btn-primary" onClick={() => setVisibleCards(prev => prev + 24)}>
                        Cargar más cartas ({filteredCards.length - visibleCards} restantes)
                      </button>
                    </div>
                  )}
                </>
              ) : metaTab === 'tierlist' ? (
                <CardTierlist onCardClick={handleCardClick} />
              ) : (
                <MetaDecks currentUser={currentUser} onCardClick={handleCardClick} />
              )}
            </div>
          )}

          {activeTab === 'deckBuilder' && (
            <DeckBuilder currentUser={currentUser} onCardClick={handleCardClick} />
          )}

          {activeTab === 'community' && (
            <Community currentUser={currentUser} onCardClick={handleCardClick} />
          )}

          {activeTab === 'bloxuganRegistration' && currentUserRole === 'admin' && (
            <BloxuganRegistration currentUser={currentUser} />
          )}

          {activeTab === 'superAdminPanel' && currentUserRole === 'admin' && (
            <SuperAdminPanel currentUser={currentUser!} />
          )}

          {activeTab === 'catalogo' && (
            <BakuganEncyclopedia currentUser={currentUser} currentUserRole={currentUserRole} />
          )}
          
          {activeTab === 'tracker' && (
            <BakuTracker currentUser={currentUser} />
          )}
        </main>
      </div>

      {/* Modal Detailed view */}
      {
        selectedCard && analysis && (
          <div className="modal-overlay" onClick={closeModal} style={{ zIndex: 10005 }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: '#111116', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxWidth: '900px', width: '95%', maxHeight: '85vh' }}>
              <button className="modal-close" onClick={closeModal}><X size={24} /></button>
              <div className="modal-inner-padding" style={{ padding: '2rem' }}>

                <div className="modal-flex-layout" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>

                  {/* Image Section - Constrained Width to prevent taking whole screen */}
                  <div className="modal-image-container" style={{ flex: '0 0 auto', width: '200px' }}>
                    <img
                      src={getCardImageUrl(selectedCard)}
                      alt={selectedCard.name}
                      loading="lazy"
                      style={{ width: '100%', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://bloxugan.info/images/card-back.png' }}
                    />

                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span className={`card-badge type-${selectedCard.type}`} style={{ textAlign: 'center' }}>{getTypeName(selectedCard.type)}</span>
                      {selectedCard.attribute && (
                        <span style={{ fontWeight: 'bold', textAlign: 'center' }} className={`attr-${selectedCard.attribute.toLowerCase()}`}>
                          {selectedCard.attribute.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info & Analysis Section */}
                  <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h2 className="modal-title-text" style={{ fontSize: '2.5rem', margin: '0' }}>
                      {selectedCard.name}
                    </h2>

                    <div className="analysis-block" style={{ background: 'rgba(255,255,255,0.05)', borderLeft: '3px solid var(--accent-color)', padding: '1rem' }}>
                      <p style={{ fontSize: '1.05rem', color: 'var(--text-main)', fontStyle: 'italic', margin: 0 }}>
                        "{selectedCard.description}"
                      </p>
                    </div>

                    {/* Desktop uses grid 1fr 1fr for analysis, mobile wraps */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>

                      <div className="analysis-block" style={{ borderLeftColor: '#7B61FF', margin: 0 }}>
                        <h4 style={{ color: '#7B61FF' }}><Sword size={18} /> ¿Cuándo usarla? (Táctica)</h4>
                        <p style={{ fontSize: '0.9rem' }}>{analysis.whenToUse}</p>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {analysis.counters.length > 0 && (
                          <div className="analysis-block counters" style={{ margin: 0 }}>
                            <h4><Shield size={18} /> Posibles Counters</h4>
                            <ul style={{ fontSize: '0.9rem', paddingLeft: '1.2rem' }}>
                              {analysis.counters.map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                          </div>
                        )}

                        {analysis.vulnerabilities.length > 0 && (
                          <div className="analysis-block vulnerabilities" style={{ margin: 0 }}>
                            <h4><AlertTriangle size={18} /> Vulnerabilidades</h4>
                            <ul style={{ fontSize: '0.9rem', paddingLeft: '1.2rem' }}>
                              {analysis.vulnerabilities.map((v, i) => <li key={i}>{v}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Comments Section */}
                    <div className="comments-section" style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '1.25rem' }}>
                        <MessageCircle size={20} color="var(--accent-color)" /> Tácticas Sugeridas
                      </h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                        {[...comments].sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0)).map((c) => (
                          <div key={c.id} className="glass-panel" style={{ padding: '1rem', borderRadius: '12px', border: c.user === currentUser ? '1px solid rgba(123, 97, 255, 0.4)' : '' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <UserAvatar username={c.user} size={24} />
                                <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '0.9rem' }}>@{c.user}</span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button onClick={() => handleLikeComment(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: c.likes?.some(u => u.toLowerCase() === (currentUser || '').toLowerCase()) ? '#FF4D4D' : 'var(--text-secondary)' }}>
                                  <Heart size={14} fill={c.likes?.some(u => u.toLowerCase() === (currentUser || '').toLowerCase()) ? '#FF4D4D' : 'none'} />
                                  <span style={{ fontSize: '0.85rem' }}>{c.likes?.length || 0}</span>
                                </button>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.date}</span>
                                {currentUser === c.user && (
                                  <div style={{ display: 'flex', gap: '0.25rem', paddingLeft: '0.5rem', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                                    <button onClick={() => startEdit(c)} style={{ background: 'none', border: 'none', color: '#64C8FF', cursor: 'pointer' }} title="Editar"><Edit2 size={14} /></button>
                                    <button onClick={() => handleDeleteComment(c.id)} style={{ background: 'none', border: 'none', color: '#FF4D4D', cursor: 'pointer' }} title="Eliminar"><Trash2 size={14} /></button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {editingCommentId === c.id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <textarea
                                  className="search-bar"
                                  style={{ width: '100%', minHeight: '80px', padding: '0.5rem', marginBottom: 0, resize: 'vertical' }}
                                  value={editCommentText}
                                  onChange={e => setEditCommentText(e.target.value)}
                                />
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                  <button className="btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setEditingCommentId(null)}>Cancelar</button>
                                  <button className="btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }} onClick={handleSaveEdit}>Guardar</button>
                                </div>
                              </div>
                            ) : (
                              <p style={{ fontSize: '0.95rem', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{c.text}</p>
                            )}
                          </div>
                        ))}
                        {comments.length === 0 && (
                          <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>Aún no hay sugerencias de la comunidad. ¡Sé el primero en comentar!</p>
                        )}
                      </div>

                      {currentUser ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            type="text"
                            className="search-bar"
                            style={{ marginBottom: 0, paddingLeft: '1rem' }}
                            placeholder="Añade tu sugerencia táctica..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                          />
                          <button className="btn-primary" onClick={handleAddComment}>Publicar</button>
                        </div>
                      ) : (
                        <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', borderRadius: '12px' }}>
                          <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Inicia sesión para compartir tus estrategias con la comunidad.</p>
                          <button className="btn-primary" onClick={() => { closeModal(); setShowAuthModal(true); }}>Entrar para comentar</button>
                        </div>
                      )}
                    </div>

                  </div>
                </div>

              </div>
            </div>
          </div>
        )
      }

      {/* Auth Modal */}
      {
        showAuthModal && (
          <div className="modal-overlay" onClick={() => { setShowAuthModal(false); setAuthError(''); }} style={{ zIndex: 10010 }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: '#111116', border: '1px solid var(--accent-color)', borderRadius: '16px', padding: '2rem', maxWidth: '400px', width: '90%' }}>
              <h2 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>{isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
                {isRegistering ? 'Registra una clave única para tu alias de peleador.' : 'Entra con tu alias y tu clave.'}
              </p>

              {authError && <div style={{ background: 'rgba(255, 77, 77, 0.1)', color: '#FF4D4D', padding: '0.5rem', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center', fontSize: '0.85rem', border: '1px solid rgba(255, 77, 77, 0.3)' }}>{authError}</div>}

              <input
                type="text"
                className="search-bar"
                style={{ paddingLeft: '1rem', marginBottom: '1rem' }}
                placeholder="Nombre de usuario"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
              />
              <input
                type="password"
                className="search-bar"
                style={{ paddingLeft: '1rem', marginBottom: '0.5rem' }}
                placeholder="Contraseña"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
              />

              <div style={{ textAlign: 'right', marginBottom: '1.5rem' }}>
                <button onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}>
                  {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowAuthModal(false)}>Cancelar</button>
                <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleAuth}>
                  {isRegistering ? 'Registrar' : 'Entrar'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Friends & Chat Drawer */}
      {
        showFriends && currentUser && (
          <FriendsAndChat currentUser={currentUser} onClose={() => setShowFriends(false)} />
        )
      }

      {/* Profile Editor */}
      {
        showProfileEditor && currentUser && (
          <ProfileEditor currentUser={currentUser} onClose={() => setShowProfileEditor(false)} />
        )
      }

      {/* Donation Modal */}
      {
        showDonationModal && (
          <div className="modal-overlay" onClick={() => setShowDonationModal(false)} style={{ zIndex: 10015 }}>
            <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ background: '#111116', border: '1px solid #005691', borderRadius: '16px', padding: '2rem', maxWidth: '420px', width: '90%', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.2rem' }}>
                <div style={{ background: 'rgba(0, 112, 186, 0.1)', padding: '1rem', borderRadius: '50%' }}>
                  <img src="https://www.paypalobjects.com/webstatic/icon/pp258.png" style={{ width: '42px', height: '42px' }} alt="PayPal" />
                </div>
              </div>
              <h2 style={{ marginBottom: '0.6rem', fontSize: '1.5rem' }}>¡De Corazón, Gracias!</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem', lineHeight: '1.5' }}>
                Serás redirigido a PayPal de forma segura. Puedes usar tu saldo o tarjetas bancarias. ¡Tu ayuda es clave para nosotros!
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <a
                  href={PAYPAL_DONATION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  style={{ justifyContent: 'center', background: '#0070BA', boxShadow: '0 4px 15px rgba(0, 112, 186, 0.4)', padding: '0.9rem', width: '100%' }}
                >
                  Continuar a PayPal
                </a>
                <button className="btn-secondary" style={{ width: '100%', padding: '0.8rem' }} onClick={() => setShowDonationModal(false)}>
                  Cerrar
                </button>
              </div>
              
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: '1.5rem', fontStyle: 'italic' }}>
                * Nota para administrador: Actualiza `PAYPAL_DONATION_URL` en `App.tsx` con tu cuenta.
              </p>
            </div>
          </div>
        )
      }
    </>
  );
}
