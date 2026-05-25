import type { IRecord } from "@dickhelper/shared";

export interface IFingerprintConfig {
    readonly Size: number;           // canvas 尺寸 (正方形)
    readonly BackgroundColor: string;
    readonly RingCount: number;       // 同心环数量
    readonly RingBaseColor: string;   // 环底色
}

const DEFAULT_CONFIG: IFingerprintConfig = {
    Size: 400,
    BackgroundColor: "#0a0a1a",
    RingCount: 5,
    RingBaseColor: "rgba(255, 255, 255, 0.03)",
};

const DAY_COLORS: string[] = [
    "hsl(210, 90%, 60%)",  // 周一 蓝
    "hsl(170, 80%, 55%)",  // 周二 青
    "hsl(140, 70%, 50%)",  // 周三 绿
    "hsl(50, 85%, 55%)",   // 周四 黄
    "hsl(25, 90%, 55%)",   // 周五 橙
    "hsl(340, 85%, 60%)",  // 周六 粉
    "hsl(280, 75%, 60%)",  // 周日 紫
];

export class FingerprintService {
    public static Render(
        canvas: HTMLCanvasElement,
        records: IRecord[],
        config: Partial<IFingerprintConfig> = {}
    ): void {
        const cfg = { ...DEFAULT_CONFIG, ...config };
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = cfg.Size * dpr;
        canvas.height = cfg.Size * dpr;
        canvas.style.width = `${cfg.Size}px`;
        canvas.style.height = `${cfg.Size}px`;
        ctx.scale(dpr, dpr);

        const cx = cfg.Size / 2;
        const cy = cfg.Size / 2;
        const maxRadius = cfg.Size / 2 - 20;
        const minRadius = maxRadius * 0.15;

        // 背景
        ctx.fillStyle = cfg.BackgroundColor;
        ctx.fillRect(0, 0, cfg.Size, cfg.Size);

        // 同心参考环
        for (let i = 1; i <= cfg.RingCount; i++) {
            const r = minRadius + (maxRadius - minRadius) * (i / cfg.RingCount);
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = cfg.RingBaseColor;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        if (records.length === 0) {
            FingerprintService.DrawEmptyState(ctx, cx, cy);
            return;
        }

        // 找到时长范围用于归一化半径
        const durations = records.map((r) => r.Duration);
        const maxDuration = Math.max(durations.reduce((a, b) => Math.max(a, b), 0), 1);
        const minDuration = durations.reduce((a, b) => Math.min(a, b), Infinity);
        const durationRange = maxDuration - minDuration || 1;

        // 按时间排序
        const sorted = [...records].sort(
            (a, b) => a.EndTime.getTime() - b.EndTime.getTime()
        );

        // 绘制连接线（相邻记录之间）
        ctx.globalAlpha = 0.08;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let i = 0; i < sorted.length; i++) {
            const r = sorted[i]!;
            const angle = FingerprintService.TimeToAngle(r.EndTime);
            const radius = FingerprintService.DurationToRadius(
                r.Duration, minDuration, durationRange, minRadius, maxRadius
            );
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        ctx.globalAlpha = 1;

        // 绘制弧线（每条记录）
        for (const record of sorted) {
            FingerprintService.DrawArc(
                ctx, cx, cy, record,
                minDuration, durationRange, minRadius, maxRadius
            );
        }

        // 绘制数据点（每条记录）
        for (const record of sorted) {
            FingerprintService.DrawDot(
                ctx, cx, cy, record,
                minDuration, durationRange, minRadius, maxRadius
            );
        }

        // 中心标记
        FingerprintService.DrawCenter(ctx, cx, cy, records.length);
    }

    public static ToDataUrl(canvas: HTMLCanvasElement): string {
        return canvas.toDataURL("image/png");
    }

    private static TimeToAngle(date: Date): number {
        const hours = date.getHours() + date.getMinutes() / 60;
        return (hours / 24) * Math.PI * 2 - Math.PI / 2;
    }

    private static DurationToRadius(
        duration: number,
        minDuration: number,
        durationRange: number,
        minRadius: number,
        maxRadius: number
    ): number {
        const normalized = (duration - minDuration) / durationRange;
        return minRadius + normalized * (maxRadius - minRadius);
    }

    private static DrawArc(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        record: IRecord,
        minDuration: number,
        durationRange: number,
        minRadius: number,
        maxRadius: number
    ): void {
        const angle = FingerprintService.TimeToAngle(record.EndTime);
        const radius = FingerprintService.DurationToRadius(
            record.Duration, minDuration, durationRange, minRadius, maxRadius
        );
        const dayIndex = (record.EndTime.getDay() + 6) % 7;
        const color = DAY_COLORS[dayIndex]!;

        // 弧线长度与时长正相关
        const arcLength = Math.min(Math.PI / 4, (record.Duration / 60) * Math.PI / 6);

        ctx.beginPath();
        ctx.arc(cx, cy, radius, angle - arcLength / 2, angle + arcLength / 2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    private static DrawDot(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        record: IRecord,
        minDuration: number,
        durationRange: number,
        minRadius: number,
        maxRadius: number
    ): void {
        const angle = FingerprintService.TimeToAngle(record.EndTime);
        const radius = FingerprintService.DurationToRadius(
            record.Duration, minDuration, durationRange, minRadius, maxRadius
        );
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        const dayIndex = (record.EndTime.getDay() + 6) % 7;
        const color = DAY_COLORS[dayIndex]!;
        const dotSize = 2 + (record.Duration / 60) * 2;

        // 外发光
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, dotSize * 3);
        gradient.addColorStop(0, color.replace(/^hsl\(/, "hsla(").replace(/\)$/, ", 0.3)"));
        gradient.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(x, y, dotSize * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // 实心点
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    private static DrawCenter(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        count: number
    ): void {
        // 中心圆
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 25);
        gradient.addColorStop(0, "rgba(100, 150, 255, 0.3)");
        gradient.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(cx, cy, 25, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // 计数文字
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(count), cx, cy);
    }

    private static DrawEmptyState(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number
    ): void {
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("暂无数据", cx, cy);
    }
}
