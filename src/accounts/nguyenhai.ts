import { AccountConfig } from "../types";

const nguyenhai: AccountConfig = {
    name: "Nguyễn Hải",
    cookieFile: "nguyenhai.json",
    imei: "db94f411-79bc-4ba8-aded-0bfbf3d5fe65-ce69b851c4edc7eebfb3998aa94a7157",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    targetList: {
        // Lão hạc Trading 4
        '5598458251966059144': {
            'from': '928657570242986458',
            // 'to': ['5611124681051471335', '7580859327271121677', '6809206056137510726', '3848963566131458387']
            'to': ['854555793773608674'],
        },

        // HLUX

        '4087945333521968514': {
            'from': '',
            'to': ['854555793773608674']
        }
        ,
        // Test

        '854555793773608674': {
            // 'from': '1879787845639791151',
            'from': '7569771601552050740',
            'to': ['854555793773608674'],
        }
    }
};

export default nguyenhai;

