import { useState } from "react";
import { Link } from "wouter";
import {
  useGetFarmProfiles,
  useCreateFarmProfile,
  useDeleteFarmProfile,
  useGetMe,
  useGetLocations,
  getGetFarmProfilesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sprout, Plus, MapPin, Calendar, Trash2, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  locationId: z.coerce.number().min(1, "Location is required"),
  cropType: z.enum(["corn", "soybeans", "winter_wheat", "cotton", "almonds", "grapes", "apples", "potatoes", "rice", "other"]),
  acreage: z.coerce.number().min(0.1, "Must be at least 0.1 acres"),
  plantingDate: z.string().min(1, "Planting date is required"),
});

export default function Agriculture() {
  const { data: user, isLoading: isUserLoading } = useGetMe();
  const { data: profiles = [], isLoading: isProfilesLoading } = useGetFarmProfiles();
  const createProfile = useCreateFarmProfile();
  const deleteProfile = useDeleteFarmProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: locations = [] } = useGetLocations();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      acreage: 10,
      cropType: "corn",
      plantingDate: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createProfile.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetFarmProfilesQueryKey() });
        setIsDialogOpen(false);
        form.reset();
        toast({ title: "Farm profile created" });
      },
      onError: (err) => {
        toast({ title: "Failed to create profile", variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this farm profile?")) {
      deleteProfile.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFarmProfilesQueryKey() });
          toast({ title: "Farm profile deleted" });
        }
      });
    }
  };

  if (isUserLoading || isProfilesLoading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Farm Profiles</h1>
          <p className="text-muted-foreground mt-1">Manage your fields and track crop-specific metrics.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full gap-2">
              <Plus className="h-4 w-4" /> Add Field
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add a new field</DialogTitle>
              <DialogDescription>Create a new farm profile to track specific crop conditions.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Field Name</FormLabel>
                    <FormControl><Input placeholder="North 40" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="cropType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Crop Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select crop" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="corn">Corn</SelectItem>
                          <SelectItem value="soybeans">Soybeans</SelectItem>
                          <SelectItem value="winter_wheat">Winter Wheat</SelectItem>
                          <SelectItem value="cotton">Cotton</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="acreage" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Acreage</FormLabel>
                      <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="plantingDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Planting Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="locationId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map(loc => (
                          <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={createProfile.isPending}>
                    {createProfile.isPending ? "Creating..." : "Save Field"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {profiles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center flex flex-col items-center">
          <Sprout className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-xl font-semibold mb-2">No fields yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md">Add your first farm profile to start receiving crop-specific weather insights and growing degree days tracking.</p>
          <Button variant="outline" onClick={() => setIsDialogOpen(true)}>Add your first field</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map(profile => (
            <Card key={profile.id} className="overflow-hidden hover:border-primary/50 transition-colors group">
              <CardHeader className="bg-muted/50 border-b border-border pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{profile.name}</CardTitle>
                    <CardDescription className="capitalize mt-1 flex items-center gap-1.5">
                      <Sprout className="h-3.5 w-3.5" />
                      {profile.cropType.replace('_', ' ')} • {profile.acreage} acres
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive -mr-2 -mt-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(profile.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>Location ID: {profile.locationId}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>Planted: {profile.plantingDate ? format(new Date(profile.plantingDate), "MMM d, yyyy") : "Not set"}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-5 pt-0">
                <Link href={`/agriculture/${profile.id}`} className="w-full">
                  <Button variant="secondary" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    View Insights <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}