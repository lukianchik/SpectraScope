import { useState } from 'react';
import { Download, FileText, Sparkles } from 'lucide-react';
import { Header } from '../../Header/Header';
import { useScansList, useScan, useScanReport } from '../../shared/hooks/useScansData';
import s from '../_shared/pageStyles.module.scss';
import own from './ReportsPage.module.scss';

export function ReportsPage() {
        const scansQuery = useScansList();
        const completed = (scansQuery.data?.items ?? []).filter((sc) => sc.status === 'completed');
        const [activeId, setActiveId] = useState<string | null>(null);

        const currentId = activeId ?? completed[0]?.id ?? null;
        const scanQuery = useScan(currentId);
        const reportQuery = useScanReport(currentId, scanQuery.data?.status);

        return (
                <>
                        <Header
                                eyebrow="Synthesis"
                                title="Risk Reports"
                                subtitle="Executive summaries with prioritized top risks and remediation recommendations, generated at the close of every completed scan."
                        />

                        <div className={own.layout}>
                                <aside className={own.sidebar}>
                                        <div className={own.sidebarHead}>
                                                <p>Recent</p>
                                                <span className={s.kbd}>{completed.length}</span>
                                        </div>
                                        <ul className={own.list}>
                                                {completed.length === 0 ? (
                                                        <li className={s.empty}><FileText size={20} /> No completed reports yet.</li>
                                                ) : null}
                                                {completed.map((sc) => (
                                                        <li
                                                                key={sc.id}
                                                                className={`${own.listItem} ${currentId === sc.id ? own.listItemActive : ''}`}
                                                                onClick={() => setActiveId(sc.id)}
                                                                data-testid={`report-item-${sc.id}`}
                                                        >
                                                                <div>
                                                                        <p className={own.target}>{sc.target}</p>
                                                                        <p className={own.meta}>
                                                                                {sc.scan_profile} · {sc.finished_at ? new Date(sc.finished_at).toLocaleString() : '—'}
                                                                        </p>
                                                                </div>
                                                                <span className={`${s.statusPill} ${s.completed}`}>
                                                                        <span className={s.dot} /> done
                                                                </span>
                                                        </li>
                                                ))}
                                        </ul>
                                </aside>

                                <article className={own.report}>
                                        {!reportQuery.data ? (
                                                <div className={s.empty}>
                                                        <FileText size={22} /> Select a completed scan to view its report.
                                                </div>
                                        ) : (
                                                <>
                                                        <header className={own.reportHead}>
                                                                <div>
                                                                        <p className={own.eyebrow}>
                                                                                <Sparkles size={12} /> AUTO-GENERATED
                                                                        </p>
                                                                        <h2 className={own.h2}>
                                                                                Report — {scanQuery.data?.target}
                                                                        </h2>
                                                                        <p className={own.subtle}>
                                                                                Created {new Date(reportQuery.data.created_at).toLocaleString()}
                                                                        </p>
                                                                </div>
                                                                <button className={s.btnGhost}>
                                                                        <Download size={14} /> Export PDF
                                                                </button>
                                                        </header>

                                                        <section className={own.section}>
                                                                <h3>Executive summary</h3>
                                                                <p>{reportQuery.data.summary}</p>
                                                        </section>

                                                        <section className={own.section}>
                                                                <h3>Top risks</h3>
                                                                <ul className={own.risks}>
                                                                        {reportQuery.data.top_risks.map((r, i) => (
                                                                                <li key={i} className={own.riskItem}>
                                                                                        <span className={own.riskRank}>{String(i + 1).padStart(2, '0')}</span>
                                                                                        <div className={own.riskBody}>
                                                                                                <p className={own.riskName}>{String(r.name ?? '')}</p>
                                                                                                <p className={own.riskMeta}>
                                                                                                        <span className={`${s.sev} ${s[String(r.severity ?? 'info')]}`}>
                                                                                                                {String(r.severity ?? 'info')}
                                                                                                        </span>
                                                                                                        CVSS {String(r.score ?? '—')}
                                                                                                </p>
                                                                                        </div>
                                                                                        <div className={own.scoreBar} style={{ ['--score' as string]: `${Math.min(Number(r.score ?? 0) * 10, 100)}%` }}>
                                                                                                <span />
                                                                                        </div>
                                                                                </li>
                                                                        ))}
                                                                </ul>
                                                        </section>

                                                        <section className={own.section}>
                                                                <h3>Recommendations</h3>
                                                                <ol className={own.recs}>
                                                                        {reportQuery.data.recommendations.map((r, i) => (
                                                                                <li key={i}>{r}</li>
                                                                        ))}
                                                                </ol>
                                                        </section>
                                                </>
                                        )}
                                </article>
                        </div>
                </>
        );
}
