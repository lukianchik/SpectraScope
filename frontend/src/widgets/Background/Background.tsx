import styles from './Background.module.scss';

export function Background() {
        return (
                <div className={styles.bg} aria-hidden="true" data-testid="ambient-background">
                        <div className={`${styles.aurora} ${styles.aurora1}`} />
                        <div className={`${styles.aurora} ${styles.aurora2}`} />
                        <div className={`${styles.aurora} ${styles.aurora3}`} />
                        <div className={styles.radarHalo} />
                        <svg className={styles.rings} viewBox="0 0 1200 1200">
                                <circle cx="600" cy="600" r="180" />
                                <circle cx="600" cy="600" r="320" />
                                <circle cx="600" cy="600" r="480" />
                                <circle cx="600" cy="600" r="580" strokeDasharray="4 8" />
                        </svg>
                        <div className={styles.scanLine} />
                </div>
        );
}
