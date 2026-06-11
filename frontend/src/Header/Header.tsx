import { Sun } from 'lucide-react';
import styles from './Header.module.scss';

export function Header() {
	return (
		<header className={styles.header}>
			<div className={styles.headerLeft}>
				<h1>Dashboard</h1>
				<p className={styles.subtitle}>
					Overview of your attack surface and security posture.
				</p>
			</div>
			<div className={styles.headerRight}>
				<Sun size={24} />
			</div>
		</header>
	);
}
