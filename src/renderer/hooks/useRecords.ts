import { useState, useEffect, useCallback } from "react";
import { DatabaseService } from "../services/DatabaseService";
import type { IRecord } from "../types/IRecord";

/**
 * 记录数据 Hook
 * 从 SQLite 加载记录数据，监听 IPC 更新事件自动刷新
 */
export function useRecords() {
    const [records, setRecords] = useState<IRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const refresh = useCallback((): void => {
        DatabaseService.GetRecords().then((data) => {
            setRecords(data);
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        refresh();

        // 监听来自主进程的数据变更通知
        const unsubscribe: () => void = DatabaseService.OnRecordsUpdated(() => {
            refresh();
        });

        return () => {
            unsubscribe();
        };
    }, [refresh]);

    return { records, loading, refresh };
}
