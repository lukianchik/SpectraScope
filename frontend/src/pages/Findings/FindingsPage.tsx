import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Search, TriangleAlert } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../../Header/Header';
import { useScansList, useScanFindings } from '../../shared/hooks/useScansData';
import type { FindingResponse, Severity } from '../../shared/api/scans';
import { triageFinding } from '../../shared/api/scans';
import { ScanSelector } from '../../shared/ui/ScanSelector';
import s from '../_shared/pageStyles.module.scss';
import own from './FindingsPage.module.scss';

const SEVERITIES: Array<Severity | 'all'> = ['all', 'critical', 'high', 'medium', 'low', 'info'];

export function FindingsPage() {
        const scansQuery = useScansList();
        const [searchParams, setSearchParams] = useSearchParams();
        const scans = scansQuery.data?.items ?? [];
        const requestedId = searchParams.get('scan');
        const selectedScan =
                scans.find((scan) => scan.id === requestedId) ??
                scans.find((scan) => scan.status === 'completed') ??
                scans[0] ??
                null;
        const localTarget = selectedScan?.scan_profile === 'local-real' ? selectedScan.target : null;
        const findingsQuery = useScanFindings(selectedScan?.id ?? null, selectedScan?.status);
        const [sev, setSev] = useState<Severity | 'all'>('all');
        const [q, setQ] = useState('');
        const [picked, setPicked] = useState<FindingResponse | null>(null);
        const queryClient = useQueryClient();

        const list = useMemo(() => {
                const all = findingsQuery.data?.items ?? [];
                return all
                        .filter((f) => sev === 'all' || f.severity === sev)
                        .filter(
                                (f) =>
                                        f.name.toLowerCase().includes(q.toLowerCase()) ||
                                        (f.cve ?? '').toLowerCase().includes(q.toLowerCase()) ||
                                        (f.matched_at ?? '').toLowerCase().includes(q.toLowerCase()),
                        );
        }, [findingsQuery.data, sev, q]);

        const triageMutation = useMutation({
                mutationFn: ({ finding, status }: { finding: FindingResponse; status: NonNullable<FindingResponse['triage_status']> }) =>
                        triageFinding(finding.scan_id, finding.id, { status }),
                onSuccess: (updated) => {
                        setPicked(updated);
                        void queryClient.invalidateQueries({ queryKey: ['scan-findings', updated.scan_id] });
                },
        });

        const counts = (findingsQuery.data?.items ?? []).reduce<Record<string, number>>((acc, f) => {
                acc[f.severity] = (acc[f.severity] ?? 0) + 1;
                return acc;
        }, {});
        const totalAll = findingsQuery.data?.items.length ?? 0;

        return (
                <>
                        <Header
                                eyebrow="Risk"
                                title="Findings"
                                subtitle="Normalized scanner findings with readable evidence and source metadata."
                        />

                        <ScanSelector
                                scans={scans}
                                selectedId={selectedScan?.id ?? null}
                                isLoading={scansQuery.isPending}
                                onChange={(scanId) => {
                                        const next = new URLSearchParams(searchParams);
                                        next.set('scan', scanId);
                                        setSearchParams(next, { replace: true });
                                        setPicked(null);
                                }}
                        />

                        <div className={s.toolbar}>
                                <div className={s.tabs} role="tablist">
                                        {SEVERITIES.map((sv) => (
                                                <button
                                                        key={sv}
                                                        role="tab"
                                                        className={`${s.tabBtn} ${sev === sv ? s.tabActive : ''}`}
                                                        onClick={() => setSev(sv)}
                                                        data-testid={`findings-tab-${sv}`}
                                                >
                                                        {sv === 'all' ? 'All' : sv} <span className={s.kbd}>{sv === 'all' ? totalAll : counts[sv] ?? 0}</span>
                                                </button>
                                        ))}
                                </div>
                                <div className={s.toolbarRight}>
                                        <div className={s.search}>
                                                <Search size={14} />
                                                <input
                                                        placeholder="Search name, CVE, URL…"
                                                        value={q}
                                                        onChange={(e) => setQ(e.target.value)}
                                                />
                                        </div>
                                </div>
                        </div>

                        <ul className={own.list}>
                                {list.length === 0 ? (
                                        <li className={s.empty}>
                                                <TriangleAlert size={20} /> No findings match.
                                        </li>
                                ) : null}
                                {list.map((finding) => {
                                        const isOpen = picked?.id === finding.id;
                                        return (
                                                <li key={finding.id} className={`${own.item} ${isOpen ? own.itemOpen : ''}`}>
                                                        <button
                                                                type="button"
                                                                className={own.row}
                                                                onClick={() => setPicked(isOpen ? null : finding)}
                                                                aria-expanded={isOpen}
                                                                data-testid={`finding-row-${finding.id}`}
                                                        >
                                                                <span className={`${s.sev} ${s[finding.severity]}`}>{finding.severity}</span>
                                                                <span className={own.body}>
                                                                        <span className={own.name}>{finding.name}</span>
                                                                        <span className={own.where}>
                                                                                <span className={s.tag}>{finding.source_tool}</span>
                                                                                {finding.cve ? <span className={s.tag}>{finding.cve}</span> : null}
                                                                                <span className={own.url}>{displayMatchedAt(finding.matched_at, localTarget)}</span>
                                                                        </span>
                                                                </span>
                                                                <span className={own.cvss}>{finding.cvss?.toFixed(1) ?? '—'}</span>
                                                                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                        </button>

                                                        {isOpen ? (
                                                                <FindingDetails
                                                                        finding={picked ?? finding}
                                                                        localTarget={localTarget}
                                                                        onTriage={(status) => triageMutation.mutate({ finding, status })}
                                                                        pending={triageMutation.isPending}
                                                                />
                                                        ) : null}
                                                </li>
                                        );
                                })}
                        </ul>
                </>
        );
}

function FindingDetails({
        finding,
        localTarget,
        onTriage,
        pending,
}: {
        finding: FindingResponse;
        localTarget: string | null;
        onTriage: (status: NonNullable<FindingResponse['triage_status']>) => void;
        pending: boolean;
}) {
        const request = evidenceString(finding.raw_json, 'request');
        const response = evidenceString(finding.raw_json, 'response');
        const curlCommand = evidenceString(finding.raw_json, 'curl-command');

        return (
                <section className={own.details} aria-label={`${finding.name} evidence`}>
                        <div className={own.detailsIntro}>
                                <div>
                                        <p className={own.detailEyebrow}>Finding details</p>
                                        <h3>{finding.name}</h3>
                                        <p className={own.desc}>{finding.description ?? 'No description available.'}</p>
                                </div>
                                <dl className={own.meta}>
                                        <div><dt>Source tool</dt><dd>{finding.source_tool}</dd></div>
                                        <div><dt>Template</dt><dd>{finding.template_id ?? '—'}</dd></div>
                                        <div><dt>CVE</dt><dd>{finding.cve ?? '—'}</dd></div>
                                        <div><dt>CVSS</dt><dd>{finding.cvss?.toFixed(1) ?? '—'}</dd></div>
                                        <div className={own.matchedAt}><dt>Matched at</dt><dd>{displayMatchedAt(finding.matched_at, localTarget)}</dd></div>
                                </dl>
                        </div>

                        <div className={own.triageBar}>
                                <span>Triage: <strong>{finding.triage_status ?? 'open'}</strong></span>
                                {(['open', 'in_progress', 'resolved', 'accepted_risk', 'false_positive'] as const).map((status) => (
                                        <button key={status} type="button" disabled={pending || finding.triage_status === status} onClick={() => onTriage(status)}>
                                                {status.replace('_', ' ')}
                                        </button>
                                ))}
                        </div>

                        <div className={own.evidenceSection}>
                                <div className={own.evidenceHeading}>
                                        <div>
                                                <p className={own.detailEyebrow}>Scanner evidence</p>
                                                <h4>Observed HTTP exchange</h4>
                                        </div>
                                        <span>Read-only source data</span>
                                </div>

                                {request || response ? (
                                        <div className={own.evidenceGrid}>
                                                <EvidenceBlock title="Request" value={request ?? 'Request was not returned by the scanner.'} />
                                                <EvidenceBlock title="Response" value={response ?? 'Response was not returned by the scanner.'} />
                                        </div>
                                ) : (
                                        <p className={own.noEvidence}>No HTTP request or response was returned by the scanner.</p>
                                )}

                                {curlCommand ? (
                                        <div className={own.commandBlock}>
                                                <span>Reproduction command</span>
                                                <code>{curlCommand}</code>
                                        </div>
                                ) : null}

                                <details className={own.rawDetails}>
                                        <summary>Scanner metadata</summary>
                                        <pre>{formatScannerMetadata(finding.raw_json)}</pre>
                                </details>
                        </div>
                </section>
        );
}

function EvidenceBlock({ title, value }: { title: string; value: string }) {
        return (
                <article className={own.evidenceBlock}>
                        <h5>{title}</h5>
                        <pre>{value}</pre>
                </article>
        );
}

function evidenceString(raw: Record<string, unknown> | null, key: string) {
        const value = raw?.[key];
        return typeof value === 'string' && value.trim() ? value : null;
}

function formatScannerMetadata(raw: Record<string, unknown> | null) {
        if (!raw) {
                return 'No scanner metadata returned.';
        }

        const metadata = Object.fromEntries(
                Object.entries(raw).filter(
                        ([key]) => !['request', 'response', 'template', 'template-encoded', 'curl-command'].includes(key),
                ),
        );
        return JSON.stringify(metadata, null, 2);
}

function displayMatchedAt(value: string | null, localTarget: string | null) {
        if (!value) {
                return '—';
        }
        if (!localTarget) {
                return value;
        }

        try {
                const parsed = new URL(value);
                if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(parsed.hostname)) {
                        return value;
                }
                return `${parsed.protocol}//${localTarget}${parsed.pathname}${parsed.search}${parsed.hash}`;
        } catch {
                return value;
        }
}
