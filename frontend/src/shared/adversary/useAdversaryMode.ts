import { createContext, useContext } from 'react';

export interface AdversaryModeValue {
	active: boolean;
	enable: () => void;
	disable: () => void;
}

export const AdversaryModeContext = createContext<AdversaryModeValue | null>(null);

export function useAdversaryMode() {
	const value = useContext(AdversaryModeContext);
	if (!value) throw new Error('useAdversaryMode must be used inside AdversaryModeProvider');
	return value;
}
