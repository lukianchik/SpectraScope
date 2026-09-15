import type {
        AssetResponse,
        FindingResponse,
        RiskReportResponse,
        ScanResponse,
} from '../api/scans';

const DEMO_MODE_ENABLED = import.meta.env.VITE_DEMO_MODE === 'true';

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

export const DEMO_SCANS: ScanResponse[] = [
        {
                id: 'scan-aurora-001',
                target: 'aurora.acme.io',
                status: 'completed',
                scan_profile: 'safe',
                created_at: hoursAgo(3),
                started_at: hoursAgo(3),
                finished_at: hoursAgo(2),
                error_message: null,
        },
        {
                id: 'scan-legacy-002',
                target: 'legacy.lab.local:8088',
                status: 'running',
                scan_profile: 'lab',
                created_at: minutesAgo(8),
                started_at: minutesAgo(7),
                finished_at: null,
                error_message: null,
        },
        {
                id: 'scan-admin-003',
                target: 'admin.lab.local:8088',
                status: 'completed',
                scan_profile: 'lab',
                created_at: hoursAgo(12),
                started_at: hoursAgo(12),
                finished_at: hoursAgo(11),
                error_message: null,
        },
        {
                id: 'scan-corp-004',
                target: 'shop.example.com',
                status: 'completed',
                scan_profile: 'safe',
                created_at: daysAgo(1),
                started_at: daysAgo(1),
                finished_at: daysAgo(1),
                error_message: null,
        },
        {
                id: 'scan-edge-005',
                target: 'edge.example.org',
                status: 'failed',
                scan_profile: 'discovery',
                created_at: daysAgo(2),
                started_at: daysAgo(2),
                finished_at: daysAgo(2),
                error_message: 'Resolver timed out after 30s',
        },
        {
                id: 'scan-files-006',
                target: 'files.lab.local:8088',
                status: 'completed',
                scan_profile: 'lab',
                created_at: daysAgo(3),
                started_at: daysAgo(3),
                finished_at: daysAgo(3),
                error_message: null,
        },
        {
                id: 'scan-corp-007',
                target: 'mail.acme.io',
                status: 'completed',
                scan_profile: 'safe',
                created_at: daysAgo(5),
                started_at: daysAgo(5),
                finished_at: daysAgo(5),
                error_message: null,
        },
];

const techPool = [
        ['nginx', 'php', 'wordpress'],
        ['cloudflare', 'react', 'webpack'],
        ['caddy', 'go'],
        ['traefik', 'docker'],
        ['apache', 'php', 'mysql'],
        ['envoy', 'grpc', 'kubernetes'],
        ['vercel', 'next.js'],
        ['cloudfront', 'react', 'graphql'],
];

const hostnames = [
        'www', 'api', 'admin', 'mail', 'cdn', 'static', 'dev', 'staging',
        'shop', 'auth', 'sso', 'docs', 'vpn', 'mx1', 'mx2', 'monitor',
        'ci', 'grafana', 'kibana', 'jenkins', 'gitlab', 'jira', 'edge', 'webhook',
];

export const DEMO_ASSETS: AssetResponse[] = hostnames.map((prefix, i) => ({
        id: `asset-${i}`,
        scan_id: 'scan-aurora-001',
        hostname: `${prefix}.aurora.acme.io`,
        ip: `34.${120 + (i % 18)}.${(i * 7) % 250}.${(i * 13) % 250}`,
        is_alive: i % 7 !== 0,
        http_status: i % 7 === 0 ? null : i % 6 === 0 ? 403 : i % 5 === 0 ? 301 : 200,
        title: i % 4 === 0 ? null : `${prefix.toUpperCase()} · Aurora Platform`,
        technologies: techPool[i % techPool.length],
        created_at: hoursAgo(2),
}));

const findingTemplates: Array<Omit<FindingResponse, 'id' | 'scan_id' | 'asset_id' | 'created_at'>> = [
        {
                source_tool: 'nuclei',
                template_id: 'cve-2023-50164',
                name: 'Apache Struts2 Remote Code Execution',
                severity: 'critical',
                description: 'Path traversal in file upload allows arbitrary file write leading to RCE.',
                matched_at: 'https://legacy.lab.local:8088/upload',
                cve: 'CVE-2023-50164',
                cvss: 9.8,
                raw_json: null,
        },
        {
                source_tool: 'nuclei',
                template_id: 'exposed-admin-panel',
                name: 'Exposed Admin Panel without Auth',
                severity: 'critical',
                description: 'Administration panel reachable without authentication. Immediate triage required.',
                matched_at: 'https://admin.lab.local:8088/admin',
                cve: null,
                cvss: 9.1,
                raw_json: null,
        },
        {
                source_tool: 'nuclei',
                template_id: 'directory-listing',
                name: 'Directory Listing Enabled',
                severity: 'medium',
                description: 'Web server returns directory listings revealing internal file structure.',
                matched_at: 'https://files.lab.local:8088/backups/',
                cve: null,
                cvss: 5.3,
                raw_json: null,
        },
        {
                source_tool: 'httpx',
                template_id: 'tls-weak-ciphers',
                name: 'TLS Weak Ciphers Negotiated',
                severity: 'high',
                description: 'Server accepts CBC-mode ciphers vulnerable to Lucky-13. Drop to TLS 1.3 only.',
                matched_at: 'https://edge.example.org',
                cve: null,
                cvss: 7.4,
                raw_json: null,
        },
        {
                source_tool: 'nuclei',
                template_id: 'http-missing-security-headers',
                name: 'Missing Security Headers',
                severity: 'low',
                description: 'Content-Security-Policy and Strict-Transport-Security headers are not set.',
                matched_at: 'https://www.aurora.acme.io',
                cve: null,
                cvss: 3.1,
                raw_json: null,
        },
        {
                source_tool: 'subfinder',
                template_id: 'dangling-cname',
                name: 'Dangling CNAME Record',
                severity: 'high',
                description: 'Subdomain points to a deprovisioned cloud bucket - subdomain takeover possible.',
                matched_at: 'staging-legacy.aurora.acme.io',
                cve: null,
                cvss: 7.1,
                raw_json: null,
        },
        {
                source_tool: 'nuclei',
                template_id: 'cors-misconfig',
                name: 'CORS Misconfiguration',
                severity: 'medium',
                description: 'Wildcard origin with credentials enabled. Allows cross-origin data leakage.',
                matched_at: 'https://api.aurora.acme.io',
                cve: null,
                cvss: 6.4,
                raw_json: null,
        },
        {
                source_tool: 'nuclei',
                template_id: 'open-redirect',
                name: 'Open Redirect on Auth Flow',
                severity: 'low',
                description: 'Login callback parameter unvalidated; can redirect to attacker-controlled URLs.',
                matched_at: 'https://auth.aurora.acme.io/callback',
                cve: null,
                cvss: 4.3,
                raw_json: null,
        },
        {
                source_tool: 'httpx',
                template_id: 'http-info',
                name: 'Server Banner Disclosure',
                severity: 'info',
                description: 'Server version exposed via response header. Consider stripping for fingerprint reduction.',
                matched_at: 'https://mail.acme.io',
                cve: null,
                cvss: 1.2,
                raw_json: null,
        },
        {
                source_tool: 'nuclei',
                template_id: 'cve-2024-3094',
                name: 'XZ Utils Backdoor (sshd)',
                severity: 'critical',
                description: 'Compromised xz-utils version detected in advertised SSH banner.',
                matched_at: 'edge.example.org:22',
                cve: 'CVE-2024-3094',
                cvss: 10.0,
                raw_json: null,
        },
];

export const DEMO_FINDINGS: FindingResponse[] = findingTemplates.map((f, i) => ({
        ...f,
        id: `finding-${i}`,
        scan_id: 'scan-aurora-001',
        asset_id: `asset-${i % DEMO_ASSETS.length}`,
        created_at: hoursAgo(2),
}));

export const DEMO_REPORT: RiskReportResponse = {
        id: 'report-aurora-001',
        scan_id: 'scan-aurora-001',
        summary:
                'External attack surface review of aurora.acme.io discovered 24 assets across 8 technology stacks. ' +
                'Two critical findings warrant immediate remediation: an exposed admin panel on the legacy lab service and ' +
                'a Struts2 RCE on the upload endpoint. TLS weak ciphers and a dangling CNAME elevate medium-term risk. ' +
                'Overall posture is acceptable for staging but should not be promoted to production until critical items close.',
        top_risks: [
                { name: 'Exposed Admin Panel without Auth', severity: 'critical', score: 9.1 },
                { name: 'XZ Utils Backdoor (sshd)', severity: 'critical', score: 10.0 },
                { name: 'Apache Struts2 RCE', severity: 'critical', score: 9.8 },
                { name: 'TLS Weak Ciphers Negotiated', severity: 'high', score: 7.4 },
                { name: 'Dangling CNAME Record', severity: 'high', score: 7.1 },
        ],
        recommendations: [
                'Decommission or gate admin.lab.local:8088 behind VPN-only access immediately.',
                'Upgrade Apache Struts to a non-vulnerable build and validate file-upload allowlist.',
                'Rotate SSH host keys and audit packages for compromised xz-utils versions.',
                'Disable CBC-mode TLS ciphers and enforce TLS 1.3-only across the edge.',
                'Reclaim or remove dangling CNAMEs in DNS to prevent subdomain takeover.',
                'Add CSP, HSTS, and X-Content-Type-Options headers via edge proxy.',
        ],
        created_at: hoursAgo(2),
};
export function demoIsActive() {
        return DEMO_MODE_ENABLED || (
                typeof window !== 'undefined'
                && (window as unknown as { __SPECTRA_DEMO__?: boolean }).__SPECTRA_DEMO__ === true
        );
}

export function demoModeEnabled() {
        return DEMO_MODE_ENABLED;
}

export function markDemoActive() {
        if (typeof window !== 'undefined') {
                (window as unknown as { __SPECTRA_DEMO__?: boolean }).__SPECTRA_DEMO__ = true;
        }
}

export const formatRelative = (iso: string) => {
        const diff = Date.now() - new Date(iso).getTime();
        const s = Math.floor(diff / 1000);
        if (s < 60) return `${s}s ago`;
        const m = Math.floor(s / 60);
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        const d = Math.floor(h / 24);
        return `${d}d ago`;
};
