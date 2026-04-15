import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/formatters';
import type { DieselNorms } from '@/types/operations';
import { Edit, Plus, Settings, Trash2 } from 'lucide-react';

interface DieselNormsTabProps {
    dieselNorms: DieselNorms[];
    onAddNorm: () => void;
    onEditNorm: (norm: DieselNorms) => void;
    onDeleteNorm: (normId: string) => void;
}

const DieselNormsTab = ({ dieselNorms, onAddNorm, onEditNorm, onDeleteNorm }: DieselNormsTabProps) => {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Fuel Efficiency Norms</CardTitle>
                    <CardDescription>
                        Configure expected fuel consumption standards
                    </CardDescription>
                </div>
                <Button onClick={onAddNorm}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Norm
                </Button>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {dieselNorms.length > 0 ? (
                        dieselNorms.map((norm) => (
                            <div key={norm.id} className="border rounded-lg p-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Fleet</p>
                                        <p className="font-medium">{norm.fleet_number}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Expected</p>
                                        <p className="font-medium">{formatNumber(norm.expected_km_per_litre, 2)} km/L</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Min</p>
                                        <p className="font-medium">{formatNumber(norm.min_acceptable, 2)} km/L</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Max</p>
                                        <p className="font-medium">{formatNumber(norm.max_acceptable, 2)} km/L</p>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => onEditNorm(norm)}
                                    >
                                        <Edit className="h-3 w-3 mr-1" />
                                        Edit
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => onDeleteNorm(norm.id)}
                                    >
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8">
                            <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">No Fuel Norms Configured</h3>
                            <p className="text-muted-foreground mb-4">
                                Set fuel efficiency standards for your fleet
                            </p>
                            <Button onClick={onAddNorm}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Norm
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default DieselNormsTab;
