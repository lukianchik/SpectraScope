import { ArrowRight, Download, FileText } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Header } from '../../Header/Header';
import { useScansList, useScan, useScanReport } from '../../shared/hooks/useScansData';
import type { RiskReportResponse } from '../../shared/api/scans';
import { formatScanCode } from '../../shared/lib/scanLabels';
import s from '../_shared/pageStyles.module.scss';
import own from './ReportsPage.module.scss';

export function ReportsPage() {
        const scansQuery = useScansList();
        const completed = (scansQuery.data?.items ?? []).filter((sc) => sc.status === 'completed');
        const [searchParams, setSearchParams] = useSearchParams();
        const requestedId = searchParams.get('scan');

        const currentId = completed.find((scan) => scan.id === requestedId)?.id ?? completed[0]?.id ?? null;
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
                                                        <li key={sc.id}>
                                                                <button
                                                                        type="button"
                                                                        className={`${own.listItem} ${currentId === sc.id ? own.listItemActive : ''}`}
                                                                        onClick={() => {
                                                                                const next = new URLSearchParams(searchParams);
                                                                                next.set('scan', sc.id);
                                                                                setSearchParams(next, { replace: true });
                                                                        }}
                                                                        data-testid={`report-item-${sc.id}`}
                                                                >
                                                                        <div className={own.listItemText}>
                                                                                <p className={own.target}>{sc.target}</p>
                                                                                <p className={own.meta}>
                                                                                        {formatScanCode(sc.id)} / {sc.scan_profile}
                                                                                </p>
                                                                                <p className={own.finishedAt}>
                                                                                        {sc.finished_at ? new Date(sc.finished_at).toLocaleString() : 'Not finished'}
                                                                                </p>
                                                                        </div>
                                                                </button>
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
                                                                                <FileText size={12} /> RULE-BASED REPORT
                                                                        </p>
                                                                        <h2 className={own.h2}>
                                                                                {scanQuery.data?.target ?? 'Scan report'}
                                                                        </h2>
                                                                        <p className={own.subtle}>
                                                                                {currentId ? `${formatScanCode(currentId)} / ` : ''}
                                                                                Created {new Date(reportQuery.data.created_at).toLocaleString()}
                                                                        </p>
                                                                </div>
                                                                <div className={own.exportActions}>
                                                                        {currentId ? <a className={s.btnGhost} href={`/api/scans/${currentId}/report/export?format=html`}><Download size={14} /> HTML</a> : null}
                                                                        {currentId ? <a className={s.btnGhost} href={`/api/scans/${currentId}/report/export?format=csv`}><Download size={14} /> CSV</a> : null}
                                                                        {currentId ? <a className={s.btnGhost} href={`/api/scans/${currentId}/report/export?format=sarif`}><Download size={14} /> SARIF</a> : null}
                                                                        <button
                                                                                type="button"
                                                                                className={s.btnGhost}
                                                                                title="Download report as JSON"
                                                                                onClick={() => reportQuery.data && downloadReport(scanQuery.data?.target ?? 'scan', reportQuery.data)}
                                                                        ><Download size={14} /> JSON</button>
                                                                </div>
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
                                                                                                <p className={own.riskName}>{String(r.name ?? r.risk ?? 'Risk item')}</p>
                                                                                                <p className={own.riskMeta}>
                                                                                                        <span className={`${s.sev} ${s[String(r.severity ?? 'info')]}`}>
                                                                                                                {String(r.severity ?? 'info')}
                                                                                                        </span>
                                                                                                        CVSS {String(r.score ?? '--')} / {String(r.affected_assets ?? r.assets ?? 1)} assets
                                                                                                </p>
                                                                                                {r.reason ? <p className={own.riskReason}>{r.reason}</p> : null}
                                                                                                {r.recommended_action ? (
                                                                                                        <p className={own.riskAction}><strong>Action:</strong> {r.recommended_action}</p>
                                                                                                ) : null}
                                                                                        </div>
                                                                                        <div className={own.riskAside}>
                                                                                                <div className={own.scoreBar} style={{ ['--score' as string]: `${Math.min(Number(r.score ?? 0) * 10, 100)}%` }}>
                                                                                                        <span />
                                                                                                </div>
                                                                                                {currentId ? (
                                                                                                        <Link className={own.evidenceLink} to={`/findings?scan=${currentId}`}>
                                                                                                                Evidence <ArrowRight size={13} />
                                                                                                        </Link>
                                                                                                ) : null}
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

function downloadReport(target: string, report: RiskReportResponse) {
        const blob = new Blob([JSON.stringify({ target, report }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `spectrascope-${target.replace(/[^a-z0-9.-]+/gi, '-')}-report.json`;
        anchor.click();
        URL.revokeObjectURL(url);
}
