import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import
  {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import
  {
    AlertTriangle,
    Ambulance,
    Camera,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Clock,
    FileText,
    MapPin,
    Phone,
    ShieldAlert,
    Truck,
    Users,
  } from "lucide-react";
import { useState } from "react";

const AccidentResponseGuide = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
        <CardHeader className="pb-2">
          <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-lg text-amber-900 dark:text-amber-100">
                Accident Response Procedure
              </CardTitle>
              <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">
                Quick Reference
              </Badge>
            </div>
            {isOpen ? (
              <ChevronDown className="h-5 w-5 text-amber-600" />
            ) : (
              <ChevronRight className="h-5 w-5 text-amber-600" />
            )}
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Emergency Contacts Banner */}
            <div className="bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Ambulance className="h-5 w-5 text-red-600" />
                <span className="font-semibold text-red-800 dark:text-red-200">
                  EMERGENCY - If Injuries Present
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-red-600" />
                  <span className="font-mono font-bold text-red-700 dark:text-red-300">999</span>
                  <span className="text-muted-foreground">Emergency</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-red-600" />
                  <span className="font-mono font-bold text-red-700 dark:text-red-300">0772 152 316</span>
                  <span className="text-muted-foreground">MARS</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-red-600" />
                  <span className="font-mono font-bold text-red-700 dark:text-red-300">0772 777 226</span>
                  <span className="text-muted-foreground">Ace</span>
                </div>
              </div>
            </div>

            {/* Step-by-Step Procedure */}
            <div className="space-y-3">
              {/* Step 1: Check for Injuries */}
              <StepCard
                number={1}
                title="Check for Injuries"
                icon={<AlertTriangle className="h-4 w-4" />}
                variant="danger"
              >
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Give exact location & number of injured</li>
                  <li>Stay with injured - DO NOT move unless in immediate danger</li>
                </ul>
              </StepCard>

              {/* Step 2: Call Police */}
              <StepCard
                number={2}
                title="Call Police"
                icon={<Phone className="h-4 w-4" />}
                variant="warning"
              >
                <div className="flex items-center gap-4 text-sm">
                  <span>
                    <span className="font-mono font-bold">995</span> or nearest police station
                  </span>
                  <span className="text-muted-foreground">Report accident & request attendance</span>
                </div>
              </StepCard>

              {/* Step 3: Notify Transport Officer */}
              <StepCard
                number={3}
                title="Notify Transport Officer"
                icon={<Users className="h-4 w-4" />}
                variant="info"
              >
                <div className="text-sm space-y-1">
                  <p className="font-medium">Send via WhatsApp / Call:</p>
                  <ul className="list-disc list-inside ml-2">
                    <li>Exact GPS location / landmarks</li>
                    <li>Photos of scene & damage</li>
                    <li>Short description of incident</li>
                  </ul>
                </div>
              </StepCard>

              {/* Step 4: Secure the Scene */}
              <StepCard
                number={4}
                title="Secure the Scene"
                icon={<MapPin className="h-4 w-4" />}
                variant="warning"
              >
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Switch on hazard lights</li>
                  <li>Place warning triangles: <strong>50m</strong> & <strong>100m</strong> from scene</li>
                  <li className="text-red-600 dark:text-red-400 font-medium">DO NOT move vehicle</li>
                </ul>
              </StepCard>

              {/* Step 5: Take Photos & Collect Info */}
              <StepCard
                number={5}
                title="Take Photos & Collect Info"
                icon={<Camera className="h-4 w-4" />}
                variant="info"
              >
                <div className="text-sm space-y-1">
                  <p className="font-medium">Use Accident Checklist - Photograph/document:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1 ml-2">
                    <span>• All 4 sides of truck</span>
                    <span>• Third-party vehicle details</span>
                    <span>• Tyre marks & point of impact</span>
                    <span>• Witnesses' contact info</span>
                    <span>• Police officer's details</span>
                  </div>
                </div>
              </StepCard>

              {/* Step 6: Wait for Police */}
              <StepCard
                number={6}
                title="Wait for Police"
                icon={<Clock className="h-4 w-4" />}
                variant="default"
              >
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Police complete investigation</li>
                  <li className="font-medium">Get Police Case Number</li>
                  <li>Get Traffic Accident Form (if issued)</li>
                </ul>
              </StepCard>

              {/* Step 7: Towing */}
              <StepCard
                number={7}
                title="Towing"
                icon={<Truck className="h-4 w-4" />}
                variant="warning"
              >
                <p className="text-sm">
                  <strong>ZIB Insurance arranges towing</strong> — DO NOT allow other tow trucks
                </p>
              </StepCard>

              {/* Step 8: Insurance Notification */}
              <StepCard
                number={8}
                title="Insurance Notification (within 1 hour)"
                icon={<FileText className="h-4 w-4" />}
                variant="info"
              >
                <p className="text-sm mb-2 text-muted-foreground">Transport Officer notifies:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <div className="bg-blue-50 dark:bg-blue-950/40 p-2 rounded border">
                    <p className="font-semibold">MMI Personal Accident</p>
                    <p>Augustine: +263 242 749 850</p>
                    <p className="text-blue-600 dark:text-blue-400">claims@mminsurance.co.zw</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/40 p-2 rounded border">
                    <p className="font-semibold">ZIB Motor</p>
                    <p>Perpetua: +263 772 358 581</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/40 p-2 rounded border">
                    <p className="font-semibold">Senate GIT (cargo)</p>
                    <p>Elize: elize@pibn.co.za</p>
                    <p>Adrie: +27 82 453 3959</p>
                  </div>
                </div>
              </StepCard>

              {/* Step 9: Submit within 24 Hours */}
              <StepCard
                number={9}
                title="Submit Within 24 Hours"
                icon={<CheckCircle2 className="h-4 w-4" />}
                variant="success"
              >
                <div className="text-sm">
                  <p className="font-medium mb-1">Submit to Transport Officer:</p>
                  <ul className="list-disc list-inside ml-2">
                    <li>Completed Accident Checklist</li>
                    <li>All photos</li>
                    <li>Police report / Case Number</li>
                    <li>Third-party details</li>
                  </ul>
                </div>
              </StepCard>
            </div>

            <Separator />

            {/* Footer Note */}
            <p className="text-xs text-muted-foreground text-center">
              Following this procedure ensures proper documentation and faster claim processing.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

interface StepCardProps {
  number: number;
  title: string;
  icon: React.ReactNode;
  variant: "danger" | "warning" | "info" | "success" | "default";
  children: React.ReactNode;
}

const StepCard = ({ number, title, icon, variant, children }: StepCardProps) => {
  const variantStyles = {
    danger: "border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800",
    warning: "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800",
    info: "border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800",
    success: "border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800",
    default: "border-gray-200 bg-gray-50/50 dark:bg-gray-950/20 dark:border-gray-800",
  };

  const numberStyles = {
    danger: "bg-red-600 text-white",
    warning: "bg-amber-600 text-white",
    info: "bg-blue-600 text-white",
    success: "bg-green-600 text-white",
    default: "bg-gray-600 text-white",
  };

  return (
    <div className={`border rounded-lg p-3 ${variantStyles[variant]}`}>
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${numberStyles[variant]}`}
        >
          {number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {icon}
            <span className="font-semibold text-sm">{title}</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AccidentResponseGuide;