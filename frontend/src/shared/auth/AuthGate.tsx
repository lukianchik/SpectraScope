import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import { getSession } from '../api/auth';
import { ApiError } from '../api/client';

export function AuthGate({ children }: { children: React.ReactNode }) {
        const location = useLocation();
        const sessionQuery = useQuery({
                queryKey: ['session'],
                queryFn: getSession,
                retry: false,
                staleTime: 60_000,
        });

        if (sessionQuery.isPending) {
                return <div role="status" style={{ padding: '3rem', color: '#dbe8ff' }}>Loading secure workspace…</div>;
        }
        if (sessionQuery.error instanceof ApiError && sessionQuery.error.status === 401) {
                return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
        }
        if (sessionQuery.error) {
                return <div role="alert" style={{ padding: '3rem', color: '#ffb4c3' }}>Unable to verify the session. Check the backend connection and retry.</div>;
        }
        return children;
}
