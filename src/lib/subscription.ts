export const PLANS = {
  trial: {
    name: "Trial",
    locationAccess: true,
    priceMonthly: 0,
    trialDays: 30,
  },
  premium: {
    name: "Premium",
    locationAccess: true,
    priceMonthly: 600,
  },
} as const;

export type PlanType = keyof typeof PLANS;
export type SubscriptionStatus = "active" | "expired" | "past_due" | "canceled";

export interface Subscription {
  plan: PlanType;
  status: SubscriptionStatus;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  paymentGateway: "google_play" | "stripe" | null;
  gatewaySubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}

export function createTrialSubscription(): Subscription {
  const now = new Date();
  const endsAt = new Date(now.getTime() + PLANS.trial.trialDays * 86400000);
  return {
    plan: "trial",
    status: "active",
    trialStartedAt: now.toISOString(),
    trialEndsAt: endsAt.toISOString(),
    paymentGateway: null,
    gatewaySubscriptionId: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
  };
}

export function isSubscriptionLocationAllowed(sub: Subscription | null | undefined): boolean {
  if (!sub) return false;
  if (sub.plan === "trial") {
    return sub.status === "active" && !!sub.trialEndsAt && new Date(sub.trialEndsAt) > new Date();
  }
  return sub.status === "active";
}

export function getTrialDaysLeft(sub: Subscription | null | undefined): number {
  if (!sub || sub.plan !== "trial" || !sub.trialEndsAt) return 0;
  const diff = new Date(sub.trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}
