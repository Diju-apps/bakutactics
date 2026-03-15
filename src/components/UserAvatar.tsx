import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getOptimizedImageUrl } from '../utils/imageOptimization';

const avatarCache: Record<string, string | null> = {};

interface UserAvatarProps {
    username: string;
    size?: number;
    showBorder?: boolean;
    overrideAvatar?: string | null;
}

export default function UserAvatar({ username, size = 40, showBorder = true, overrideAvatar }: UserAvatarProps) {
    const [avatar, setAvatar] = useState<string | null>(
        overrideAvatar !== undefined ? overrideAvatar : (avatarCache[username.toLowerCase()] || null)
    );

    useEffect(() => {
        if (!username) return;

        if (overrideAvatar !== undefined) {
            setAvatar(overrideAvatar);
            return;
        }
        if (avatarCache[username.toLowerCase()] !== undefined) {
            setAvatar(avatarCache[username.toLowerCase()]);
            return;
        }
        let isMounted = true;
        const fetchAvatar = async () => {
            try {
                const docRef = doc(db, 'users', username.toLowerCase());
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().avatar) {
                    avatarCache[username.toLowerCase()] = docSnap.data().avatar;
                    if (isMounted) setAvatar(docSnap.data().avatar);
                } else {
                    avatarCache[username.toLowerCase()] = null;
                    if (isMounted) setAvatar(null);
                }
            } catch (e) {
                console.error("Error fetching avatar:", e);
            }
        };
        fetchAvatar();
        return () => { isMounted = false; };
    }, [username, overrideAvatar]);

    if (avatar) {
        return (
            <img
                src={getOptimizedImageUrl(avatar, size)}
                alt={username}
                style={{
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: showBorder ? '2px solid var(--accent-color)' : 'none',
                    flexShrink: 0
                }}
            />
        );
    }

    return (
        <div style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'var(--accent-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: size * 0.4,
            border: showBorder ? '2px solid var(--accent-color)' : 'none',
            flexShrink: 0
        }}>
            {username ? username.charAt(0).toUpperCase() : '?'}
        </div>
    );
}
