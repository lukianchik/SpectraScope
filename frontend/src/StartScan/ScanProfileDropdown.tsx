import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Check, ChevronDown, FlaskConical, Radar, ScanSearch, ShieldCheck } from 'lucide-react';
import type { ScanProfile } from '../shared/api/scans';
import { useLanguage } from '../shared/i18n/useLanguage';
import styles from './ScanProfileDropdown.module.scss';

interface ProfileOption {
	value: ScanProfile;
	icon: ComponentType<{ size?: number }>;
	label: [string, string];
	description: [string, string];
	badge: [string, string];
	tone: 'safe' | 'real' | 'lab' | 'passive';
}

const profiles: ProfileOption[] = [
	{ value: 'safe', icon: ShieldCheck, label: ['Safe external discovery', 'Безопасная внешняя проверка'], description: ['HTTP discovery plus bounded non-intrusive templates.', 'HTTP-разведка и ограниченные неинтрузивные проверки.'], badge: ['LOW IMPACT', 'НИЗКОЕ ВОЗДЕЙСТВИЕ'], tone: 'safe' },
	{ value: 'discovery', icon: Radar, label: ['Discovery only', 'Только обнаружение'], description: ['Find reachable hosts and web services. No vulnerability templates.', 'Поиск доступных хостов и веб-сервисов без шаблонов уязвимостей.'], badge: ['PASSIVE+', 'РАЗВЕДКА'], tone: 'passive' },
	{ value: 'lab', icon: FlaskConical, label: ['Lab validation', 'Проверка лаборатории'], description: ['Deterministic simulated lab dataset. No scanner binaries.', 'Детерминированные тестовые данные без запуска сканеров.'], badge: ['SIMULATED', 'СИМУЛЯЦИЯ'], tone: 'lab' },
	{ value: 'local-real', icon: ScanSearch, label: ['Local lab with real scanners', 'Локальная лаборатория с реальными сканерами'], description: ['Real httpx and Nuclei against the exact local allowlist.', 'Реальные httpx и Nuclei только по локальному allowlist.'], badge: ['REAL / LOCAL', 'РЕАЛЬНЫЙ / LOCAL'], tone: 'real' },
];

export function ScanProfileDropdown({ value, onChange }: { value: ScanProfile; onChange: (value: ScanProfile) => void }) {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const { language, t } = useLanguage();
	const selected = profiles.find((profile) => profile.value === value) ?? profiles[0];
	const SelectedIcon = selected.icon;
	const text = (pair: [string, string]) => language === 'ru' ? pair[1] : pair[0];

	useEffect(() => {
		const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
		const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
		document.addEventListener('mousedown', close);
		document.addEventListener('keydown', escape);
		return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
	}, []);

	return (
		<div className={styles.root} ref={rootRef}>
			<button type="button" className={`${styles.trigger} ${open ? styles.open : ''}`} onClick={() => setOpen((current) => !current)} aria-haspopup="listbox" aria-expanded={open} data-testid="scan-profile-trigger">
				<span className={`${styles.icon} ${styles[selected.tone]}`}><SelectedIcon size={17} /></span>
				<span className={styles.triggerText}><strong>{text(selected.label)}</strong><small>{text(selected.description)}</small></span>
				<span className={`${styles.badge} ${styles[selected.tone]}`}>{text(selected.badge)}</span>
				<ChevronDown size={16} className={styles.chevron} />
			</button>
			{open ? (
				<div className={styles.menu} role="listbox" aria-label={t('Scan profile', 'Профиль сканирования')}>
					<header><span>{t('Choose execution profile', 'Выберите режим выполнения')}</span><small>{t('The backend enforces the selected safety policy.', 'Backend применит соответствующие ограничения.')}</small></header>
					<div className={styles.options}>
						{profiles.map((profile) => {
							const Icon = profile.icon;
							const active = profile.value === value;
							return <button key={profile.value} type="button" role="option" aria-selected={active} className={`${styles.option} ${active ? styles.selected : ''}`} onClick={() => { onChange(profile.value); setOpen(false); }}>
								<span className={`${styles.icon} ${styles[profile.tone]}`}><Icon size={17} /></span>
								<span className={styles.optionText}><strong>{text(profile.label)}</strong><small>{text(profile.description)}</small><em className={styles[profile.tone]}>{text(profile.badge)}</em></span>
								{active ? <Check size={17} className={styles.check} /> : null}
							</button>;
						})}
					</div>
				</div>
			) : null}
		</div>
	);
}
