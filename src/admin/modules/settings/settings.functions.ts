import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { audit, requireAdmin } from "@/admin/auth/session.server";
import { getAppSetting, setAppSetting, type SettingsMap } from "@/admin/lib/settings.server";
import { invalidateProductCache } from "@/engine/data/engine-repository";
import { invalidateEngineConfigCache } from "@/engine/runtime-config.server";

const GIFT_BRAIN_DEFAULTS: SettingsMap = {
  ENGINE_ENABLED: true,
  ENGINE_MODE: "gift-brain",
  ENGINE_USE_AI: false,
  ENGINE_CATALOG_MODE: "both",
  ENGINE_RECOMMENDATION_COUNT: 12,
  ENGINE_PAGE_SIZE: 4,
  ENGINE_MAX_RECOMMENDATION_MS: 90000,
  ENGINE_TRAINING_ENABLED: true,
  ENGINE_TRAIN_EVERY_MINUTES: 30,
  ENGINE_EVENT_RETENTION_DAYS: 180,
  ENGINE_AVOID_CATEGORIES: "",
  AMAZON_ASSOCIATES_ENABLED: true,
  AMAZON_PARTNER_TAG: "",
  SKIMLINKS_ENABLED: false,
};

const settingsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

export const getGiftBrainSettings = createServerFn({ method: "GET" }).handler(async (): Promise<SettingsMap> => {
  await requireAdmin();
  const saved = await getAppSetting("gift_brain");
  return { ...GIFT_BRAIN_DEFAULTS, ...saved };
});

export const saveGiftBrainSettings = createServerFn({ method: "POST" })
  .validator((data) => settingsSchema.parse(data))
  .handler(async ({ data }): Promise<SettingsMap> => {
    const actor = await requireAdmin();
    const current = await getAppSetting("gift_brain");
    const next = { ...current, ...data };
    await setAppSetting("gift_brain", next);
    invalidateEngineConfigCache();
    invalidateProductCache();
    await audit(actor.id, "update", "app_settings", "gift_brain");
    return next;
  });

export const getSiteSettings = createServerFn({ method: "GET" }).handler(async (): Promise<SettingsMap> => {
  await requireAdmin();
  return getAppSetting("site");
});

export const saveSiteSettings = createServerFn({ method: "POST" })
  .validator((data) => settingsSchema.parse(data))
  .handler(async ({ data }): Promise<SettingsMap> => {
    const actor = await requireAdmin();
    const current = await getAppSetting("site");
    const next = { ...current, ...data };
    await setAppSetting("site", next);
    await audit(actor.id, "update", "app_settings", "site");
    return next;
  });

/** Public site knobs (homepage blogs flag, etc.). */
export const getPublicSiteSettings = createServerFn({ method: "GET" }).handler(async (): Promise<SettingsMap> => {
  return getAppSetting("site");
});
