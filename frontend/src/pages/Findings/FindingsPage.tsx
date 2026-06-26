import { useMemo, useState } from 'react';
import { ChevronRight, Search, TriangleAlert, X } from 'lucide-react';
import { Header } from '../../Header/Header';
import { useScansList, useScanFindings } from '../../shared/hooks/useScansData';
import type { FindingResponse, Severity } from '../../shared/api/scans';
import s from '../_shared/pageStyles.module.scss';
import own from './FindingsPage.module.scss';

const SEVERITIES: Array<Severity | 'all'> = ['all', 'critical', 'high', 'medium', 'low', 'info'];

export function FindingsPage() {
        const scansQuery = useScansList();
        const firstId = scansQuery.data?.items[0]?.id ?? null;
        const findingsQuery = useScanFindings(firstId);
        const [sev, setSev] = useState<Severity | 'all'>('all');
        const [q, setQ] = useState('');
        const [picked, setPicked] = useState<FindingResponse | null>(null);

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
                                subtitle="Normalized, severity-scored findings from every adapter in the pipeline. Click any item to inspect the raw matcher."
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

                        <div className={own.layout}>
                                <ul className={own.list}>
                                        {list.length === 0 ? (
                                                <li className={s.empty}>
                                                        <TriangleAlert size={20} /> No findings match.
                                                </li>
                                        ) : null}
                                        {list.map((f) => (
                                                <li
                                                        key={f.id}
                                                        className={`${own.row} ${picked?.id === f.id ? own.rowActive : ''}`}
                                                        onClick={() => setPicked(f)}
                                                        data-testid={`finding-row-${f.id}`}
                                                >
                                                        <span className={`${s.sev} ${s[f.severity]}`}>{f.severity}</span>
                                                        <div className={own.body}>
                                                                <p className={own.name}>{f.name}</p>
                                                                <p className={own.where}>
                                                                        <span className={s.tag}>{f.source_tool}</span>
                                                                        {f.cve ? <span className={s.tag}>{f.cve}</span> : null}
                                                                        <span className={own.url}>{f.matched_at ?? '—'}</span>
                                                                </p>
                                                        </div>
                                                        <span className={own.cvss}>{f.cvss?.toFixed(1) ?? '—'}</span>
                                                        <ChevronRight size={14} className={own.chev} />
                                                </li>
                                        ))}
                                </ul>

                                <aside className={`${own.drawer} ${picked ? own.drawerOpen : ''}`}>
                                        {picked ? (
                                                <>
                                                        <div className={own.drawerHead}>
                                                                <span className={`${s.sev} ${s[picked.severity]}`}>{picked.severity}</span>
                                                                <button
                                                                        type="button"
                                                                        className={own.closeBtn}
                                                                        onClick={() => setPicked(null)}
                                                                        aria-label="Close"
                                                                >
                                                                        <X size={16} />
                                                                </button>
                                                        </div>
                                                        <h3 className={own.drawerTitle}>{picked.name}</h3>
                                                        <dl className={own.meta}>
                                                                <div><dt>Source tool</dt><dd>{picked.source_tool}</dd></div>
                                                                <div><dt>Template</dt><dd>{picked.template_id ?? '—'}</dd></div>
                                                                <div><dt>CVE</dt><dd>{picked.cve ?? '—'}</dd></div>
                                                                <div><dt>CVSS</dt><dd>{picked.cvss?.toFixed(1) ?? '—'}</dd></div>
                                                                <div className={own.matchedAt}><dt>Matched at</dt><dd>{picked.matched_at ?? '—'}</dd></div>
                                                        </dl>
                                                        <p className={own.desc}>{picked.description ?? 'No description available.'}</p>
                                                        <div className={own.actions}>
                                                                <button className={s.btnPrimary}>Triage</button>
                                                                <button className={s.btnGhost}>Mark accepted risk</button>
                                                        </div>
                                                </>
                                        ) : (
                                                <div className={own.placeholder}>
                                                        <TriangleAlert size={20} />
                                                        <p>Select a finding to inspect its matcher, CVSS context and triage actions.</p>
                                                </div>
                                        )}
                                </aside>
                        </div>
                </>
        );
}
