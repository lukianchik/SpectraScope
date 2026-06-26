import { useEffect, useRef, useState } from 'react';
import styles from './Cursor.module.scss';

export function Cursor() {
        const dotRef = useRef<HTMLDivElement>(null);
        const ringRef = useRef<HTMLDivElement>(null);
        const [hover, setHover] = useState(false);
        const [click, setClick] = useState(false);

        useEffect(() => {
                const dot = dotRef.current;
                const ring = ringRef.current;
                if (!dot || !ring) return;

                let mx = window.innerWidth / 2;
                let my = window.innerHeight / 2;
                let rx = mx;
                let ry = my;
                let raf = 0;

                const move = (e: MouseEvent) => {
                        mx = e.clientX;
                        my = e.clientY;
                        dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
                };

                const tick = () => {
                        rx += (mx - rx) * 0.18;
                        ry += (my - ry) * 0.18;
                        ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
                        raf = requestAnimationFrame(tick);
                };

                const over = (e: MouseEvent) => {
                        const t = e.target as HTMLElement | null;
                        if (!t) return;
                        const interactive =
                                t.closest('a, button, [role="button"], input, select, textarea, [data-hoverable]');
                        setHover(Boolean(interactive));
                };

                const down = () => setClick(true);
                const up = () => setClick(false);

                window.addEventListener('mousemove', move);
                window.addEventListener('mouseover', over);
                window.addEventListener('mousedown', down);
                window.addEventListener('mouseup', up);
                tick();

                return () => {
                        cancelAnimationFrame(raf);
                        window.removeEventListener('mousemove', move);
                        window.removeEventListener('mouseover', over);
                        window.removeEventListener('mousedown', down);
                        window.removeEventListener('mouseup', up);
                };
        }, []);

        return (
                <>
                        <div
                                ref={ringRef}
                                className={styles.ring}
                                data-hover={hover ? 'true' : 'false'}
                                aria-hidden="true"
                        />
                        <div
                                ref={dotRef}
                                className={styles.cursor}
                                data-hover={hover ? 'true' : 'false'}
                                data-click={click ? 'true' : 'false'}
                                aria-hidden="true"
                        />
                </>
        );
}
