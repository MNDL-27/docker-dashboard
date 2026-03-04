function normalizeUrl(raw: string): string {
    return raw.replace(/\/+$/, '');
}

export function getPublicApiUrl(): string {
    const configuredUrl = process.env.PUBLIC_API_URL?.trim() || process.env.CLOUD_API_URL?.trim();
    if (configuredUrl) {
        return normalizeUrl(configuredUrl);
    }

    const port = process.env.PORT || '3001';
    return `http://localhost:${port}`;
}

export function assertProdTransport(): void {
    if (process.env.NODE_ENV !== 'production') {
        return;
    }

    const publicApiUrl = getPublicApiUrl();
    const parsed = new URL(publicApiUrl);
    if (parsed.protocol !== 'https:') {
        throw new Error('PUBLIC_API_URL must use https in production');
    }
}
