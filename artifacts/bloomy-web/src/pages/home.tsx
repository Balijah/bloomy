import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Sprout, CloudSun, MapPin, Bell, ChevronRight, Check } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="py-6 px-6 md:px-12 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2 text-primary font-bold text-2xl">
          <Sprout className="h-8 w-8" />
          <span>Bloomy</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in">
            <Button variant="ghost" className="font-medium hidden md:flex">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button className="font-medium rounded-full px-6">Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-32 px-6 md:px-12 max-w-7xl mx-auto flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
            <CloudSun className="h-4 w-4" />
            <span>Built for American Growers</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground max-w-4xl mb-6">
            Know the weather.<br /> Know your fields.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
            The weather companion that feels like checking the sky at dawn. 
            Information-rich forecasting combined with crop-specific insights, built by people who understand the land.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link href="/sign-up">
              <Button size="lg" className="rounded-full px-8 h-14 text-lg w-full sm:w-auto">
                Start Growing Free <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#pricing">
              <Button variant="outline" size="lg" className="rounded-full px-8 h-14 text-lg w-full sm:w-auto bg-card">
                View Plans
              </Button>
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="py-24 bg-card px-6 md:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-3 gap-12">
              <div className="flex flex-col items-start">
                <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mb-6">
                  <CloudSun className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Hyper-Local Forecasts</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Pinpoint accuracy for your exact coordinates. Get 15-day outlooks, hourly breakdowns, and crucial metrics like soil temperature and evapotranspiration.
                </p>
              </div>
              <div className="flex flex-col items-start">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-6">
                  <Sprout className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Crop-Specific Insights</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Track Growing Degree Days (GDD), monitor drought stress, and get advance warning for frost, extreme heat, or harvest-disrupting storms tailored to what you grow.
                </p>
              </div>
              <div className="flex flex-col items-start">
                <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-6">
                  <Bell className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Smart Alerts</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Set custom thresholds for precipitation, wind, and temperature. Get notified immediately when conditions threaten your fields, so you can take action.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-24 px-6 md:px-12 max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Plans rooted in your needs</h2>
            <p className="text-lg text-muted-foreground">
              Start with the essentials for free, or upgrade for powerful agricultural insights and multiple farm management.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free */}
            <div className="rounded-3xl border border-border bg-card p-8 flex flex-col">
              <h3 className="text-xl font-semibold mb-2">Free</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <p className="text-muted-foreground mb-8 text-sm">Essential weather data for a single location.</p>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm"><Check className="h-5 w-5 text-primary" /> Daily 7-day forecast</li>
                <li className="flex items-center gap-3 text-sm"><Check className="h-5 w-5 text-primary" /> 1 saved location</li>
                <li className="flex items-center gap-3 text-sm"><Check className="h-5 w-5 text-primary" /> Basic current conditions</li>
              </ul>
              <Link href="/sign-up">
                <Button variant="outline" className="w-full rounded-full">Sign Up Free</Button>
              </Link>
            </div>

            {/* Grower */}
            <div className="rounded-3xl border-2 border-primary bg-card p-8 flex flex-col relative shadow-xl shadow-primary/5 transform md:-translate-y-4">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Most Popular
              </div>
              <h3 className="text-xl font-semibold mb-2">Grower</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold">$19</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <p className="text-muted-foreground mb-8 text-sm">Deep insights and alerts for active farmers.</p>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm"><Check className="h-5 w-5 text-primary" /> 15-day forecasts & hourly updates</li>
                <li className="flex items-center gap-3 text-sm"><Check className="h-5 w-5 text-primary" /> Full agriculture dashboard</li>
                <li className="flex items-center gap-3 text-sm"><Check className="h-5 w-5 text-primary" /> Customizable email alerts</li>
                <li className="flex items-center gap-3 text-sm"><Check className="h-5 w-5 text-primary" /> Up to 3 farm locations</li>
              </ul>
              <Link href="/sign-up">
                <Button className="w-full rounded-full">Start Growing</Button>
              </Link>
            </div>

            {/* Grower Pro */}
            <div className="rounded-3xl border border-border bg-card p-8 flex flex-col">
              <h3 className="text-xl font-semibold mb-2">Grower Pro</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold">$39</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <p className="text-muted-foreground mb-8 text-sm">Maximum coverage for larger operations.</p>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm"><Check className="h-5 w-5 text-primary" /> Everything in Grower</li>
                <li className="flex items-center gap-3 text-sm"><Check className="h-5 w-5 text-primary" /> 5 farm locations</li>
                <li className="flex items-center gap-3 text-sm"><Check className="h-5 w-5 text-primary" /> Priority support</li>
              </ul>
              <Link href="/sign-up">
                <Button variant="outline" className="w-full rounded-full">Get Pro</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-12 px-6 md:px-12 text-center text-muted-foreground bg-card mt-auto">
        <div className="flex items-center justify-center gap-2 font-bold text-xl text-primary mb-4">
          <Sprout className="h-6 w-6" />
          <span>Bloomy</span>
        </div>
        <p className="text-sm">© {new Date().getFullYear()} Bloomy Weather Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}
