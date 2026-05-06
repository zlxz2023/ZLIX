import kugouRequest from '@renderer/utils/kugouRequest';

export interface KugouSearchSong {
  hash: string;
  songname: string;
  singername: string;
  album_name: string;
  duration: number;
  album_id: number;
  audio_id: number;
}

export interface KugouSearchResult {
  status: number;
  data?: {
    lists?: KugouSearchSong[];
  };
}

export interface KugouSongUrlResult {
  status: number;
  data?: {
    url?: string;
  };
}

export async function kugouSearch(keyword: string): Promise<KugouSearchResult> {
  return kugouRequest.get('/search', { params: { keyword } });
}

export async function kugouSearchMixed(keyword: string): Promise<any> {
  return kugouRequest.get('/search/mixed', { params: { keyword } });
}

export async function kugouGetSongUrl(hash: string, albumId: number, audioId: number): Promise<KugouSongUrlResult> {
    return kugouRequest.get('/song/url', {
        params: {
            hash,
            album_id: albumId,
            album_audio_id: audioId,
            quality: 320
        }
  });
}

export async function kugouGetLyric(hash: string): Promise<any> {
  return kugouRequest.get('/lyric', { params: {hash} });
}