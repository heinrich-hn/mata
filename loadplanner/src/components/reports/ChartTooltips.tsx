interface CustomTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}

export function CustomTooltip({
  active,
  payload,
  label,
}: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum, entry) => sum + entry.value, 0);
    
    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg shadow-xl min-w-[180px] overflow-hidden">
        <div className="border-b border-border/50 px-3 py-2 bg-muted/30">
          <p className="font-semibold text-foreground text-sm">{label}</p>
        </div>
        <div className="px-3 py-2 space-y-1.5">
          {payload.map((entry, index) => {
            const percentage = total > 0 ? Math.round((entry.value / total) * 100) : 0;
            return (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-muted-foreground">{entry.name}:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {entry.value.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({percentage}%)
                  </span>
                </div>
              </div>
            );
          })}
          {total > 0 && (
            <div className="pt-1.5 mt-1 border-t border-border/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Total:</span>
                <span className="text-sm font-semibold text-foreground">
                  {total.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

interface PieTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; payload: { fill: string } }[];
}

export function PieTooltip({
  active,
  payload,
}: PieTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg shadow-xl overflow-hidden">
        <div className="border-b border-border/50 px-3 py-2 bg-muted/30">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: data.payload.fill }}
            />
            <p className="font-semibold text-foreground text-sm">
              {data.name}
            </p>
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="flex items-center justify-between gap-6">
            <span className="text-sm text-muted-foreground">Count:</span>
            <span className="text-lg font-semibold text-foreground">
              {data.value.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

interface LegendTooltipProps {
  color?: string;
  name?: string;
  value?: number;
}

export function LegendTooltip({ color, name, value }: LegendTooltipProps) {
  if (!name) return null;
  
  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-2 shadow-xl">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium text-foreground">{name}</span>
      </div>
      {value !== undefined && (
        <p className="text-xs text-muted-foreground mt-1">
          Value: {value.toLocaleString()}
        </p>
      )}
    </div>
  );
}