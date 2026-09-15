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
        cancelScan,
        deleteScan,
        type AssetListResponse,
        type FindingListResponse,
        type RiskReportResponse,
        type ScanListResponse,
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
                refetchInterval: (query) =>
                        ['created', 'running'].includes(query.state.data?.status ?? '') ? 2_000 : false,
        });
}

export function useCancelScan() {
        const queryClient = useQueryClient();
        return useMutation({
                mutationFn: cancelScan,
                onSuccess: (scan) => {
                        queryClient.setQueryData(['scan', scan.id], scan);
                        void queryClient.invalidateQueries({ queryKey: ['scans'] });
                },
        });
}

export function useDeleteScan() {
        const queryClient = useQueryClient();
        return useMutation({
                mutationFn: deleteScan,
                onSuccess: (_data, scanId) => {
                        queryClient.removeQueries({ queryKey: ['scan', scanId] });
                        queryClient.removeQueries({ queryKey: ['scan-assets', scanId] });
                        queryClient.removeQueries({ queryKey: ['scan-findings', scanId] });
                        queryClient.removeQueries({ queryKey: ['scan-report', scanId] });
                        void queryClient.invalidateQueries({ queryKey: ['scans'] });
                },
        });
}

export function useScanAssets(scanId: string | null, status?: string) {
        return useQuery({
                queryKey: ['scan-assets', scanId],
                queryFn: () => fallback(() => getScanAssets(scanId!, { limit: 200 }), demoAssetList),
                enabled: scanId !== null,
                refetchInterval: status === 'created' || status === 'running' ? 2_000 : false,
        });
}

export function useScanFindings(scanId: string | null, status?: string) {
        return useQuery({
                queryKey: ['scan-findings', scanId],
                queryFn: () => fallback(() => getScanFindings(scanId!, { limit: 200 }), demoFindingList),
                enabled: scanId !== null,
                refetchInterval: status === 'created' || status === 'running' ? 2_000 : false,
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
