import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, setDoc, Timestamp } from 'firebase/firestore';
import { Shield, X, Check, Clock } from 'lucide-react';
import UserAvatar from './UserAvatar';

interface Challenge {
    id: string;
    challenger: string;
    challenged: string;
    status: 'pending' | 'accepted' | 'rejected' | 'expired';
    createdAt: any;
}

export default function ChallengeNotification({ challenge, onAccept, onClose }: { challenge: Challenge, onAccept: (battleId: string) => void, onClose: () => void }) {
    const [timeLeft, setTimeLeft] = useState<number>(300); // 5 mins in seconds
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        if (!challenge.createdAt) return;

        const createdMs = typeof challenge.createdAt.toMillis === 'function' ? challenge.createdAt.toMillis() : challenge.createdAt;
        const elapsedSeconds = Math.floor((Date.now() - createdMs) / 1000);
        const remaining = 300 - elapsedSeconds;

        if (remaining <= 0) {
            handleExpire();
            return;
        }

        setTimeLeft(remaining);

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleExpire();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [challenge.createdAt]);

    const handleExpire = async () => {
        setIsUpdating(true);
        try {
            const challengeRef = doc(db, 'challenges', challenge.id);
            await updateDoc(challengeRef, { status: 'expired' });
            onClose();
        } catch (error) {
            console.error("Error expiring challenge", error);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleAccept = async () => {
        setIsUpdating(true);
        const challengeRef = doc(db, 'challenges', challenge.id);
        const battleId = `battle_${Date.now()}`;
        const battleRef = doc(db, 'battles', battleId);

        try {
            // Create Battle Document
            await setDoc(battleRef, {
                id: battleId,
                player1: challenge.challenger,
                player2: challenge.challenged,
                status: 'deck_selection',
                sets: {
                    set1: { winner: null },
                    set2: { winner: null },
                    set3: { winner: null }
                },
                createdAt: Timestamp.now()
            });

            // Update Challenge
            await updateDoc(challengeRef, { status: 'accepted', battleId });
            
            onAccept(battleId);
        } catch (error) {
            console.error("Error accepting challenge", error);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleReject = async () => {
        setIsUpdating(true);
        try {
            const challengeRef = doc(db, 'challenges', challenge.id);
            await updateDoc(challengeRef, { status: 'rejected' });
            onClose();
        } catch (error) {
            console.error("Error rejecting challenge", error);
        } finally {
            setIsUpdating(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 11000, width: '320px' }} className="animate-fade-in">
            <div className="glass-panel" style={{ padding: '1.5rem', border: '2px solid var(--accent-color)', borderRadius: '12px', background: '#0a0a0f', boxShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-color)', fontWeight: 'bold' }}>
                        <Shield size={18} /> ¡Reto de Combate!
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <Clock size={14} /> {formatTime(timeLeft)}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <UserAvatar username={challenge.challenger} size={40} />
                    <div>
                        <div style={{ fontWeight: 'bold' }}>@{challenge.challenger}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Te invita a pelear</div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                        className="btn-secondary" 
                        style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                        onClick={handleReject}
                        disabled={isUpdating}
                    >
                        <X size={16} /> Rechazar
                    </button>
                    <button 
                        className="btn-primary" 
                        style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                        onClick={handleAccept}
                        disabled={isUpdating}
                    >
                        <Check size={16} /> Aceptar
                    </button>
                </div>
            </div>
        </div>
    );
}
