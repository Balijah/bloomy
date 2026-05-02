import { useState } from "react";
import { 
  useGetLocations, 
  useCreateLocation, 
  useDeleteLocation,
  useUpdateLocation,
  useGetMe,
  getGetLocationsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MapPin, Plus, Trash2, CheckCircle2, Star } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  city: z.string().optional(),
  state: z.string().optional(),
});

export default function Locations() {
  const { data: user, isLoading: isUserLoading } = useGetMe();
  const { data: locations = [], isLoading: isLocationsLoading } = useGetLocations();
  const createLocation = useCreateLocation();
  const deleteLocation = useDeleteLocation();
  const updateLocation = useUpdateLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      lat: 40.7128,
      lng: -74.0060,
      city: "",
      state: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createLocation.mutate({ data: { ...values, isDefault: locations.length === 0 } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLocationsQueryKey() });
        setIsDialogOpen(false);
        form.reset();
        toast({ title: "Location added" });
      },
      onError: () => toast({ title: "Failed to add location", variant: "destructive" })
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this location?")) {
      deleteLocation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLocationsQueryKey() });
          toast({ title: "Location deleted" });
        }
      });
    }
  };

  const handleSetDefault = (id: number) => {
    updateLocation.mutate({ id, data: { isDefault: true } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLocationsQueryKey() });
        toast({ title: "Default location updated" });
      }
    });
  };

  const isFree = user?.subscriptionTier === "free";
  const limitReached = isFree && locations.length >= 1;

  if (isUserLoading || isLocationsLoading) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="space-y-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
          <p className="text-muted-foreground mt-1">Manage your saved weather locations.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          {limitReached ? (
            <Link href="/subscription">
              <Button className="rounded-full gap-2">
                <Plus className="h-4 w-4" /> Add Location
              </Button>
            </Link>
          ) : (
            <DialogTrigger asChild>
              <Button className="rounded-full gap-2">
                <Plus className="h-4 w-4" /> Add Location
              </Button>
            </DialogTrigger>
          )}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Location</DialogTitle>
              <DialogDescription>Enter coordinates for your new location.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Name</FormLabel>
                    <FormControl><Input placeholder="Home Farm" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="lat" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude</FormLabel>
                      <FormControl><Input type="number" step="any" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="lng" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude</FormLabel>
                      <FormControl><Input type="number" step="any" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                      <FormLabel>City (Optional)</FormLabel>
                      <FormControl><Input placeholder="Lincoln" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem>
                      <FormLabel>State (Optional)</FormLabel>
                      <FormControl><Input placeholder="NE" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createLocation.isPending}>
                    {createLocation.isPending ? "Adding..." : "Save"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {limitReached && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 p-4 rounded-lg text-sm flex items-center justify-between">
          <span>You've reached the limit of 1 location on the Free plan.</span>
          <Link href="/subscription" className="font-semibold hover:underline">Upgrade</Link>
        </div>
      )}

      {locations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center flex flex-col items-center">
          <MapPin className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-xl font-semibold mb-2">No locations yet</h3>
          <p className="text-muted-foreground mb-6">Add a location to see weather forecasts.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {locations.map(location => (
            <Card key={location.id} className={`overflow-hidden transition-colors ${location.isDefault ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}>
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${location.isDefault ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{location.name}</h3>
                        {location.isDefault && (
                          <span className="bg-primary text-primary-foreground text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">Default</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {location.lat.toFixed(4)}, {location.lng.toFixed(4)} 
                        {location.city && location.state ? ` • ${location.city}, ${location.state}` : ''}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {!location.isDefault && (
                      <Button variant="outline" size="sm" onClick={() => handleSetDefault(location.id)} className="hidden sm:flex">
                        <Star className="h-4 w-4 mr-2" /> Make Default
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(location.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}