import { Outlet } from 'react-router-dom';
import { Sidebar } from '../widgets/Sidebar/Sidebar';
import { Background } from '../widgets/Background/Background';
import { demoIsActive } from '../shared/mock/demoData';
import { useScansList } from '../shared/hooks/useScansData';
import styles from './MainLayout.module.scss';

export function MainLayout() {
        // Kick off scans query so demo flag is set early
        useScansList();
        const demo = demoIsActive();

        return (
                <div className={styles.layout} data-testid="main-layout">
                        <Background />
                        <Sidebar />
                        <main className={styles.main}>
                                {demo ? (
                                        <div className={styles.demoBanner} data-testid="demo-banner">
                                                <span>
                                                        <span className={styles.dot} />
                                                        Backend not reachable in preview — showing <strong>simulated recon dataset</strong>. Connect a SpectraScope API on <code>VITE_API_BASE_URL</code> for live data.
                                                </span>
                                        </div>
                                ) : null}
                                <Outlet />
                        </main>
                </div>
        );
}
