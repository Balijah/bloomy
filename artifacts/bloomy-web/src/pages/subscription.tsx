import { 
  useGetMe, 
  useGetCurrentSubscription,
  useCreateCheckoutSession,
  useCreatePortalSession
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, CreditCard, Leaf } from "lucide-react";

export default function Subscription() {
  const { data: user, isLoading: isUserLoading } = useGetMe();
  const { data: sub, isLoading: isSubLoading } = useGetCurrentSubscription();
  const createCheckout = useCreateCheckoutSession();
  const createPortal = useCreatePortalSession();

  const successUrl = `${window.location.origin}/subscription?success=true`;
  const cancelUrl = `${window.location.origin}/subscription`;

  const handleUpgrade = (tier: string) => {
    createCheckout.mutate({ data: { tier: tier as any, successUrl, cancelUrl } }, {
      onSuccess: (data) => {
        if (data.url) window.location.href = data.url;
      }
    });
  };

  const handleManage = () => {
    createPortal.mutate(undefined, {
      onSuccess: (data) => {
        if (data.url) window.location.href = data.url;
      }
    });
  };

  if (isUserLoading || isSubLoading) {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-96 w-full rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const currentTier = user?.subscriptionTier || "free";

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Subscription Plans</h1>
        <p className="text-lg text-muted-foreground">
          Choose the right plan for your farm's needs. Upgrade for deeper insights and more locations.
        </p>
        {sub?.currentPeriodEnd && (
          <p className="text-sm text-muted-foreground mt-2" data-testid="text-period-end">
            Current period ends: {new Date(sub.currentPeriodEnd).toLocaleDateString()}
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Free Plan */}
        <Card className={`relative flex flex-col ${currentTier === 'free' ? 'border-primary shadow-sm ring-1 ring-primary/20' : 'border-border'}`} data-testid="card-plan-free">
          {currentTier === 'free' && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">
              Current Plan
            </div>
          )}
          <CardHeader>
            <CardTitle className="text-2xl">Free</CardTitle>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold">
              $0
              <span className="ml-1 text-xl font-medium text-muted-foreground">/mo</span>
            </div>
            <CardDescription className="pt-2">Essential weather data.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-3">
              {['Daily 7-day forecast', '1 saved location', 'Basic current conditions'].map(feature => (
                <li key={feature} className="flex gap-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              className="w-full" 
              disabled={currentTier === 'free'}
              data-testid="button-plan-free"
            >
              {currentTier === 'free' ? 'Active' : 'Downgrade via Portal'}
            </Button>
          </CardFooter>
        </Card>

        {/* Grower Plan */}
        <Card className={`relative flex flex-col border-2 ${currentTier === 'grower' ? 'border-primary shadow-md' : 'border-blue-500/30 shadow-lg shadow-blue-500/5'}`} data-testid="card-plan-grower">
          {currentTier === 'grower' ? (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">
              Current Plan
            </div>
          ) : (
             <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">
              Most Popular
            </div>
          )}
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">Grower <Leaf className="h-5 w-5 text-primary" /></CardTitle>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold">
              $19
              <span className="ml-1 text-xl font-medium text-muted-foreground">/mo</span>
            </div>
            <CardDescription className="pt-2">Deep insights for active farmers.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-3">
              {['15-day forecasts & hourly', 'Full agriculture dashboard', 'Customizable email alerts', 'Up to 3 farm locations', 'Growing Degree Days'].map(feature => (
                <li key={feature} className="flex gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            {currentTier === 'grower' ? (
              <Button className="w-full" onClick={handleManage} disabled={createPortal.isPending} data-testid="button-manage-grower">
                <CreditCard className="mr-2 h-4 w-4" /> Manage Subscription
              </Button>
            ) : (
              <Button 
                className="w-full" 
                variant={currentTier === 'grower_pro' ? 'outline' : 'default'}
                onClick={() => currentTier === 'grower_pro' ? handleManage() : handleUpgrade('grower')}
                disabled={createCheckout.isPending}
                data-testid="button-upgrade-grower"
              >
                {currentTier === 'grower_pro' ? 'Downgrade via Portal' : 'Upgrade to Grower'}
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Grower Pro Plan */}
        <Card className={`relative flex flex-col ${currentTier === 'grower_pro' ? 'border-primary shadow-sm ring-1 ring-primary/20' : 'border-border'}`} data-testid="card-plan-grower-pro">
          {currentTier === 'grower_pro' && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">
              Current Plan
            </div>
          )}
          <CardHeader>
            <CardTitle className="text-2xl">Grower Pro</CardTitle>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold">
              $39
              <span className="ml-1 text-xl font-medium text-muted-foreground">/mo</span>
            </div>
            <CardDescription className="pt-2">Max coverage for larger ops.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-3">
              {['Everything in Grower', '5 farm locations', 'Priority support'].map(feature => (
                <li key={feature} className="flex gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            {currentTier === 'grower_pro' ? (
              <Button className="w-full" onClick={handleManage} disabled={createPortal.isPending} data-testid="button-manage-pro">
                <CreditCard className="mr-2 h-4 w-4" /> Manage Subscription
              </Button>
            ) : (
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => handleUpgrade('grower_pro')}
                disabled={createCheckout.isPending}
                data-testid="button-upgrade-pro"
              >
                Upgrade to Pro
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
