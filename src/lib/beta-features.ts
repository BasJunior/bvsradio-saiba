export type BetaFeatureKey =
  | "marketplacePublic"
  | "creatorMarketplace"
  | "serviceOrders"
  | "liveBroadcast"
  | "testPayments";

export type BetaFeatureConfig = Record<BetaFeatureKey, boolean> & {
  runtimeLabel: string;
  productionLocked: boolean;
};

type EnvLike = Record<string, string | undefined>;

const flagEnvNames: Record<BetaFeatureKey, string> = {
  marketplacePublic: "BVS_FEATURE_MARKETPLACE_PUBLIC",
  creatorMarketplace: "BVS_FEATURE_CREATOR_MARKETPLACE",
  serviceOrders: "BVS_FEATURE_SERVICE_ORDERS",
  liveBroadcast: "BVS_FEATURE_LIVE_BROADCAST",
  testPayments: "BVS_FEATURE_TEST_PAYMENTS",
};

function yes(value: string | undefined): boolean {
  return ["1", "true", "yes", "on", "enabled"].includes(
    String(value || "").toLowerCase(),
  );
}

function no(value: string | undefined): boolean {
  return ["0", "false", "no", "off", "disabled"].includes(
    String(value || "").toLowerCase(),
  );
}

function configuredValue(env: EnvLike, name: string): string | null {
  return env[name] ?? env[`NEXT_PUBLIC_${name}`] ?? null;
}

function envFlag(env: EnvLike, name: string, fallback: boolean): boolean {
  const value = configuredValue(env, name) ?? undefined;
  if (yes(value)) return true;
  if (no(value)) return false;
  return fallback;
}

export function isBetaRuntime(env: EnvLike = process.env): boolean {
  const variant = (
    env.BVS_APP_VARIANT ||
    env.NEXT_PUBLIC_BVS_APP_VARIANT ||
    ""
  ).toLowerCase();
  const site =
    env.NEXT_PUBLIC_SITE_URL ||
    env.VERCEL_URL ||
    env.BVS_MOBILE_URL ||
    "";

  return (
    variant === "beta" ||
    variant === "staging" ||
    env.VERCEL_ENV === "preview" ||
    env.NODE_ENV === "development" ||
    /(^|[.-])(beta|staging)([.-]|$)/i.test(site)
  );
}

export function betaFeatureConfig(env: EnvLike = process.env): BetaFeatureConfig {
  const beta = isBetaRuntime(env);
  const productionLocked = !beta;

  return {
    runtimeLabel: beta ? "beta/staging" : "production",
    productionLocked,
    marketplacePublic: envFlag(env, flagEnvNames.marketplacePublic, beta),
    creatorMarketplace: envFlag(env, flagEnvNames.creatorMarketplace, beta),
    serviceOrders: envFlag(env, flagEnvNames.serviceOrders, beta),
    liveBroadcast: envFlag(env, flagEnvNames.liveBroadcast, beta),
    testPayments: beta && envFlag(env, flagEnvNames.testPayments, false),
  };
}

export function featureEnabled(key: BetaFeatureKey): boolean {
  return betaFeatureConfig()[key];
}

export function betaFeatureDetails(env: EnvLike = process.env) {
  const effective = betaFeatureConfig(env);
  return {
    runtime: {
      effective: effective.runtimeLabel,
      productionLocked: effective.productionLocked,
      raw: {
        BVS_APP_VARIANT: env.BVS_APP_VARIANT ?? null,
        NEXT_PUBLIC_BVS_APP_VARIANT: env.NEXT_PUBLIC_BVS_APP_VARIANT ?? null,
        VERCEL_ENV: env.VERCEL_ENV ?? null,
        NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL ?? null,
        VERCEL_URL: env.VERCEL_URL ?? null,
        BVS_MOBILE_URL: env.BVS_MOBILE_URL ?? null,
        NODE_ENV: env.NODE_ENV ?? null,
      },
    },
    flags: Object.fromEntries(
      (Object.entries(flagEnvNames) as Array<[BetaFeatureKey, string]>).map(
        ([key, envName]) => [
          key,
          {
            raw: configuredValue(env, envName),
            envName,
            publicEnvName: `NEXT_PUBLIC_${envName}`,
            effective: effective[key],
          },
        ],
      ),
    ) as Record<
      BetaFeatureKey,
      {
        raw: string | null;
        envName: string;
        publicEnvName: string;
        effective: boolean;
      }
    >,
  };
}
