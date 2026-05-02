import { 
  useGetAlerts, 
  useMarkAlertRead, 
  useDeleteAlert,
  getGetAlertsQueryKey,
  useGetMe
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Check, Trash2, AlertTriangle, Info, Wind, CloudRain, ThermometerSun, Snowflake } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function Alerts() {
  const { data: alerts = [], isLoading } = useGetAlerts();
  const markRead = useMarkAlertRead();
  const deleteAlert = useDeleteAlert();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleMarkRead = (id: number) => {
    markRead.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAlertsQueryKey() })
    });
  };

  const handleDelete = (id: number) => {
    deleteAlert.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAlertsQueryKey() });
        toast({ title: "Alert deleted" });
      }
    });
  };

  const getAlertIcon = (type: string) => {
    if (type.includes("frost") || type.includes("freeze") || type.includes("winter")) return <Snowflake className="h-5 w-5" />;
    if (type.includes("heat")) return <ThermometerSun className="h-5 w-5" />;
    if (type.includes("rain") || type.includes("flood")) return <CloudRain className="h-5 w-5" />;
    if (type.includes("wind")) return <Wind className="h-5 w-5" />;
    return <AlertTriangle className="h-5 w-5" />;
  };

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case "extreme": return "bg-destructive/10 text-destructive border-destructive/20";
      case "severe": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "moderate": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      default: return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
        <p className="text-muted-foreground mt-1">Weather warnings and agronomic alerts.</p>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center flex flex-col items-center">
          <Bell className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-xl font-semibold mb-2">All clear</h3>
          <p className="text-muted-foreground max-w-md">You have no active alerts at this time. Enjoy the weather!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map(alert => (
            <Card 
              key={alert.id} 
              className={`overflow-hidden transition-all duration-200 ${!alert.isRead ? 'border-primary/50 shadow-md ring-1 ring-primary/10' : 'opacity-80'}`}
            >
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row gap-4 p-5">
                  <div className={`shrink-0 h-12 w-12 rounded-full flex items-center justify-center border ${getSeverityColor(alert.severity)}`}>
                    {getAlertIcon(alert.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`text-lg font-semibold truncate ${!alert.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {alert.title}
                      </h3>
                      {!alert.isRead && <span className="flex h-2 w-2 rounded-full bg-primary shrink-0"></span>}
                      <Badge variant="outline" className="ml-auto shrink-0 font-normal uppercase text-[10px]">
                        {alert.severity}
                      </Badge>
                    </div>
                    
                    <p className={`text-sm mb-3 leading-relaxed ${!alert.isRead ? 'text-foreground/90' : 'text-muted-foreground'}`}>
                      {alert.message}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{format(new Date(alert.triggeredAt), "MMM d, h:mm a")}</span>
                      {alert.triggerValue && <span>Trigger: {alert.triggerValue}</span>}
                    </div>
                  </div>
                  
                  <div className="shrink-0 flex sm:flex-col gap-2 justify-end sm:justify-start border-t sm:border-t-0 border-border/50 pt-4 sm:pt-0 mt-2 sm:mt-0">
                    {!alert.isRead && (
                      <Button variant="outline" size="sm" onClick={() => handleMarkRead(alert.id)} className="w-full sm:w-auto h-8 px-3">
                        <Check className="h-3.5 w-3.5 mr-1.5" /> Read
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(alert.id)} className="w-full sm:w-auto h-8 px-3 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
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