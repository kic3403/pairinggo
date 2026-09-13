/**
 * zod 스키마 — 서버(apps/web)와 미니앱이 같은 검증을 쓴다.
 * Dataset은 느슨하게(필수 키·타입만) 검증해 데이터 보강 시 필드가 늘어도 깨지지 않게 한다.
 */
import { z } from "zod";

const Trend = z.object({ score: z.number(), rank: z.number().optional(), channels: z.number().optional() }).passthrough();

export const DrinkSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), alias: z.string().default(""), category: z.string(), abv: z.number().nullable(),
  region: z.string().default(""), brewery: z.string().default(""), desc: z.string().default(""), flavor: z.array(z.string()).default([]),
  blog_anju: z.number().default(0), awards: z.array(z.string()).optional(), generic: z.boolean().optional(),
  trend: Trend.optional(), profile: z.object({ sweet: z.number(), acid: z.number(), body: z.number(), fizz: z.number(), aroma: z.number() }).optional(),
  buy: z.object({ url: z.string().nullable(), store: z.string().nullable() }),
  offline: z.object({ visit: z.boolean().nullable(), place: z.string().nullable(), address: z.string().nullable(), phone: z.string().nullable(), note: z.string().nullable() }).optional(),
}).passthrough();

export const FoodSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), category: z.string(), tags: z.array(z.string()).default([]),
  trend: Trend.optional(), alias: z.array(z.string()).optional(),
  profile: z.object({ fat: z.number(), spice: z.number(), umami: z.number(), salt: z.number(), sweet: z.number(), weight: z.number() }).optional(),
  new: z.boolean().optional(),
}).passthrough();

export const PairingSchema = z.object({
  d: z.string(), f: z.string(), es: z.number(), reason: z.string(), blog: z.number().default(0),
  src: z.enum(["official", "sommelier", "media", "blog", "profile", "ai", "user"]).optional(),
  ev: z.object({ source: z.string().nullable().optional(), url: z.string().nullable().optional(), quote: z.string().nullable().optional(), who: z.string().nullable().optional() }).optional(),
  pf: z.object({ s: z.number(), plus: z.array(z.string()), minus: z.array(z.string()) }).optional(),
}).passthrough();

export const DatasetSchema = z.object({
  drinks: z.array(DrinkSchema).min(1),
  foods: z.array(FoodSchema).min(1),
  pairings: z.array(PairingSchema).min(1),
  trend_meta: z.object({ period: z.string(), collected: z.string(), note: z.string() }).partial().optional(),
  src_meta: z.record(z.string(), z.unknown()).optional(),
  profile_meta: z.unknown().optional(),
}).passthrough();

/** 서버 카탈로그 응답 = Dataset + version */
export const CatalogResponseSchema = DatasetSchema.extend({ version: z.string().min(1) });
export type CatalogResponse = z.infer<typeof CatalogResponseSchema>;

/** 미니앱 퍼널 이벤트 배치 (개인정보 필드 금지) */
const FORBIDDEN_PROPS = ["phone", "email", "address", "birth", "birthdate", "ci", "user_name", "username"];
export const EventSchema = z.object({
  n: z.string().min(1).max(40).regex(/^[a-z_]+$/),
  p: z.record(z.string(), z.union([z.string().max(300), z.number(), z.boolean(), z.null()])).default({}),
  t: z.number().int().positive(),
}).refine((e) => !Object.keys(e.p).some((k) => FORBIDDEN_PROPS.includes(k.toLowerCase())), { message: "개인정보 필드는 보낼 수 없습니다" });
export const EventBatchSchema = z.object({ events: z.array(EventSchema).min(1).max(100) });
export type EventBatch = z.infer<typeof EventBatchSchema>;
