import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { ScanResponse } from '../api/scans';
import { formatScanCode, formatScanTime } from '../lib/scanLabels';
import styles from './ScanDropdown.module.scss';

interface ScanDropdownProps {
	scans: ScanResponse[];
	selectedId: string | null;
	onChange: (scanId: string) => void;
	isLoading?: boolean;
}

export function ScanDropdown({ scans, selectedId, onChange, isLoading = false }: ScanDropdownProps) {
	const [isOpen, setIsOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const selected = scans.find((scan) => scan.id === selectedId) ?? null;

	useEffect(() => {
		const closeOnOutsideClick = (event: MouseEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setIsOpen(false);
			}
		};

		document.addEventListener('mousedown', closeOnOutsideClick);
		document.addEventListener('keydown', closeOnEscape);
		return () => {
			document.removeEventListener('mousedown', closeOnOutsideClick);
			document.removeEventListener('keydown', closeOnEscape);
		};
	}, []);

	return (
		<div ref={rootRef} className={styles.root}>
			<button
				type="button"
				className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''}`}
				onClick={() => setIsOpen((value) => !value)}
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				disabled={isLoading || scans.length === 0}
			>
				<span className={styles.triggerText}>
					<strong>{selected ? formatScanCode(selected.id) : 'No scan selected'}</strong>
					<small>{selected ? selected.target : isLoading ? 'Loading scans...' : 'No scans available'}</small>
				</span>
				{selected ? <StatusDot status={selected.status} /> : null}
				<ChevronDown size={16} className={styles.chevron} />
			</button>

			{isOpen ? (
				<div className={styles.menu} role="listbox" aria-label="Scans">
					<div className={styles.menuHeader}>
						<span>Recent scans</span>
						<small>{scans.length}</small>
					</div>
					<div className={styles.options}>
						{scans.map((scan) => {
							const isSelected = scan.id === selectedId;
							return (
								<button
									key={scan.id}
									type="button"
									role="option"
									aria-selected={isSelected}
									className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
									onClick={() => {
										onChange(scan.id);
										setIsOpen(false);
									}}
								>
									<span className={styles.optionMain}>
										<strong>{formatScanCode(scan.id)}</strong>
										<span>{scan.target}</span>
										<small>{formatScanTime(scan)} / {scan.scan_profile}</small>
									</span>
									<span className={styles.optionSide}>
										<StatusDot status={scan.status} />
										{isSelected ? <Check size={15} /> : null}
									</span>
								</button>
							);
						})}
					</div>
				</div>
			) : null}
		</div>
	);
}

function StatusDot({ status }: { status: ScanResponse['status'] }) {
	return <span className={styles.status} data-status={status}>{status}</span>;
}
