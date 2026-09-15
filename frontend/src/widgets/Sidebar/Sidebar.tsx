import type { LucideIcon } from 'lucide-react';
import { Boxes, Crosshair, FileText, LayoutDashboard, Radar, Route, TriangleAlert } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { AdversaryGate } from '../../shared/adversary/AdversaryGate';
import { useAdversaryMode } from '../../shared/adversary/useAdversaryMode';
import styles from './Sidebar.module.css';
import { useLanguage } from '../../shared/i18n/useLanguage';

interface NavItem {
        label: string;
        to: string;
        icon: LucideIcon;
}

const navItems: NavItem[] = [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/scans', label: 'Scans', icon: Radar },
        { to: '/assets', label: 'Assets', icon: Boxes },
        { to: '/findings', label: 'Findings', icon: TriangleAlert },
        { to: '/reports', label: 'Reports', icon: FileText },
];

export function Sidebar() {
		const { active } = useAdversaryMode();
		const { language, t } = useLanguage();
		const items = active
			? [
				...navItems,
				{ to: '/operations', label: 'Operations', icon: Crosshair },
				{ to: '/attack-paths', label: 'Attack Paths', icon: Route },
			]
			: navItems;

        return (
                <aside className={styles.sidebar} data-testid="sidebar">
                        <div>
                                <NavLink to="/" className={styles.brand} data-testid="brand-link">
                                        <div className={styles.brandMark} aria-hidden="true">
                                                <span />
                                                <span />
                                        </div>
                                        <div>
                                                <p className={styles.brandName}>SpectraScope</p>
												<p className={styles.brandCaption}>{t('External attack surface', 'Внешняя поверхность атаки')}</p>
                                        </div>
                                </NavLink>

                                <nav className={styles.nav} aria-label="Primary navigation">
                                        {items.map((item) => {
                                                const Icon = item.icon;
                                                return (
                                                        <NavLink
                                                                key={item.to}
                                                                to={item.to}
                                                                className={({ isActive }) =>
                                                                        `${styles.navItem} ${isActive ? styles.active : ''}`
                                                                }
                                                                data-testid={`nav-${item.to.replace('/', '')}`}
                                                        >
                                                                <span className={styles.navGlyph}>
                                                                        <Icon size={16} aria-hidden="true" />
                                                                </span>
												<span className={styles.navLabel}>{translateNav(item.label, language)}</span>
                                                        </NavLink>
                                                );
                                        })}
                                </nav>
								<AdversaryGate />
                        </div>
                </aside>
        );
}

function translateNav(label: string, language: 'en' | 'ru') {
	if (language === 'en') return label;
	return { Dashboard: 'Обзор', Scans: 'Сканы', Assets: 'Активы', Findings: 'Находки', Reports: 'Отчёты', Operations: 'Операции', 'Attack Paths': 'Цепочки атак' }[label] ?? label;
}
