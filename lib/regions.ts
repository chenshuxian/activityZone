// MVP 先放主要縣市與其鄉鎮區；可逐步補齊
export const REGIONS: Record<string, string[]> = {
  '台北市': ['中正區','大安區','信義區','內湖區','士林區','中山區'],
  '新北市': ['板橋區','新莊區','中和區','永和區','三重區'],
  '台中市': ['西區','北區','南屯區','西屯區'],
}
export const CITIES = Object.keys(REGIONS)
