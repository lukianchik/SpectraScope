import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from '../layout/MainLayout';
import { Landing } from '../pages/Landing/Landing';
import styles from './App.module.scss';
import { AdversaryModeProvider } from '../shared/adversary/AdversaryMode';
import { LanguageProvider } from '../shared/i18n/LanguageProvider';
import { AuthGate } from '../shared/auth/AuthGate';

const Dashboard = lazy(() => import('../pages/Dashboard/Dashboard').then((module) => ({ default: module.Dashboard })));
const ScansPage = lazy(() => import('../pages/Scans/ScansPage').then((module) => ({ default: module.ScansPage })));
const ScanDetailsPage = lazy(() => import('../pages/ScanDetails/ScanDetailsPage').then((module) => ({ default: module.ScanDetailsPage })));
const AssetsPage = lazy(() => import('../pages/Assets/AssetsPage').then((module) => ({ default: module.AssetsPage })));
const FindingsPage = lazy(() => import('../pages/Findings/FindingsPage').then((module) => ({ default: module.FindingsPage })));
const ReportsPage = lazy(() => import('../pages/Reports/ReportsPage').then((module) => ({ default: module.ReportsPage })));
const MonitoringPage = lazy(() => import('../pages/Monitoring/MonitoringPage').then((module) => ({ default: module.MonitoringPage })));
const IntegrationsPage = lazy(() => import('../pages/Integrations/IntegrationsPage').then((module) => ({ default: module.IntegrationsPage })));
const SettingsPage = lazy(() => import('../pages/Settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const AttackPathsPage = lazy(() => import('../pages/AttackPaths/AttackPathsPage').then((module) => ({ default: module.AttackPathsPage })));
const OperationsPage = lazy(() => import('../pages/Operations/OperationsPage').then((module) => ({ default: module.OperationsPage })));
const LoginPage = lazy(() => import('../pages/Login/LoginPage').then((module) => ({ default: module.LoginPage })));

function App() {
        return (
		<BrowserRouter>
			<LanguageProvider>
			<AdversaryModeProvider>
				<div className={styles.appShell}>
                                <Suspense fallback={<div role="status" style={{ padding: '3rem', color: '#dbe8ff' }}>Loading SpectraScope…</div>}>
                                <Routes>
                                        <Route path="/" element={<Landing />} />
                                        <Route path="/login" element={<LoginPage />} />
						<Route element={<AuthGate><MainLayout /></AuthGate>}>
                                                <Route path="/dashboard" element={<Dashboard />} />
                                                <Route path="/scans" element={<ScansPage />} />
                                                <Route path="/scans/:scanId" element={<ScanDetailsPage />} />
                                                <Route path="/assets" element={<AssetsPage />} />
                                                <Route path="/findings" element={<FindingsPage />} />
								<Route path="/reports" element={<ReportsPage />} />
								<Route path="/attack-paths" element={<AttackPathsPage />} />
								<Route path="/operations" element={<OperationsPage />} />
                                                <Route path="/monitoring" element={<MonitoringPage />} />
                                                <Route path="/integrations" element={<IntegrationsPage />} />
                                                <Route path="/settings" element={<SettingsPage />} />
                                        </Route>
                                        <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
				</Suspense>
				</div>
			</AdversaryModeProvider>
			</LanguageProvider>
		</BrowserRouter>
        );
}

export default App;
