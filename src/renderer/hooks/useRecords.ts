import { useState, useEffect, useCallback, useRef } from "react";
import { DatabaseService } from "../services/DatabaseService";
import type { IRecord } from "../types/IRecord";

/**
 * 记录数据 Hook
 * 从 SQLite 加载记录数据，监听 IPC 更新事件自动刷新
 */
export function useRecords() {
    const [records, setRecords] = useState<IRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const mountedRef = useRef<boolean>(true);

    const refresh = useCallback((): void => {
        DatabaseService.GetRecords()
            .then((data) => {
                if (mountedRef.current) {
                    setRecords(data);
                    setLoading(false);
                }
            })
            .catch((error: unknown) => {
                console.error("[useRecords] Failed to fetch records:", error);
                if (mountedRef.current) {
                    setLoading(false);
                }
            });
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        refresh();

        const unsubscribe: () => void = DatabaseService.OnRecordsUpdated(() => {
            refresh();
        });

        return () => {
            mountedRef.current = false;
            unsubscribe();
        };
    }, [refresh]);

    return { records, loading, refresh };
}
