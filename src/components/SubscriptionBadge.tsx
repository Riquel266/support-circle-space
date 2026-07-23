import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";

interface Props {
  plan: string;
  status: string;
  trialEndsAt?: string;
}

export function SubscriptionBadge({ plan, status, trialEndsAt }: Props) {
  if (plan === "trial" && status === "active") {
    const daysLeft = trialEndsAt
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
      : 0;
    return (
      <Badge variant="outline" className="text-blue-600 border-blue-300">
        Trial — {daysLeft}d restantes
      </Badge>
    );
  }
  if (status === "active") {
    return <Badge variant="outline" className="text-green-600 border-green-300">Premium</Badge>;
  }
  return <Badge variant="destructive"><Lock className="mr-1 h-3 w-3" />Expirado</Badge>;
}
