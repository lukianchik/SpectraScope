import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LockKeyhole, Radar } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { login } from '../../shared/api/auth';
import { getApiErrorMessage } from '../../shared/api/client';
import styles from './LoginPage.module.scss';

export function LoginPage() {
        const navigate = useNavigate();
        const location = useLocation();
        const queryClient = useQueryClient();
        const [username, setUsername] = useState('admin');
        const [password, setPassword] = useState('');
        const loginMutation = useMutation({
                mutationFn: () => login(username, password),
                onSuccess: (session) => {
                        queryClient.setQueryData(['session'], session);
                        const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
                        navigate(from, { replace: true });
                },
        });

        return (
                <main className={styles.page}>
                        <form className={styles.card} onSubmit={(event) => { event.preventDefault(); loginMutation.mutate(); }}>
                                <div className={styles.mark}><Radar size={26} /></div>
                                <p className={styles.eyebrow}>SpectraScope 1.0</p>
                                <h1>Sign in to the workspace</h1>
                                <p className={styles.help}>Use the operator credentials configured by the deployment administrator.</p>
                                <label><span>Username</span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
                                <label><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
                                {loginMutation.error ? <p className={styles.error}>{getApiErrorMessage(loginMutation.error)}</p> : null}
                                <button type="submit" disabled={loginMutation.isPending}><LockKeyhole size={16} /> {loginMutation.isPending ? 'Signing in…' : 'Sign in'}</button>
                        </form>
                </main>
        );
}
