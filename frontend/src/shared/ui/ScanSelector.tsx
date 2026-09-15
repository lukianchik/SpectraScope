import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ScanResponse } from '../api/scans';
import { formatScanCode } from '../lib/scanLabels';
import { ScanDropdown } from './ScanDropdown';
import styles from './ScanSelector.module.scss';

interface ScanSelectorProps {
        scans: ScanResponse[];
        selectedId: string | null;
        onChange: (scanId: string) => void;
        isLoading?: boolean;
}

export function ScanSelector({ scans, selectedId, onChange, isLoading = false }: ScanSelectorProps) {
        const selected = scans.find((scan) => scan.id === selectedId) ?? null;

        return (
                <section className={styles.bar} aria-label="Selected scan results">
                        <div className={styles.context}>
                                <span>Result set</span>
                                <strong>{selected?.target ?? (isLoading ? 'Loading scans...' : 'No scan selected')}</strong>
                                {selected ? (
					<small><code>{formatScanCode(selected.id)}</code> / {selected.scan_profile} / {selected.status}</small>
                                ) : null}
                        </div>
                        {selected ? (
                                <Link
                                        to={`/scans/${selected.id}`}
                                        className={styles.openLink}
                                        title="Open scan overview"
                                        aria-label={`Open ${formatScanCode(selected.id)} overview`}
                                >
                                        <ExternalLink size={15} />
                                </Link>
                        ) : null}
                        <div className={styles.field}>
                                <span>Scan</span>
                                <ScanDropdown
                                        scans={scans}
                                        selectedId={selectedId}
                                        onChange={onChange}
                                        isLoading={isLoading}
                                />
                        </div>
                </section>
        );
}
