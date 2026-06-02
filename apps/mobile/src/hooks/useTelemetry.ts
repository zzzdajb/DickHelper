import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { generateUUID, reportTelemetryLaunch } from "@dickhelper/core";
import { useMobileDatabaseService } from "./useMobileDatabaseService";

const TELEMETRY_BASE_URL = "https://dickhelper.sakuraseasons.space";
const REPORT_INTERVAL_MS = 18 * 60 * 60 * 1000; // 18 小时
const TELEMETRY_ENABLED_KEY = "telemetry_enabled";
const TELEMETRY_UUID_KEY = "telemetry_uuid";
const TELEMETRY_LAST_ATTEMPT_AT_KEY = "telemetry_last_attempt_at";
const TELEMETRY_LAST_SUCCESS_AT_KEY = "telemetry_last_success_at";
const TELEMETRY_LAST_ERROR_TEXT_KEY = "telemetry_last_error_text";

function GetOsLabel(): string {
    return Platform.OS === "android" ? "android" : Platform.OS;
}

function GetAppVersion(): string {
    return Constants.expoConfig?.version ?? "unknown";
}

function NormalizeSettingValue(value: string | null): string | null {
    if (value === null || value.length === 0) {
        return null;
    }

    return value;
}

function GetErrorText(caught: unknown): string {
    if (caught instanceof Error) {
        return `${caught.name}: ${caught.message}`;
    }

    return String(caught);
}

export interface ITelemetryDebugInfo {
    readonly lastAttemptAt: string | null;
    readonly lastSuccessAt: string | null;
    readonly lastErrorText: string | null;
    readonly uuid: string | null;
}

export interface IUseTelemetryResult {
    readonly enabled: boolean;
    readonly toggle: (nextEnabled: boolean) => Promise<void>;
    readonly osLabel: string;
    readonly appVersion: string;
    readonly debugInfo: ITelemetryDebugInfo;
}

export function useTelemetry(): IUseTelemetryResult {
    const database = useMobileDatabaseService();
    const [enabled, setEnabled] = useState<boolean>(true);
    const [debugInfo, setDebugInfo] = useState<ITelemetryDebugInfo>({
        lastAttemptAt: null,
        lastSuccessAt: null,
        lastErrorText: null,
        uuid: null,
    });
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const LoadDebugInfo = useCallback(async (): Promise<void> => {
        const [lastAttemptAt, lastSuccessAt, lastErrorText, uuid] = await Promise.all([
            database.GetSetting(TELEMETRY_LAST_ATTEMPT_AT_KEY),
            database.GetSetting(TELEMETRY_LAST_SUCCESS_AT_KEY),
            database.GetSetting(TELEMETRY_LAST_ERROR_TEXT_KEY),
            database.GetSetting(TELEMETRY_UUID_KEY),
        ]);

        setDebugInfo({
            lastAttemptAt: NormalizeSettingValue(lastAttemptAt),
            lastSuccessAt: NormalizeSettingValue(lastSuccessAt),
            lastErrorText: NormalizeSettingValue(lastErrorText),
            uuid: NormalizeSettingValue(uuid),
        });
    }, [database]);

    const DoReport = useCallback(async (): Promise<void> => {
        try {
            const isEnabled = await database.GetSetting(TELEMETRY_ENABLED_KEY);
            if (isEnabled === "false") return;

            const attemptAt = new Date().toISOString();
            await database.SetSetting(TELEMETRY_LAST_ATTEMPT_AT_KEY, attemptAt);
            setDebugInfo((current) => ({
                ...current,
                lastAttemptAt: attemptAt,
            }));

            let uuid = await database.GetSetting(TELEMETRY_UUID_KEY);
            if (uuid === null || uuid.length === 0) {
                uuid = generateUUID();
                await database.SetSetting(TELEMETRY_UUID_KEY, uuid);
                setDebugInfo((current) => ({
                    ...current,
                    uuid,
                }));
            }

            const version = GetAppVersion();
            const osName = GetOsLabel();

            await reportTelemetryLaunch(TELEMETRY_BASE_URL, {
                uuid,
                platform: "mobile",
                app_version: version,
                os: osName,
            });
            const successAt = new Date().toISOString();
            await database.SetSetting(TELEMETRY_LAST_SUCCESS_AT_KEY, successAt);
            setDebugInfo((current) => ({
                ...current,
                lastSuccessAt: successAt,
            }));
        } catch (caught: unknown) {
            const errorText = GetErrorText(caught);

            try {
                await database.SetSetting(TELEMETRY_LAST_ERROR_TEXT_KEY, errorText);
            } catch {
                // 静默忽略
            }

            setDebugInfo((current) => ({
                ...current,
                lastErrorText: errorText,
            }));
        }
    }, [database]);

    useEffect(() => {
        const Init = async (): Promise<void> => {
            const setting = await database.GetSetting(TELEMETRY_ENABLED_KEY);
            const isEnabled = setting !== "false";
            setEnabled(isEnabled);

            await LoadDebugInfo();
            await DoReport();
        };

        void Init();

        intervalRef.current = setInterval(() => {
            void DoReport();
        }, REPORT_INTERVAL_MS);

        return () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
            }
        };
    }, [database, DoReport, LoadDebugInfo]);

    const toggle = useCallback(async (nextEnabled: boolean): Promise<void> => {
        await database.SetSetting(TELEMETRY_ENABLED_KEY, nextEnabled ? "true" : "false");
        setEnabled(nextEnabled);
        if (nextEnabled) {
            await DoReport();
        }
    }, [database, DoReport]);

    return {
        enabled,
        toggle,
        osLabel: GetOsLabel(),
        appVersion: GetAppVersion(),
        debugInfo,
    };
}
