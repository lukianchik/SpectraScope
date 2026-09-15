import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AdversaryModeContext } from './useAdversaryMode';

const STORAGE_KEY = 'spectrascope-adversary-view';
export function AdversaryModeProvider({ children }: { children: ReactNode }) {
	const [active, setActive] = useState(() => localStorage.getItem(STORAGE_KEY) === 'enabled');

	useEffect(() => {
		document.documentElement.dataset.mode = active ? 'adversary' : 'defender';
		localStorage.setItem(STORAGE_KEY, active ? 'enabled' : 'disabled');
	}, [active]);

	const value = useMemo(
		() => ({ active, enable: () => setActive(true), disable: () => setActive(false) }),
		[active],
	);

	return <AdversaryModeContext.Provider value={value}>{children}</AdversaryModeContext.Provider>;
}
