import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
        DEMO_ASSETS,
        DEMO_FINDINGS,
        DEMO_REPORT,
        DEMO_SCANS,
        markDemoActive,
} from '../mock/demoData';
import {
        getScan,
        getScanAssets,
        getScanFindings,
        getScanReport,
        listScans,
        startScan,
        type AssetListResponse,
        type FindingListResponse,
        type RiskReportResponse,
        type ScanListResponse,
        type ScanResponse,
        type ScanStartInput,
} from '../api/scans';
import { NetworkUnavailableError } from '../api/client';

const fallback = <T,>(fn: () => Promise<T>, demo: T): Promise<T> =>
        fn().catch((err) => {
                if (err instanceof NetworkUnavailableError) {
                        markDemoActive();
                        return demo;
                }
                throw err;
        });

const demoScanList: ScanListResponse = {
        total: DEMO_SCANS.length,
        limit: DEMO_SCANS.length,
        offset: 0,
        items: DEMO_SCANS,
};

const demoAssetList: AssetListResponse = {
        total: DEMO_ASSETS.length,
        limit: DEMO_ASSETS.length,
        offset: 0,
        items: DEMO_ASSETS,
};

const demoFindingList: FindingListResponse = {
        total: DEMO_FINDINGS.length,
        limit: DEMO_FINDINGS.length,
        offset: 0,
        items: DEMO_FINDINGS,
};

export function useScansList() {
        return useQuery({
                queryKey: ['scans', { limit: 50 }],
                queryFn: () => fallback(() => listScans({ limit: 50, offset: 0 }), demoScanList),
                refetchInterval: 30_000,
        });
}

export function useScan(scanId: string | null) {
        return useQuery({
                queryKey: ['scan', scanId],
                queryFn: () => {
                        const demo = DEMO_SCANS.find((s) => s.id === scanId) ?? DEMO_SCANS[0];
                        return fallback(() => getScan(scanId!), demo);
                },
                enabled: scanId !== null,
        });
}

export function useScanAssets(scanId: string | null) {
        return useQuery({
                queryKey: ['scan-assets', scanId],
                queryFn: () => fallback(() => getScanAssets(scanId!, { limit: 200 }), demoAssetList),
                enabled: scanId !== null,
        });
}

export function useScanFindings(scanId: string | null) {
        return useQuery({
                queryKey: ['scan-findings', scanId],
                queryFn: () => fallback(() => getScanFindings(scanId!, { limit: 200 }), demoFindingList),
                enabled: scanId !== null,
        });
}

export function useScanReport(scanId: string | null, status?: string) {
        return useQuery<RiskReportResponse | null>({
                queryKey: ['scan-report', scanId],
                queryFn: () =>
                        fallback<RiskReportResponse | null>(
                                () => getScanReport(scanId!) as Promise<RiskReportResponse | null>,
                                DEMO_REPORT,
                        ),
                enabled: scanId !== null && status === 'completed',
                retry: false,
        });
}

export function useStartScan() {
        const queryClient = useQueryClient();
        return useMutation({
                mutationFn: async (payload: ScanStartInput): Promise<ScanResponse> => {
                        try {
                                return await startScan(payload);
                        } catch (err) {
                                if (err instanceof NetworkUnavailableError) {
                                        markDemoActive();
                                        const demoScan: ScanResponse = {
                                                id: `scan-demo-${Date.now()}`,
                                                target: payload.target,
                                                status: 'running',
                                                scan_profile: payload.scan_profile,
                                                created_at: new Date().toISOString(),
                                                started_at: new Date().toISOString(),
                                                finished_at: null,
                                                error_message: null,
                                        };
                                        // simulate completion shortly
                                        setTimeout(() => {
                                                const completed: ScanResponse = {
                                                        ...demoScan,
                                                        status: 'completed',
                                                        finished_at: new Date().toISOString(),
                                                };
                                                queryClient.setQueryData(['scan', completed.id], completed);
                                                queryClient.setQueryData<ScanListResponse>(
                                                        ['scans', { limit: 50 }],
                                                        (prev) =>
                                                                prev
                                                                        ? {
                                                                                          ...prev,
                                                                                          items: [completed, ...prev.items.filter((s) => s.id !== completed.id)],
                                                                                          total: prev.total,
                                                                                  }
                                                                        : prev,
                                                );
                                        }, 2500);
                                        return demoScan;
                                }
                                throw err;
                        }
                },
                onSuccess: (scan) => {
                        queryClient.setQueryData(['scan', scan.id], scan);
                        queryClient.setQueryData<ScanListResponse>(['scans', { limit: 50 }], (prev) =>
                                prev
                                        ? { ...prev, items: [scan, ...prev.items.filter((s) => s.id !== scan.id)], total: prev.total + 1 }
                                        : prev,
                        );
                        void queryClient.invalidateQueries({ queryKey: ['scans'] });
                },
        });
}
