import type { ReactNode } from 'react';
import styles from './Header.module.scss';
import { useLanguage } from '../shared/i18n/useLanguage';

interface HeaderProps {
        eyebrow?: string;
        title?: string;
        subtitle?: string;
        right?: ReactNode;
}

export function Header({
		eyebrow,
		title,
		subtitle,
		right,
}: HeaderProps) {
		const { t } = useLanguage();
		const displayEyebrow = eyebrow ?? t('Live posture', 'Текущее состояние');
		const displayTitle = title ?? t('Dashboard', 'Обзор');
		const displaySubtitle = subtitle ?? t('Overview of your attack surface and security posture.', 'Обзор поверхности атаки и состояния защищённости.');
        return (
                <header className={styles.header} data-testid="page-header">
                        <div className={styles.left}>
								<p className={styles.eyebrow}>{displayEyebrow}</p>
								<h1 className={styles.title}>{displayTitle}</h1>
								<p className={styles.subtitle}>{displaySubtitle}</p>
                        </div>
                        {right ? <div className={styles.right}>{right}</div> : null}
                </header>
        );
}
