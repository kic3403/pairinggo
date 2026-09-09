import "dotenv/config";
import postgres from "postgres";

/** DATABASE_URL이 없으면 안내 후 종료 — 키 없이도 저장소 나머지는 동작한다 */
export function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[db] DATABASE_URL이 없습니다. packages/db/.env 를 만들고 Supabase Connect 문자열을 넣어 주세요 (.env.example 참고).");
    process.exit(2);
  }
  return postgres(url, { ssl: "require", max: 1, prepare: false, onnotice: () => {} });
}
export type Sql = ReturnType<typeof connect>;
