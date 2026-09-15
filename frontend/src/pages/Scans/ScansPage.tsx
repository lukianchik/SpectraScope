import { useMemo, useState } from 'react';
import { Boxes, Eye, FileText, Filter, Play, RefreshCw, Search, Trash2, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header } from '../../Header/Header';
import { getApiErrorMessage } from '../../shared/api/client';
import { useDeleteScan, useScansList } from '../../shared/hooks/useScansData';
import { formatRelative } from '../../shared/mock/demoData';
import { formatScanCode } from '../../shared/lib/scanLabels';
import s from '../_shared/pageStyles.module.scss';

type StatusFilter = 'all' | 'completed' | 'running' | 'failed' | 'cancelled' | 'created';

export function ScansPage() {
        const { data, refetch, isFetching } = useScansList();
        const [filter, setFilter] = useState<StatusFilter>('all');
        const [q, setQ] = useState('');
        const deleteMutation = useDeleteScan();

        const items = useMemo(() => {
                const all = data?.items ?? [];
                return all
                        .filter((scan) => filter === 'all' || scan.status === filter)
                        .filter((scan) => scan.target.toLowerCase().includes(q.toLowerCase()));
        }, [data, filter, q]);

        const tabs: Array<{ key: StatusFilter; label: string; count: number }> = [
                { key: 'all', label: 'All', count: data?.items.length ?? 0 },
                { key: 'running', label: 'Running', count: data?.items.filter((x) => x.status === 'running').length ?? 0 },
                { key: 'completed', label: 'Completed', count: data?.items.filter((x) => x.status === 'completed').length ?? 0 },
                { key: 'failed', label: 'Failed', count: data?.items.filter((x) => x.status === 'failed').length ?? 0 },
                { key: 'cancelled', label: 'Cancelled', count: data?.items.filter((x) => x.status === 'cancelled').length ?? 0 },
        ];

        return (
                <>
                        <Header
                                eyebrow="History"
                                title="Scans"
                                subtitle="Every authorized scan, with target, profile and timing. Drill into individual runs to inspect assets, findings and the generated risk report."
                        />

                        <div className={s.toolbar} data-testid="scans-toolbar">
                                <div className={s.tabs} role="tablist">
                                        {tabs.map((t) => (
                                                <button
                                                        key={t.key}
                                                        role="tab"
                                                        className={`${s.tabBtn} ${filter === t.key ? s.tabActive : ''}`}
                                                        onClick={() => setFilter(t.key)}
                                                        data-testid={`scans-tab-${t.key}`}
                                                >
                                                        {t.label} <span className={s.kbd}>{t.count}</span>
                                                </button>
                                        ))}
                                </div>
                                <div className={s.toolbarRight}>
                                        <div className={s.search}>
                                                <Search size={14} />
                                                <input
                                                        placeholder="Filter target hostname…"
                                                        value={q}
                                                        onChange={(e) => setQ(e.target.value)}
                                                        data-testid="scans-search"
                                                />
                                        </div>
                                        <button
                                                className={s.btnGhost}
                                                onClick={() => void refetch()}
                                                data-testid="scans-refresh"
                                        >
                                                <RefreshCw size={14} className={isFetching ? 'spin' : ''} /> Refresh
                                        </button>
                                        <Link to="/dashboard" className={s.btnPrimary} data-testid="scans-new">
                                                <Play size={14} /> Start scan
                                        </Link>
                                </div>
                        </div>

                        {deleteMutation.isError ? (
                                <p className={s.inlineError} role="alert">{getApiErrorMessage(deleteMutation.error)}</p>
                        ) : null}

                        <div className={s.tableWrap}>
                                <table className={s.table}>
                                        <thead>
                                                <tr>
                                                        <th>Target</th>
                                                        <th>Profile</th>
                                                        <th>Status</th>
                                                        <th>Started</th>
                                                        <th>Duration</th>
                                                        <th>Results</th>
                                                        <th style={{ textAlign: 'right' }}>Scan ID</th>
                                                </tr>
                                        </thead>
                                        <tbody>
                                                {items.length === 0 ? (
                                                        <tr>
                                                                <td colSpan={7}>
                                                                        <div className={s.empty}>
                                                                                <Filter size={20} /> No scans match the current filter.
                                                                        </div>
                                                                </td>
                                                        </tr>
                                                ) : null}
                                                {items.map((scan) => {
                                                        const dur = scan.finished_at && scan.started_at
                                                                ? Math.max(
                                                                                1,
                                                                                Math.round(
                                                                                        (new Date(scan.finished_at).getTime() -
                                                                                                new Date(scan.started_at).getTime()) /
                                                                                                1000,
                                                                                ),
                                                                  )
                                                                : null;
                                                        return (
                                                                <tr key={scan.id} data-testid={`scan-row-${scan.id}`}>
                                                                        <td className={`${s.strong} ${s.mono}`}>
                                                                                <Link to={`/scans/${scan.id}`}>{scan.target}</Link>
                                                                        </td>
                                                                        <td className={s.mono}>{scan.scan_profile}</td>
                                                                        <td>
                                                                                <span className={`${s.statusPill} ${s[scan.status]}`}>
                                                                                        <span className={s.dot} /> {scan.status}
                                                                                </span>
                                                                        </td>
                                                                        <td className={s.mono}>
                                                                                {scan.started_at ? formatRelative(scan.started_at) : '—'}
                                                                        </td>
                                                                        <td className={s.mono}>
                                                                                {dur === null ? (scan.status === 'running' ? 'live' : '—') : `${dur}s`}
                                                                        </td>
                                                                        <td>
                                                                                <div className={s.rowActions}>
                                                                                        <Link to={`/scans/${scan.id}`} className={s.iconLink} title="Open scan" aria-label={`Open scan ${formatScanCode(scan.id)}`}>
                                                                                                <Eye size={14} />
                                                                                        </Link>
                                                                                        <Link to={`/assets?scan=${scan.id}`} className={s.iconLink} title="Open assets" aria-label={`Open assets for ${scan.target}`}>
                                                                                                <Boxes size={14} />
                                                                                        </Link>
                                                                                        <Link to={`/findings?scan=${scan.id}`} className={s.iconLink} title="Open findings" aria-label={`Open findings for ${scan.target}`}>
                                                                                                <TriangleAlert size={14} />
                                                                                        </Link>
                                                                                        {scan.status === 'completed' ? (
                                                                                                <Link to={`/reports?scan=${scan.id}`} className={s.iconLink} title="Open report" aria-label={`Open report for ${scan.target}`}>
                                                                                                        <FileText size={14} />
                                                                                                </Link>
                                                                                        ) : null}
                                                                                        {!['created', 'running'].includes(scan.status) ? (
                                                                                                <button
                                                                                                        type="button"
                                                                                                        className={`${s.iconLink} ${s.iconDanger}`}
                                                                                                        title="Delete scan"
                                                                                                        aria-label={`Delete scan ${formatScanCode(scan.id)}`}
                                                                                                        disabled={deleteMutation.isPending}
                                                                                                        onClick={() => {
                                                                                                                if (window.confirm(`Delete ${formatScanCode(scan.id)} for ${scan.target}?`)) {
                                                                                                                        deleteMutation.mutate(scan.id);
                                                                                                                }
                                                                                                        }}
                                                                                                >
                                                                                                        <Trash2 size={14} />
                                                                                                </button>
                                                                                        ) : null}
                                                                                </div>
                                                                        </td>
                                                                        <td className={s.mono} style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>
                                                                                {formatScanCode(scan.id)}
                                                                        </td>
                                                                </tr>
                                                        );
                                                })}
                                        </tbody>
                                </table>
                        </div>
                </>
        );
}
