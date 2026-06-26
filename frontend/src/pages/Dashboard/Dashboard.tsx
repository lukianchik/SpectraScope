import { useState } from 'react';
import {
        Activity,
        ArrowUpRight,
        Boxes,
        ChevronRight,
        Server,
        ShieldAlert,
        TerminalSquare,
        TriangleAlert,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header } from '../../Header/Header';
import { MetricsGrid } from '../../MetricsGrid/MetricsGrid';
import { StartScan } from '../../StartScan/StartScan';
import { getApiErrorMessage } from '../../shared/api/client';
import {
        useScan,
        useScanAssets,
        useScanFindings,
        useScanReport,
        useScansList,
        useStartScan,
} from '../../shared/hooks/useScansData';
import {
        buildMetrics,
        buildScanSteps,
        formatScanStatus,
        formatStatusHeadline,
        formatStatusMeta,
} from '../../types/dashboard';
import {
        DEMO_TIMELINE,
        DEMO_TREND,
        formatRelative,
} from '../../shared/mock/demoData';
import styles from './Dashboard.module.scss';

const TABS = [
        { key: 'overview', label: 'Overview' },
        { key: 'trends', label: 'Severity Trends' },
        { key: 'activity', label: 'Activity Feed' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export function Dashboard() {
        const [tab, setTab] = useState<TabKey>('overview');
        const [activeScanId, setActiveScanId] = useState<string | null>(null);

        const scansQuery = useScansList();
        // Pick active scan once
        if (!activeScanId && scansQuery.data?.items.length) {
                const preferred =
                        scansQuery.data.items.find((s) => ['created', 'running'].includes(s.status)) ??
                        scansQuery.data.items[0];
                setActiveScanId(preferred.id);
        }

        const scanQuery = useScan(activeScanId);
        const currentScan = scanQuery.data ?? null;
        const assetsQuery = useScanAssets(activeScanId);
        const findingsQuery = useScanFindings(activeScanId);
        const reportQuery = useScanReport(activeScanId, currentScan?.status);
        const startScanMutation = useStartScan();

        const assets = assetsQuery.data?.items ?? [];
        const findings = findingsQuery.data?.items ?? [];
        const report = reportQuery.data ?? null;
        const metrics = buildMetrics(assets, findings, report);
        const scanSteps = buildScanSteps(currentScan, assets, findings, report);
        const activeQueueCount =
                scansQuery.data?.items.filter((s) => s.status === 'created' || s.status === 'running').length ?? 0;

        const statusBadgeLabel = scanQuery.isError
                ? 'Error'
                : formatScanStatus(currentScan?.status ?? null);
        const statusHeadline = scanQuery.isPending
                ? 'Loading selected scan…'
                : formatStatusHeadline(currentScan);
        const statusMeta = scanQuery.isError
                ? getApiErrorMessage(scanQuery.error)
                : formatStatusMeta(currentScan, assets.length, findings.length, report);

        // Severity buckets for the legend
        const sevCount = findings.reduce(
                (acc, f) => {
                        acc[f.severity] = (acc[f.severity] ?? 0) + 1;
                        return acc;
                },
                { critical: 0, high: 0, medium: 0, low: 0, info: 0 } as Record<string, number>,
        );

        const sevLegend = [
                { key: 'critical', label: 'Critical', color: '#ff4f7a', count: sevCount.critical },
                { key: 'high', label: 'High', color: '#ff8e4c', count: sevCount.high },
                { key: 'medium', label: 'Medium', color: '#ffb347', count: sevCount.medium },
                { key: 'low', label: 'Low', color: '#7ea0d8', count: sevCount.low },
                { key: 'info', label: 'Info', color: '#566c8c', count: sevCount.info },
        ];

        return (
                <>
                        <Header
                                eyebrow="Live posture"
                                title="Mission Control"
                                subtitle="Real-time view of the active scan, discovered assets and security findings across your authorized perimeter."
                        />

                        <section className={styles.heroGrid}>
                                <StartScan
                                        activeQueueCount={activeQueueCount}
                                        errorMessage={
                                                startScanMutation.isError ? getApiErrorMessage(startScanMutation.error) : null
                                        }
                                        isSubmitting={startScanMutation.isPending}
                                        onSubmit={async (payload) => {
                                                const scan = await startScanMutation.mutateAsync(payload);
                                                setActiveScanId(scan.id);
                                        }}
                                />

                                <article className={styles.statusPanel} data-testid="status-panel">
                                        <div className={styles.statusHeader}>
                                                <div>
                                                        <p className={styles.sectionEyebrow}>Execution status</p>
                                                        <h2>{statusHeadline}</h2>
                                                        <p className={styles.statusMeta}>{statusMeta}</p>
                                                </div>
                                                <span
                                                        className={`${styles.statusBadge} ${
                                                                scanQuery.isError
                                                                        ? styles.failed
                                                                        : currentScan
                                                                                ? styles[currentScan.status]
                                                                                : styles.idleStatus
                                                        }`}
                                                        data-testid="status-badge"
                                                >
                                                        {statusBadgeLabel}
                                                </span>
                                        </div>

                                        <div className={styles.steps}>
                                                {scanSteps.map((step, index) => (
                                                        <div key={step.title} className={styles.stepItem}>
                                                                <div className={styles.stepTrack}>
                                                                        <span
                                                                                className={`${styles.stepDot} ${
                                                                                        step.completed ? styles.stepDone : styles.stepPending
                                                                                }`}
                                                                        >
                                                                                {step.completed ? '✓' : index + 1}
                                                                        </span>
                                                                        {index < scanSteps.length - 1 ? <span className={styles.stepLine} /> : null}
                                                                </div>
                                                                <div>
                                                                        <p className={styles.stepTitle}>{step.title}</p>
                                                                        <p className={styles.stepSubtitle}>{step.subtitle}</p>
                                                                </div>
                                                        </div>
                                                ))}
                                        </div>
                                </article>
                        </section>

                        <MetricsGrid metrics={metrics} />

                        <div className={styles.tabsRow} role="tablist" data-testid="dashboard-tabs">
                                {TABS.map((t) => (
                                        <button
                                                key={t.key}
                                                role="tab"
                                                aria-selected={tab === t.key}
                                                className={`${styles.tabBtn} ${tab === t.key ? styles.tabActive : ''}`}
                                                onClick={() => setTab(t.key)}
                                                data-testid={`tab-${t.key}`}
                                        >
                                                {t.label}
                                        </button>
                                ))}
                                <span className={styles.tabsHint}>
                                        <TerminalSquare size={14} /> live · auto-refresh
                                </span>
                        </div>

                        {tab === 'overview' ? <OverviewPanel
                                sevLegend={sevLegend}
                                findings={findings}
                                assets={assets}
                        /> : null}

                        {tab === 'trends' ? <TrendsPanel /> : null}

                        {tab === 'activity' ? <ActivityPanel /> : null}
                </>
        );
}

interface OverviewPanelProps {
        sevLegend: Array<{ key: string; label: string; color: string; count: number }>;
        findings: ReturnType<typeof useScanFindings>['data'] extends infer T
                ? T extends { items: infer I } ? I : never[]
                : never[];
        assets: ReturnType<typeof useScanAssets>['data'] extends infer T
                ? T extends { items: infer I } ? I : never[]
                : never[];
}

function OverviewPanel({ sevLegend, findings, assets }: OverviewPanelProps) {
        const total = sevLegend.reduce((sum, s) => sum + s.count, 0) || 1;
        let offset = 0;
        const gradStops = sevLegend
                .map((s) => {
                        const pct = (s.count / total) * 100;
                        const start = offset;
                        offset += pct;
                        return `${s.color} ${start}% ${offset}%`;
                })
                .join(', ');

        const topFindings = (findings ?? []).slice(0, 5);
        const topAssets = (assets ?? []).filter((a) => a.is_alive).slice(0, 6);

        return (
                <section className={styles.analyticsGrid} data-testid="overview-panel">
                        <article className={styles.glassCard}>
                                <div className={styles.panelHeader}>
                                        <div>
                                                <p className={styles.sectionEyebrow}>Severity distribution</p>
                                                <h3>Findings mix</h3>
                                        </div>
                                </div>
                                <div className={styles.riskContent}>
                                        <div
                                                className={styles.riskRing}
                                                style={{ ['--risk-gradient' as string]: `conic-gradient(${gradStops})` }}
                                        >
                                                <div className={styles.riskRingInner}>
                                                        <strong>{total === 1 && sevLegend.every((s) => s.count === 0) ? 0 : findings?.length ?? 0}</strong>
                                                        <span>findings</span>
                                                </div>
                                        </div>
                                        <ul className={styles.riskLegend}>
                                                {sevLegend.map((s) => (
                                                        <li key={s.key}>
                                                                <span className={styles.riskSwatch} style={{ background: s.color }} />
                                                                <span className={styles.legendLabel}>{s.label}</span>
                                                                <span className={styles.legendValue}>{s.count}</span>
                                                        </li>
                                                ))}
                                        </ul>
                                </div>
                        </article>

                        <article className={styles.glassCard}>
                                <div className={styles.panelHeader}>
                                        <div>
                                                <p className={styles.sectionEyebrow}>Top findings</p>
                                                <h3>What needs triage</h3>
                                        </div>
                                        <Link to="/findings" className={styles.panelLink}>
                                                View all <ChevronRight size={14} />
                                        </Link>
                                </div>
                                <ul className={styles.findingList}>
                                        {topFindings.length === 0 ? (
                                                <li className={styles.empty}>
                                                        <ShieldAlert size={16} /> No findings recorded yet.
                                                </li>
                                        ) : null}
                                        {topFindings.map((f) => (
                                                <li key={f.id} className={styles.findingRow}>
                                                        <div className={styles.findingBody}>
                                                                <p className={styles.findingTitle}>{f.name}</p>
                                                                <p className={styles.findingDescription}>
                                                                        {f.description ?? f.matched_at ?? '—'}
                                                                </p>
                                                        </div>
                                                        <span className={`${styles.findingBadge} ${styles[f.severity]}`}>
                                                                {f.severity}
                                                        </span>
                                                </li>
                                        ))}
                                </ul>
                        </article>

                        <article className={styles.glassCard}>
                                <div className={styles.panelHeader}>
                                        <div>
                                                <p className={styles.sectionEyebrow}>Live assets</p>
                                                <h3>Reachable hosts</h3>
                                        </div>
                                        <Link to="/assets" className={styles.panelLink}>
                                                Inventory <ChevronRight size={14} />
                                        </Link>
                                </div>
                                <ul className={styles.assetList}>
                                        {topAssets.length === 0 ? (
                                                <li className={styles.empty}>
                                                        <Server size={16} /> No live hosts in current scan.
                                                </li>
                                        ) : null}
                                        {topAssets.map((a) => (
                                                <li key={a.id} className={styles.assetRow}>
                                                        <div>
                                                                <p className={styles.assetName}>{a.hostname}</p>
                                                                <p className={styles.assetIp}>{a.ip ?? 'no IP'} · {(a.technologies ?? []).slice(0, 3).join(' · ') || 'unknown stack'}</p>
                                                        </div>
                                                        <span className={styles.assetMeta}>
                                                                <span className={`${styles.assetStatus} ${styles.monitored}`}>
                                                                        {a.http_status ?? 'n/a'}
                                                                </span>
                                                        </span>
                                                </li>
                                        ))}
                                </ul>
                        </article>
                </section>
        );
}

function TrendsPanel() {
        const max = Math.max(
                ...DEMO_TREND.flatMap((d) => [d.critical, d.high, d.medium, d.low]),
                10,
        );
        const w = 560;
        const h = 220;
        const pad = 28;
        const colW = (w - pad * 2) / (DEMO_TREND.length - 1);

        const buildPath = (key: 'critical' | 'high' | 'medium' | 'low') =>
                DEMO_TREND.map((d, i) => {
                        const x = pad + i * colW;
                        const y = h - pad - (d[key] / max) * (h - pad * 2);
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ');

        const series = [
                { key: 'critical' as const, color: '#ff4f7a', label: 'Critical' },
                { key: 'high' as const, color: '#ff8e4c', label: 'High' },
                { key: 'medium' as const, color: '#ffb347', label: 'Medium' },
                { key: 'low' as const, color: '#7ea0d8', label: 'Low' },
        ];

        return (
                <section className={styles.trendsGrid} data-testid="trends-panel">
                        <article className={styles.glassCard}>
                                <div className={styles.panelHeader}>
                                        <div>
                                                <p className={styles.sectionEyebrow}>Last 7 days</p>
                                                <h3>Severity trend</h3>
                                        </div>
                                        <div className={styles.legendRow}>
                                                {series.map((s) => (
                                                        <span key={s.key} className={styles.legendChip}>
                                                                <span className={styles.legendSwatch} style={{ background: s.color }} />
                                                                {s.label}
                                                        </span>
                                                ))}
                                        </div>
                                </div>
                                <svg className={styles.chart} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
                                        <defs>
                                                {series.map((s) => (
                                                        <linearGradient key={s.key} id={`g-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                                                                <stop offset="0%" stopColor={s.color} stopOpacity="0.4" />
                                                                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                                                        </linearGradient>
                                                ))}
                                        </defs>
                                        {[0, 1, 2, 3].map((g) => (
                                                <line
                                                        key={g}
                                                        x1={pad}
                                                        x2={w - pad}
                                                        y1={pad + g * ((h - pad * 2) / 3)}
                                                        y2={pad + g * ((h - pad * 2) / 3)}
                                                        stroke="rgba(126, 160, 216, 0.1)"
                                                        strokeDasharray="3 6"
                                                />
                                        ))}
                                        {series.map((s) => (
                                                <g key={s.key}>
                                                        <path
                                                                d={`${buildPath(s.key)} L ${pad + (DEMO_TREND.length - 1) * colW} ${h - pad} L ${pad} ${h - pad} Z`}
                                                                fill={`url(#g-${s.key})`}
                                                        />
                                                        <path d={buildPath(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
                                                        {DEMO_TREND.map((d, i) => {
                                                                const x = pad + i * colW;
                                                                const y = h - pad - (d[s.key] / max) * (h - pad * 2);
                                                                return <circle key={i} cx={x} cy={y} r="3" fill={s.color} />;
                                                        })}
                                                </g>
                                        ))}
                                </svg>
                                <div className={styles.chartLabels}>
                                        {DEMO_TREND.map((d) => (
                                                <span key={d.label}>{d.label}</span>
                                        ))}
                                </div>
                        </article>

                        <article className={styles.glassCard}>
                                <div className={styles.panelHeader}>
                                        <div>
                                                <p className={styles.sectionEyebrow}>Posture</p>
                                                <h3>This week vs last</h3>
                                        </div>
                                </div>
                                <ul className={styles.deltaList}>
                                        <li>
                                                <div>
                                                        <strong>Critical findings</strong>
                                                        <p>Across all scans</p>
                                                </div>
                                                <span className={`${styles.delta} ${styles.deltaDown}`}>
                                                        <ArrowUpRight size={14} style={{ transform: 'rotate(90deg)' }} /> 18%
                                                </span>
                                        </li>
                                        <li>
                                                <div>
                                                        <strong>Median time-to-detect</strong>
                                                        <p>From asset birth to flag</p>
                                                </div>
                                                <span className={`${styles.delta} ${styles.deltaDown}`}>
                                                        <ArrowUpRight size={14} style={{ transform: 'rotate(90deg)' }} /> 2.4h
                                                </span>
                                        </li>
                                        <li>
                                                <div>
                                                        <strong>Asset growth</strong>
                                                        <p>New hostnames discovered</p>
                                                </div>
                                                <span className={`${styles.delta} ${styles.deltaUp}`}>
                                                        <ArrowUpRight size={14} /> 12 hosts
                                                </span>
                                        </li>
                                        <li>
                                                <div>
                                                        <strong>Adapter coverage</strong>
                                                        <p>Tools currently running</p>
                                                </div>
                                                <span className={`${styles.delta} ${styles.deltaUp}`}>
                                                        <ArrowUpRight size={14} /> 3 / 4
                                                </span>
                                        </li>
                                </ul>
                        </article>
                </section>
        );
}

function ActivityPanel() {
        const iconFor = (kind: string) => {
                if (kind === 'finding') return TriangleAlert;
                if (kind === 'asset') return Boxes;
                if (kind === 'report') return ShieldAlert;
                return Activity;
        };

        return (
                <section className={styles.activityGrid} data-testid="activity-panel">
                        <article className={styles.glassCard}>
                                <div className={styles.panelHeader}>
                                        <div>
                                                <p className={styles.sectionEyebrow}>Live feed</p>
                                                <h3>Recent activity</h3>
                                        </div>
                                </div>
                                <ol className={styles.timeline}>
                                        {DEMO_TIMELINE.map((t, i) => {
                                                const Icon = iconFor(t.kind);
                                                return (
                                                        <li key={i} className={styles.timelineItem}>
                                                                <span className={`${styles.timelineDot} ${styles[t.severity]}`}>
                                                                        <Icon size={12} />
                                                                </span>
                                                                <div>
                                                                        <p className={styles.timelineText}>{t.text}</p>
                                                                        <p className={styles.timelineMeta}>
                                                                                {formatRelative(t.time)} · {t.kind}
                                                                        </p>
                                                                </div>
                                                        </li>
                                                );
                                        })}
                                </ol>
                        </article>
                </section>
        );
}
