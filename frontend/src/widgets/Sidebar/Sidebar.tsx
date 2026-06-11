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
import styles from './Sidebar.module.css';

interface NavItem {
	label: string;
	key: string;
	count?: number;
	icon: LucideIcon;
}

const navItems: NavItem[] = [
	{ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
	{ key: 'scans', label: 'Scans', count: 7, icon: Radar },
	{ key: 'assets', label: 'Assets', count: 128, icon: Boxes },
	{ key: 'findings', label: 'Findings', count: 243, icon: TriangleAlert },
	{ key: 'reports', label: 'Reports', icon: FileText },
	{ key: 'monitoring', label: 'Monitoring', icon: Activity },
	{ key: 'integrations', label: 'Integrations', icon: PlugZap },
	{ key: 'settings', label: 'Settings', icon: Settings2 },
];

export function Sidebar() {
	return (
		<aside className={styles.sidebar}>
			<div>
				<div className={styles.brand}>
					<div className={styles.brandMark}>
						<span />
						<span />
					</div>
					<div>
						<p className={styles.brandName}>SpectraScope</p>
						<p className={styles.brandCaption}>External attack surface</p>
					</div>
				</div>

				<nav className={styles.nav} aria-label="Primary navigation">
					{navItems.map((item) => {
						const Icon = item.icon;

						return (
							<button
								type="button"
								key={item.key}
								className={`${styles.navItem} ${item.key === 'dashboard' ? styles.active : ''}`}
							>
								<span className={styles.navGlyph}>
									<Icon size={16} aria-hidden="true" />
								</span>
								<span className={styles.navLabel}>{item.label}</span>
								{item.count !== undefined ? (
									<span className={styles.navCount}>{item.count}</span>
								) : null}
							</button>
						);
					})}
				</nav>
			</div>

			<div className={styles.footer}>
				<div className={styles.profile}>
					<div className={styles.avatar}>AD</div>
					<div>
						<p className={styles.profileName}>Alex Doe</p>
						<p className={styles.profileRole}>Security administrator</p>
					</div>
				</div>
			</div>
		</aside>
	);
}
