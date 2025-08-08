export interface TargetMap {
    [threadId: string]: {
        from: string;
        to: string[];
    };
}

export interface AccountConfig {
    name: string;
    cookieFile: string;
    imei: string;
    ua: string;
    targetList: TargetMap;
}