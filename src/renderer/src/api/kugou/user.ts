import kugouRequest from '@renderer/utils/kugouRequest';

export function registerDevice() {
  return kugouRequest.get('/register/dev', {
    headers: {
      'X-Skip-Auth': '1',
    },
  });
}

export function getLoginQrKey() {
  return kugouRequest.get('/login/qr/key');
}

export function createLoginQr(key: string) {
  return kugouRequest.get('/login/qr/create', {
    params: { key, qrimg: 'true' },
  });
}

export function checkLoginQr(key: string) {
  return kugouRequest.get('/login/qr/check', {
    params: { key },
  });
}

export function sendSmsCode(mobile: string) {
  return kugouRequest.get('/captcha/sent', {
    params: { mobile },
  });
}

export function loginBySms(mobile: string, code: string) {
  return kugouRequest.get('/login/cellphone', {
    params: { mobile, code },
  });
}

export function createWxLogin() {
  return kugouRequest.get('/login/wx/create');
}

export function checkWxLogin(uuid: string, timestamp?: number) {
  return kugouRequest.get('/login/wx/check', {
    params: { uuid, timestamp },
  });
}

export function loginByOpenPlat(code: string) {
  return kugouRequest.get('/login/openplat', {
    params: { code, plat: 2 },
  });
}

export function getUserDetail() {
  return kugouRequest.get('/user/detail');
}

export function getUserVipDetail() {
  return kugouRequest.get('/user/vip/detail');
}

export function claimDayVip(day: string) {
  return kugouRequest.get('/youth/day/vip', {
    params: { receive_day: day },
  });
}

export function upgradeDayVip() {
  return kugouRequest.get('/youth/day/vip/upgrade');
}

export function getVipMonthRecord() {
  return kugouRequest.get('/youth/month/vip/record');
}

export function getUserHistory(bp?: string) {
  return kugouRequest.get('/user/history', {
    params: { bp },
  });
}

export function getServerNow() {
  return kugouRequest.get('/server/now');
}

export function uploadPlayHistory(
  mxid: number | string,
  options?: {
    time?: number;
    pc?: number;
  },
) {
  return kugouRequest.get('/playhistory/upload', {
    params: {
      mxid,
      time: options?.time,
      pc: options?.pc,
    },
  });
}

export function getUserCloud(page = 1, pagesize = 30) {
  return kugouRequest.get('/user/cloud', {
    params: { page, pagesize },
  });
}

export function getUserFollow() {
  return kugouRequest.get('/user/follow');
}

export function getUserVideoCollect(page = 1, pagesize = 30) {
  return kugouRequest.get('/user/video/collect', {
    params: { page, pagesize },
  });
}