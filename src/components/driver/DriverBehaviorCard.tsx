// src/components/DriverBehaviorCard.tsx
'use client';

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, AlertTriangle, FileText, Eye, MessageSquare, CheckCircle, Car, Video } from "lucide-react";
import { format } from "date-fns";

interface DriverBehaviorCardProps {
  event: {
    id: string;
    driver_name: string;
    event_type: string;
    event_date: string;
    event_time?: string;
    location?: string;
    fleet_number?: string;
    severity?: string;
    status?: string;
    points?: number;
    description: string;
    debriefed_at?: string;
  };
  onViewDetails: () => void;
  onStartDebrief: () => void;
  onExportPDF: () => void;
}

const DriverBehaviorCard = ({ event, onViewDetails, onStartDebrief, onExportPDF }: DriverBehaviorCardProps) => {
  const getSeverityConfig = (severity: string = "medium") => {
    const config = {
      low: {
        card: "bg-blue-50 border-blue-200",
        badge: "bg-blue-100 text-blue-800 border-blue-300",
        icon: "text-blue-600",
        ring: "ring-blue-200",
        gradient: "from-blue-50 to-blue-100",
      },
      medium: {
        card: "bg-amber-50 border-amber-300",
        badge: "bg-amber-100 text-amber-800 border-amber-300",
        icon: "text-amber-600",
        ring: "ring-amber-200",
        gradient: "from-amber-50 to-amber-100",
      },
      high: {
        card: "bg-orange-50 border-orange-300",
        badge: "bg-orange-100 text-orange-800 border-orange-300",
        icon: "text-orange-600",
        ring: "ring-orange-200",
        gradient: "from-orange-50 to-orange-100",
      },
      critical: {
        card: "bg-red-50 border-red-300",
        badge: "bg-red-100 text-red-800 border-red-300",
        icon: "text-red-600",
        ring: "ring-red-200",
        gradient: "from-red-50 to-red-100",
      },
    };
    return config[severity as keyof typeof config] || config.medium;
  };

  const getStatusVariant = (status: string = "open"): "default" | "secondary" | "destructive" | "outline" => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      open: "destructive",
      "in-progress": "secondary",
      resolved: "outline",
      closed: "outline",
    };
    return map[status] || "destructive";
  };

  const severity = getSeverityConfig(event.severity);
  const isDebriefed = !!event.debriefed_at;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card
      className={`${severity.card} border-2 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-14 h-14 rounded-full ${severity.badge} flex items-center justify-center font-bold text-lg ring-4 ${severity.ring} shadow-md`}
            >
              {getInitials(event.driver_name)}
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">{event.driver_name}</h3>
              {event.fleet_number && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Car className="w-3.5 h-3.5" />
                  Fleet #{event.fleet_number}
                </p>
              )}
            </div>
          </div>
          <div className={`p-2 rounded-full ${severity.badge} shadow-sm`}>
            <AlertTriangle className={`w-5 h-5 ${severity.icon}`} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Badges */}
        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className={`${severity.badge} font-medium px-3 py-1 text-sm`}
          >
            {event.event_type}
          </Badge>
          <Badge
            variant={getStatusVariant(event.status)}
            className="font-medium text-sm"
          >
            {event.status || "open"}
          </Badge>
        </div>

        {/* Meta Info */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">
              {format(new Date(event.event_date), "MMM dd, yyyy")}
            </span>
            {event.event_time && (
              <>
                <Clock className="w-4 h-4 ml-2 text-muted-foreground" />
                <span className="font-medium">{event.event_time}</span>
              </>
            )}
          </div>

          {event.location && /^https?:\/\//i.test(event.location) && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Video className="w-4 h-4" />
              <button
                type="button"
                className="truncate max-w-[180px] text-blue-600 hover:text-blue-800 underline text-sm"
                onClick={(e) => { e.stopPropagation(); window.open(event.location!, '_blank', 'noopener,noreferrer'); }}
              >
                Event Video
              </button>
            </div>
          )}

          {event.points !== undefined && event.points > 0 && (
            <div className={`flex items-center gap-2 font-bold ${severity.icon}`}>
              <AlertTriangle className="w-4 h-4" />
              <span>{event.points} Points</span>
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {event.description}
        </p>

        {/* Debriefed Status */}
        {isDebriefed && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg px-3 py-2.5">
            <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              Debriefed on {format(new Date(event.debriefed_at!), "MMM dd, yyyy")}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onViewDetails}
            className="flex-1 h-10 text-sm font-medium border-gray-300 hover:bg-gray-50"
          >
            <Eye className="w-4 h-4 mr-1.5" />
            Details
          </Button>

          {!isDebriefed ? (
            <Button
              size="sm"
              onClick={onStartDebrief}
              className="flex-1 h-10 text-sm font-medium bg-blue-600 hover:bg-blue-700"
            >
              <MessageSquare className="w-4 h-4 mr-1.5" />
              Debrief
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={onExportPDF}
              className="flex-1 h-10 text-sm font-medium hover:bg-gray-100"
            >
              <FileText className="w-4 h-4 mr-1.5" />
              Export
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DriverBehaviorCard;
