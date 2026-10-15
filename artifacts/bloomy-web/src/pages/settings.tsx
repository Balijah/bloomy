import { useEffect } from "react";
import { 
  useGetAlertPreferences, 
  useUpdateAlertPreferences,
  useGetMe
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Bell, Mail, Settings2, ShieldAlert, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser, useClerk } from "@clerk/react";
import { useDeleteMe } from "@workspace/api-client-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const preferencesSchema = z.object({
  emailEnabled: z.boolean(),
  frostThreshold: z.number().min(0).max(50),
  heatThreshold: z.number().min(70).max(120),
  precipThreshold: z.number().min(0).max(10),
  windThreshold: z.number().min(0).max(100),
});

export default function Settings() {
  const { data: dbUser, isLoading: isDbUserLoading } = useGetMe();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const { data: prefs, isLoading: isPrefsLoading } = useGetAlertPreferences();
  const updatePrefs = useUpdateAlertPreferences();
  const deleteAccount = useDeleteMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof preferencesSchema>>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      emailEnabled: true,
      frostThreshold: 32,
      heatThreshold: 95,
      precipThreshold: 2,
      windThreshold: 40,
    },
  });

  useEffect(() => {
    if (prefs) {
      form.reset({
        emailEnabled: prefs.emailEnabled ?? true,
        frostThreshold: prefs.frostThreshold ?? 32,
        heatThreshold: prefs.heatThreshold ?? 95,
        precipThreshold: prefs.precipThreshold ?? 2,
        windThreshold: prefs.windThreshold ?? 40,
      });
    }
  }, [prefs, form]);

  const onSubmit = (values: z.infer<typeof preferencesSchema>) => {
    updatePrefs.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Preferences saved successfully" });
      },
      onError: () => {
        toast({ title: "Failed to save preferences", variant: "destructive" });
      }
    });
  };

  const isLoading = isDbUserLoading || isPrefsLoading || !clerkUser;

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and notification preferences.</p>
      </div>

      {/* Profile Section */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Avatar className="h-24 w-24 border-2 border-primary/20">
            <AvatarImage src={clerkUser.imageUrl} />
            <AvatarFallback className="bg-primary/10 text-primary text-2xl">
              {clerkUser.firstName?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-center sm:text-left space-y-2">
            <h3 className="text-2xl font-semibold">{clerkUser.fullName}</h3>
            <p className="text-muted-foreground">{clerkUser.primaryEmailAddress?.emailAddress}</p>
            <div className="inline-flex mt-2 items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
              {dbUser?.subscriptionTier} Plan
            </div>
          </div>
          <div className="flex-shrink-0">
            {/* Link to Clerk profile management if needed, or just let them manage it in Clerk UI */}
          </div>
        </CardContent>
      </Card>

      {/* Alert Preferences */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" /> Alert Preferences
          </CardTitle>
          <CardDescription>Configure when you want to be notified about weather events.</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-8">
              <FormField
                control={form.control}
                name="emailEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4 bg-muted/20">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base flex items-center gap-2">
                        <Mail className="h-4 w-4" /> Email Notifications
                      </FormLabel>
                      <FormDescription>
                        Receive critical weather alerts via email.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="space-y-6 pt-4 border-t border-border">
                <h4 className="font-medium">Threshold Settings</h4>
                
                <FormField
                  control={form.control}
                  name="frostThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between pb-2">
                        <FormLabel>Frost Warning (°F)</FormLabel>
                        <span className="text-sm font-medium text-primary">{field.value}°F</span>
                      </div>
                      <FormControl>
                        <Slider
                          min={0}
                          max={50}
                          step={1}
                          value={[field.value]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          className="py-2"
                        />
                      </FormControl>
                      <FormDescription>Alert when temperature drops below this.</FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="heatThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between pb-2">
                        <FormLabel>Extreme Heat (°F)</FormLabel>
                        <span className="text-sm font-medium text-primary">{field.value}°F</span>
                      </div>
                      <FormControl>
                        <Slider
                          min={70}
                          max={120}
                          step={1}
                          value={[field.value]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          className="py-2"
                        />
                      </FormControl>
                      <FormDescription>Alert when temperature exceeds this.</FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="windThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between pb-2">
                        <FormLabel>High Wind (mph)</FormLabel>
                        <span className="text-sm font-medium text-primary">{field.value} mph</span>
                      </div>
                      <FormControl>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[field.value]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          className="py-2"
                        />
                      </FormControl>
                      <FormDescription>Alert when gusts exceed this speed.</FormDescription>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t border-border px-6 py-4">
              <Button type="submit" disabled={updatePrefs.isPending} className="ml-auto">
                {updatePrefs.isPending ? "Saving..." : "Save Preferences"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {/* Legal Links */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <a href="/privacy" className="hover:text-foreground underline underline-offset-4">Privacy Policy</a>
        <a href="/terms" className="hover:text-foreground underline underline-offset-4">Terms of Service</a>
      </div>

      {/* Danger Zone */}
      <Card className="border-destructive/30 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" /> Delete Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action
            cannot be undone. Any active subscription will be cancelled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete My Account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your account, all locations, farm
                  profiles, notes, and records. If you have a paid subscription,
                  it will be cancelled immediately. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    deleteAccount.mutate(undefined, {
                      onSuccess: () => {
                        toast({ title: "Account deleted" });
                        signOut();
                      },
                      onError: () => {
                        toast({ title: "Failed to delete account", variant: "destructive" });
                      },
                    });
                  }}
                  disabled={deleteAccount.isPending}
                >
                  {deleteAccount.isPending ? "Deleting..." : "Yes, delete everything"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}