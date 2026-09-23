/**
 * 구조화 데이터 심기 — 검색엔진만 읽는 <script>라 화면에는 아무것도 보이지 않는다(docs/20 P3-4).
 * 내용은 shared의 `seo/jsonld.ts`가 만들고, 여기서는 안전하게 문자열로 바꿔 넣기만 한다.
 */
import { jsonLdScript, type JsonLd as Data } from "@pairinggo/shared";

export default function JsonLd({ data }: { data: Data | Data[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />;
}
