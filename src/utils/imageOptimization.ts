import { useEffect } from 'react';

/**
 * 1. Función Utilitaria de Optimización (Proxy Wrapper)
 * 
 * Toma una URL original y la transforma usando el servicio wsrv.nl para procesar 
 * la imagen externa al vuelo (On-the-Fly).
 * 
 * @param originalUrl - La URL pesada original (ej: de Bloxugan)
 * @param width - Ancho deseado en píxeles (default: 200)
 * @param quality - Calidad de la imagen (1-100, default: 50 para máxima optimización)
 * @returns La nueva URL optimizada (WebP) o string vacío/fallback
 */
export const getOptimizedImageUrl = (originalUrl: string | undefined, width: number = 200, quality: number = 50): string => {
    // Validación: si la originalUrl está vacía o es indefinida, retorna string vacío
    if (!originalUrl) return '';

    // Si ya es un data URI (base64) lo devolvemos tal cual (ya debería estar comprimido por compressImage)
    if (originalUrl.startsWith('data:')) {
        return originalUrl;
    }

    // Si la URL ya está optimizada por nuestro proxy, la devolvemos para evitar "double-wrapping"
    if (originalUrl.includes('wsrv.nl')) {
        return originalUrl;
    }

    // Si es una ruta local o localhost, la devolvemos tal cual
    if (originalUrl.startsWith('/') || originalUrl.includes('localhost')) {
        return originalUrl;
    }

    // Estructura: https://wsrv.nl/?url=${encodeURIComponent(originalUrl)}&w=${width}&output=webp&q=${quality}
    // Parámetros: 
    // - output=webp: Fuerza la salida a formato WebP (más ligero)
    // - w: Ajusta el ancho según el parámetro pasado
    // - q: Calidad ajustable (default 50 para ahorro agresivo)
    return `https://wsrv.nl/?url=${encodeURIComponent(originalUrl)}&w=${width}&output=webp&q=${quality}`;
};

/**
 * 2. Compresión de Imagen para Subidas (Local Compression)
 * 
 * Recibe un archivo de imagen y devuelve una base64 optimizada (WebP, baja calidad).
 */
export const compressImage = (file: File, maxWidth: number = 300, quality: number = 0.4): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxWidth) {
                        width *= maxWidth / height;
                        height = maxWidth;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                // Convertimos a WebP con calidad reducida (0.4 es muy agresivo pero efectivo)
                // Fallback a jpeg si el browser no soporta webp en canvas (raro hoy en día)
                const dataUrl = canvas.toDataURL('image/webp', quality);
                resolve(dataUrl);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

/**
 * Wrapper para miniaturas (Thumbnails)
 */
export const getOptimizedThumbnailUrl = (originalUrl: string | undefined): string => {
    return getOptimizedImageUrl(originalUrl, 200, 50);
};

/**
 * 3. Pre-carga Silenciosa (Image Prefetching/Preloading)
 */
export const usePreloadImages = (urls: string[]) => {
    useEffect(() => {
        if (!urls || urls.length === 0) return;

        const preload = () => {
            urls.forEach(url => {
                if (!url) return;
                const img = new Image();
                img.src = url;
            });
        };

        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => preload());
        } else {
            setTimeout(preload, 1000);
        }
    }, [urls]);
};
