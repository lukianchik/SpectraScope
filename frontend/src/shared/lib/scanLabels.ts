import type { ScanResponse } from '../api/scans';

export function formatScanCode(scanId: string) {
        const compact = scanId.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase();
        return `SCN-${compact || 'UNKNOWN'}`;
}

export function formatScanTime(scan: ScanResponse) {
        const value = scan.started_at ?? scan.created_at;
        return new Intl.DateTimeFormat(undefined, {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
        }).format(new Date(value));
}
