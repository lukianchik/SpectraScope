import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Cursor } from '../widgets/Cursor/Cursor';
import { MainLayout } from '../layout/MainLayout';
import { Landing } from '../pages/Landing/Landing';
import { Dashboard } from '../pages/Dashboard/Dashboard';
import { ScansPage } from '../pages/Scans/ScansPage';
import { AssetsPage } from '../pages/Assets/AssetsPage';
import { FindingsPage } from '../pages/Findings/FindingsPage';
import { ReportsPage } from '../pages/Reports/ReportsPage';
import { MonitoringPage } from '../pages/Monitoring/MonitoringPage';
import { IntegrationsPage } from '../pages/Integrations/IntegrationsPage';
import { SettingsPage } from '../pages/Settings/SettingsPage';
import styles from './App.module.scss';

export function App() {
        return (
                <BrowserRouter>
                        <div className={styles.appShell}>
                                <Cursor />
                                <Routes>
                                        <Route path="/" element={<Landing />} />
                                        <Route element={<MainLayout />}>
                                                <Route path="/dashboard" element={<Dashboard />} />
                                                <Route path="/scans" element={<ScansPage />} />
                                                <Route path="/assets" element={<AssetsPage />} />
                                                <Route path="/findings" element={<FindingsPage />} />
                                                <Route path="/reports" element={<ReportsPage />} />
                                                <Route path="/monitoring" element={<MonitoringPage />} />
                                                <Route path="/integrations" element={<IntegrationsPage />} />
                                                <Route path="/settings" element={<SettingsPage />} />
                                        </Route>
                                        <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                        </div>
                </BrowserRouter>
        );
}

export default App;
