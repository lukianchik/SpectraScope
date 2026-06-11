import { Dashboard } from '../pages/Dashboard/Dashboard';
import styles from './App.module.scss';

export function App() {
	return (
		<div className={styles.appShell}>
			<Dashboard />
		</div>
	);
}

export default App;
