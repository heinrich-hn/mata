import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { memo } from "react";

export interface HoldingBayTyre {
    id: string;
    serial_number: string | null;
    brand: string;
    model: string;
    size: string;
    type: string;
    condition: string | null;
    current_tread_depth: number | null;
    initial_tread_depth: number | null;
    purchase_cost_zar: number | null;
    purchase_cost_usd: number | null;
    purchase_price: number | null;
    position: string | null;
    dot_code: string | null;
    notes: string | null;
}

interface TyreInventoryPartFormProps {
    selectedTyreId: string | null;
    onTyreSelect: (tyre: HoldingBayTyre) => void;
}

function TyreInventoryPartFormInner({
    selectedTyreId,
    onTyreSelect,
}: TyreInventoryPartFormProps) {
    const {
        data: holdingBayTyres = [],
        isLoading,
        error,
    } = useQuery<HoldingBayTyre[]>({
        queryKey: ["holding_bay_tyres_for_job_card"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("tyres")
                .select(
                    "id, serial_number, brand, model, size, type, condition, current_tread_depth, initial_tread_depth, purchase_cost_zar, purchase_cost_usd, purchase_price, position, dot_code, notes"
                )
                .is("current_fleet_position", null)
                .order("brand", { ascending: true });

            if (error) throw error;

            // Filter to holding bay tyres only (same logic as TyreInventory.tsx)
            return (data || []).filter(
                (t) =>
                    t.position === "holding-bay" ||
                    t.position === "main-warehouse" ||
                    !t.position
            );
        },
    });

    const selectedTyre = holdingBayTyres.find((t) => t.id === selectedTyreId);

    const getConditionColor = (condition: string | null) => {
        switch (condition) {
            case "new":
                return "bg-green-100 text-green-700";
            case "good":
                return "bg-blue-100 text-blue-700";
            case "fair":
                return "bg-yellow-100 text-yellow-700";
            case "worn":
                return "bg-orange-100 text-orange-700";
            case "critical":
                return "bg-red-100 text-red-700";
            default:
                return "bg-gray-100 text-gray-700";
        }
    };

    const getTreadDepthLabel = (depth: number | null, initial: number | null) => {
        if (depth === null) return null;
        const pct = initial && initial > 0 ? Math.round((depth / initial) * 100) : null;
        return pct !== null ? `${depth}mm (${pct}%)` : `${depth}mm`;
    };

    const getUnitPrice = (tyre: HoldingBayTyre): number => {
        return tyre.purchase_cost_zar ?? tyre.purchase_price ?? 0;
    };

    return (
        <>
            <div className="space-y-2">
                <Label htmlFor="tyre-item">Select Tyre from Holding Bay *</Label>
                <Select
                    value={selectedTyreId || ""}
                    onValueChange={(value) => {
                        const tyre = holdingBayTyres.find((t) => t.id === value);
                        if (tyre) {
                            onTyreSelect(tyre);
                        }
                    }}
                >
                    <SelectTrigger id="tyre-item">
                        <SelectValue
                            placeholder={
                                isLoading
                                    ? "Loading holding bay tyres..."
                                    : "Choose tyre from holding bay"
                            }
                        />
                    </SelectTrigger>
                    <SelectContent>
                        {isLoading ? (
                            <SelectItem value="loading" disabled>
                                Loading tyres...
                            </SelectItem>
                        ) : holdingBayTyres.length === 0 ? (
                            <SelectItem value="empty" disabled>
                                No tyres available in holding bay
                            </SelectItem>
                        ) : (
                            holdingBayTyres.map((tyre) => (
                                <SelectItem key={tyre.id} value={tyre.id}>
                                    <span className="flex items-center gap-2">
                                        <Circle className="h-2 w-2 fill-current" />
                                        {tyre.brand} {tyre.model} {tyre.size}
                                        {tyre.serial_number ? ` (SN: ${tyre.serial_number})` : ""}
                                        {tyre.condition ? ` • ${tyre.condition}` : ""}
                                    </span>
                                </SelectItem>
                            ))
                        )}
                    </SelectContent>
                </Select>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        Error loading holding bay tyres:{" "}
                        {error instanceof Error ? error.message : "Unknown error"}
                    </AlertDescription>
                </Alert>
            )}

            {selectedTyre && (
                <Card className="bg-green-50 border-green-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            Tyre Selected from Holding Bay
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Brand / Model:</span>
                            <span className="font-medium">
                                {selectedTyre.brand} {selectedTyre.model}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Size:</span>
                            <span>{selectedTyre.size}</span>
                        </div>
                        {selectedTyre.serial_number && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Serial Number:</span>
                                <span>{selectedTyre.serial_number}</span>
                            </div>
                        )}
                        {selectedTyre.dot_code && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">DOT Code:</span>
                                <span>{selectedTyre.dot_code}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Condition:</span>
                            <Badge
                                className={getConditionColor(selectedTyre.condition)}
                                variant="secondary"
                            >
                                {selectedTyre.condition || "Unknown"}
                            </Badge>
                        </div>
                        {getTreadDepthLabel(
                            selectedTyre.current_tread_depth,
                            selectedTyre.initial_tread_depth
                        ) && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Tread Depth:</span>
                                    <span>
                                        {getTreadDepthLabel(
                                            selectedTyre.current_tread_depth,
                                            selectedTyre.initial_tread_depth
                                        )}
                                    </span>
                                </div>
                            )}
                        {getUnitPrice(selectedTyre) > 0 && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Purchase Cost:</span>
                                <span>R {getUnitPrice(selectedTyre).toLocaleString()}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Type:</span>
                            <span>{selectedTyre.type}</span>
                        </div>
                    </CardContent>
                </Card>
            )}
        </>
    );
}

const TyreInventoryPartForm = memo(TyreInventoryPartFormInner);
export default TyreInventoryPartForm;
