import { useMemo, useState } from 'react';
import { Globe2, Search, Server, ShieldOff } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../../Header/Header';
import { useScansList, useScanAssets } from '../../shared/hooks/useScansData';
import { ScanSelector } from '../../shared/ui/ScanSelector';
import s from '../_shared/pageStyles.module.scss';
import own from './AssetsPage.module.scss';

export function AssetsPage() {
        const scansQuery = useScansList();
        const [searchParams, setSearchParams] = useSearchParams();
        const scans = scansQuery.data?.items ?? [];
        const requestedId = searchParams.get('scan');
        const selectedScan =
                scans.find((scan) => scan.id === requestedId) ??
                scans.find((scan) => scan.status === 'completed') ??
                scans[0] ??
                null;
        const assetsQuery = useScanAssets(selectedScan?.id ?? null, selectedScan?.status);
        const [q, setQ] = useState('');
        const [filter, setFilter] = useState<'all' | 'alive' | 'dark'>('all');

        const assets = useMemo(() => {
                const list = assetsQuery.data?.items ?? [];
                return list
                        .filter((a) =>
                                filter === 'all'
                                        ? true
                                        : filter === 'alive'
                                                ? a.is_alive
                                                : !a.is_alive,
                        )
                        .filter((a) => a.hostname.toLowerCase().includes(q.toLowerCase()));
        }, [assetsQuery.data, q, filter]);

        const alive = (assetsQuery.data?.items ?? []).filter((a) => a.is_alive).length;
        const total = assetsQuery.data?.items.length ?? 0;

        return (
                <>
                        <Header
                                eyebrow="Inventory"
                                title="Assets"
                                subtitle="Public-facing hosts discovered for your authorized perimeter. Filter by reachability and inspect technology stack at a glance."
                        />

                        <ScanSelector
                                scans={scans}
                                selectedId={selectedScan?.id ?? null}
                                isLoading={scansQuery.isPending}
                                onChange={(scanId) => setSelectedScanParam(searchParams, setSearchParams, scanId)}
                        />

                        <div className={s.toolbar}>
                                <div className={s.tabs} role="tablist">
                                        {[
                                                { key: 'all' as const, label: 'All', count: total },
                                                { key: 'alive' as const, label: 'Alive', count: alive },
                                                { key: 'dark' as const, label: 'Dark', count: total - alive },
                                        ].map((t) => (
                                                <button
                                                        key={t.key}
                                                        role="tab"
                                                        className={`${s.tabBtn} ${filter === t.key ? s.tabActive : ''}`}
                                                        onClick={() => setFilter(t.key)}
                                                >
                                                        {t.label} <span className={s.kbd}>{t.count}</span>
                                                </button>
                                        ))}
                                </div>
                                <div className={s.toolbarRight}>
                                        <div className={s.search}>
                                                <Search size={14} />
                                                <input
                                                        placeholder="Search hostnames or IP…"
                                                        value={q}
                                                        onChange={(e) => setQ(e.target.value)}
                                                        data-testid="assets-search"
                                                />
                                        </div>
                                </div>
                        </div>

                        <div className={own.grid} data-testid="assets-grid">
                                {assets.length === 0 ? (
                                        <div className={s.empty} style={{ gridColumn: '1 / -1' }}>
                                                <Server size={22} /> No assets match.
                                        </div>
                                ) : null}
                                {assets.map((a) => (
                                        <article key={a.id} className={own.card} data-hoverable>
                                                <div className={own.head}>
                                                        <div className={own.icon} data-alive={a.is_alive ? 'true' : 'false'}>
                                                                {a.is_alive ? <Globe2 size={18} /> : <ShieldOff size={18} />}
                                                        </div>
                                                        <div>
                                                                <p className={own.host}>{a.hostname}</p>
                                                                <p className={own.ip}>{a.ip ?? 'unresolved'} · {a.title ?? 'no title'}</p>
                                                        </div>
                                                        <span className={`${s.statusPill} ${a.is_alive ? s.completed : s.failed}`}>
                                                                <span className={s.dot} /> {a.http_status ?? (a.is_alive ? 'live' : 'dark')}
                                                        </span>
                                                </div>
                                                <div className={own.tech}>
                                                        {(a.technologies ?? []).length === 0 ? (
                                                                <span className={s.tag}>unknown</span>
                                                        ) : (
                                                                (a.technologies ?? []).map((t) => (
                                                                        <span key={t} className={s.tag}>{t}</span>
                                                                ))
                                                        )}
                                                </div>
                                        </article>
                                ))}
                        </div>
                </>
        );
}

function setSelectedScanParam(
        current: URLSearchParams,
        update: ReturnType<typeof useSearchParams>[1],
        scanId: string,
) {
        const next = new URLSearchParams(current);
        next.set('scan', scanId);
        update(next, { replace: true });
}
