import type { ReactNode } from 'react';
import { Bell, Search, ShieldCheck } from 'lucide-react';
import styles from './Header.module.scss';

interface HeaderProps {
        eyebrow?: string;
        title?: string;
        subtitle?: string;
        right?: ReactNode;
}

export function Header({
        eyebrow = 'Live posture',
        title = 'Dashboard',
        subtitle = 'Overview of your attack surface and security posture.',
        right,
}: HeaderProps) {
        return (
                <header className={styles.header} data-testid="page-header">
                        <div className={styles.left}>
                                <p className={styles.eyebrow}>{eyebrow}</p>
                                <h1 className={styles.title}>{title}</h1>
                                <p className={styles.subtitle}>{subtitle}</p>
                        </div>
                        <div className={styles.right}>
                                {right}
                                <span className={styles.chip} data-testid="lab-mode-chip">
                                        <ShieldCheck size={14} /> LAB_MODE
                                </span>
                                <button type="button" className={styles.iconBtn} aria-label="Search">
                                        <Search size={16} />
                                </button>
                                <button type="button" className={styles.iconBtn} aria-label="Notifications">
                                        <Bell size={16} />
                                </button>
                        </div>
                </header>
        );
}
