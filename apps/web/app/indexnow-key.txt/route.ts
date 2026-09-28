/**
 * IndexNow 키 파일(2026-09-28) — 네이버·빙·얀덱스가 함께 쓰는 "주소가 바뀌었어요" 알림(api.indexnow.org). 키는 비밀이 아니다(공개 파일로 소유를 증명).
 * 제출은 packages/db indexnow 스크립트(사이트맵 주소 전부 → keyLocation = 이 파일). 키를 바꾸면 그 뒤 제출부터 새 키를 쓴다.
 */
const INDEXNOW_KEY = "d211c46daf052396f78f532f297d2b31";
export const dynamic = "force-static";

export function GET() {
  return new Response(INDEXNOW_KEY, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
