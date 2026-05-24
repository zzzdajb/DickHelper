import { useEffect, useState } from "react";
import { UpdateService } from "../services/UpdateService";
import type { IUpdateState } from "@dickhelper/shared";

export const useUpdateState = (): { UpdateState: IUpdateState | null } => {
    const [updateState, setUpdateState] = useState<IUpdateState | null>(null);

    useEffect(() => {
        let isMounted: boolean = true;

        UpdateService.GetState()
            .then((state) => {
                if (isMounted) {
                    setUpdateState(state);
                }
            })
            .catch((error: unknown) => {
                console.error("[useUpdateState]", error);
            });

        const unsubscribe = UpdateService.OnUpdateStateChanged((state) => {
            setUpdateState(state);
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []);

    return { UpdateState: updateState };
};
