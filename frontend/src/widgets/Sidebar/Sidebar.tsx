import type { LucideIcon } from 'lucide-react';
import {
        Activity,
        Boxes,
        FileText,
        LayoutDashboard,
        PlugZap,
        Radar,
        Settings2,
        TriangleAlert,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';

interface NavItem {
        label: string;
        to: string;
        count?: number;
        icon: LucideIcon;
}

const navItems: NavItem[] = [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/scans', label: 'Scans', count: 7, icon: Radar },
        { to: '/assets', label: 'Assets', count: 128, icon: Boxes },
        { to: '/findings', label: 'Findings', count: 243, icon: TriangleAlert },
        { to: '/reports', label: 'Reports', icon: FileText },
        { to: '/monitoring', label: 'Monitoring', icon: Activity },
        { to: '/integrations', label: 'Integrations', icon: PlugZap },
        { to: '/settings', label: 'Settings', icon: Settings2 },
];

export function Sidebar() {
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
                                                <p className={styles.brandCaption}>External attack surface</p>
                                        </div>
                                </NavLink>

                                <nav className={styles.nav} aria-label="Primary navigation">
                                        {navItems.map((item) => {
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
                                                                <span className={styles.navLabel}>{item.label}</span>
                                                                {item.count !== undefined ? (
                                                                        <span className={styles.navCount}>{item.count}</span>
                                                                ) : null}
                                                        </NavLink>
                                                );
                                        })}
                                </nav>
                        </div>

                        <div className={styles.footer}>
                                <div className={styles.systemCard}>
                                        <p className={styles.footerLabel}>System</p>
                                        <div className={styles.systemRow}>
                                                <span>Worker queue</span>
                                                <span className={styles.systemBadge} data-tone="ok">2 running</span>
                                        </div>
                                        <div className={styles.systemRow}>
                                                <span>Last scan</span>
                                                <span className={styles.systemMuted}>2m ago</span>
                                        </div>
                                </div>
                                <div className={styles.profile}>
                                        <div className={styles.avatar}>AD</div>
                                        <div>
                                                <p className={styles.profileName}>Alex Doe</p>
                                                <p className={styles.profileRole}>Security admin</p>
                                        </div>
                                </div>
                        </div>
                </aside>
        );
}
